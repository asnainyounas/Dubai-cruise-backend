// src/controllers/departure.controller.js
'use strict';

const mongoose = require('mongoose');
const Departure = require('../models/Departure');
const Cruise = require('../models/Cruise');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { departureCreateSchema, departureUpdateSchema } = require('../validators/departure.validator');

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/departures
// Optional filters: ?cruise=<id>&from=<ISO>&to=<ISO>
// ---------------------------------------------------------------------------
exports.adminListDepartures = asyncHandler(async (req, res, next) => {
  const { cruise, from, to } = req.query;
  const filter = {};

  if (cruise !== undefined) {
    if (!mongoose.isValidObjectId(cruise)) return next(new AppError('Invalid cruise id', 400));
    filter.cruise = cruise;
  }
  if (from !== undefined) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return next(new AppError('from must be a valid ISO date', 400));
    filter.startsAt = { ...filter.startsAt, $gte: d };
  }
  if (to !== undefined) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return next(new AppError('to must be a valid ISO date', 400));
    filter.startsAt = { ...filter.startsAt, $lte: d };
  }

  const departures = await Departure.find(filter)
    .sort({ startsAt: 1 })
    .populate('cruise', 'title slug')
    .select('-__v')
    .lean();

  const data = departures.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  return res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// ADMIN: POST /api/admin/departures
// ---------------------------------------------------------------------------
exports.adminCreateDeparture = asyncHandler(async (req, res, next) => {
  const parsed = departureCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);

  const { cruise, startsAt, capacity, adultPrice, childPrice, status } = parsed.data;

  if (!mongoose.isValidObjectId(cruise)) return next(new AppError('Invalid cruise id', 400));

  const cruiseDoc = await Cruise.findById(cruise).select('_id').lean();
  if (!cruiseDoc) return next(new AppError('Cruise not found', 404));

  const departure = await Departure.create({
    cruise,
    startsAt,
    capacity,
    seatsRemaining: capacity, // always set server-side
    adultPrice,
    childPrice,
    status,
  });

  const { _id, __v, ...rest } = departure.toObject();
  return res.status(201).json({ success: true, data: { id: _id, ...rest } });
});

// ---------------------------------------------------------------------------
// ADMIN: PATCH /api/admin/departures/:id
// ---------------------------------------------------------------------------
exports.adminUpdateDeparture = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid id', 400));

  const parsed = departureUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);

  const { capacity: newCapacity, ...otherFields } = parsed.data;
if (otherFields.startsAt) otherFields.startsAt = new Date(otherFields.startsAt);

  // If capacity is being changed, use atomic aggregation-pipeline updateOne
  if (newCapacity !== undefined) {
    const result = await Departure.updateOne(
      {
        _id: id,
        // Only proceed if (current capacity - seatsRemaining) <= newCapacity
        // i.e. booked seats do not exceed new capacity
        $expr: {
          $lte: [
            { $subtract: ['$capacity', '$seatsRemaining'] },
            newCapacity,
          ],
        },
      },
      [
        {
          $set: {
            capacity: newCapacity,
            seatsRemaining: {
              $subtract: [
                newCapacity,
                { $subtract: ['$capacity', '$seatsRemaining'] },
              ],
            },
            // Merge any other allowed scalar fields
            ...Object.fromEntries(
              Object.entries(otherFields).map(([k, v]) => [k, { $literal: v }])
            ),
          },
        },
      ],
      { updatePipeline: true }
    );

    if (result.matchedCount === 0) {
      // Check if the document actually exists
      const exists = await Departure.exists({ _id: id });
      if (!exists) return next(new AppError('Departure not found', 404));
      return next(new AppError('New capacity is lower than seats already booked', 409));
    }
  } else if (Object.keys(otherFields).length > 0) {
    // No capacity change – standard findByIdAndUpdate
    const departure = await Departure.findByIdAndUpdate(id, otherFields, {
      new: true,
      runValidators: true,
    }).select('-__v');
    if (!departure) return next(new AppError('Departure not found', 404));
    const { _id, ...rest } = departure.toObject();
    return res.json({ success: true, data: { id: _id, ...rest } });
  }

  // Fetch and return the updated document
  const updated = await Departure.findById(id).select('-__v').lean();
  if (!updated) return next(new AppError('Departure not found', 404));

  const { _id, ...rest } = updated;
  return res.json({ success: true, data: { id: _id, ...rest } });
});

// ---------------------------------------------------------------------------
// ADMIN: DELETE /api/admin/departures/:id
// ---------------------------------------------------------------------------
exports.adminDeleteDeparture = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid id', 400));

  const departure = await Departure.findById(id).select('_id').lean();
  if (!departure) return next(new AppError('Departure not found', 404));

  // Guard: do not delete if any bookings exist for this departure
  const hasBookings = await Booking.exists({ departure: id });
  if (hasBookings) {
    return next(new AppError('Departure has bookings; cancel it instead', 409));
  }

  await Departure.deleteOne({ _id: id });
  return res.json({ success: true, data: null });
});
