// src/controllers/departure.controller.js
'use strict';

const mongoose = require('mongoose');
const Departure = require('../models/Departure');
const Cruise = require('../models/Cruise');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { buildStartTimes } = require('../utils/schedule');
const { departureCreateSchema, departureUpdateSchema, departureBulkSchema } = require('../validators/departure.validator');

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

// ---------------------------------------------------------------------------
// ADMIN: POST /api/admin/departures/bulk
// ---------------------------------------------------------------------------
exports.adminBulkCreateDepartures = asyncHandler(async (req, res, next) => {
  // 1. Validate request body using the strict bulk schema
  const parsed = departureBulkSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);

  const {
    cruise: cruiseId,
    startDate,
    endDate,
    daysOfWeek,
    times,
    capacity,
    adultPrice,
    childPrice,
    status,
    dryRun,
  } = parsed.data;

  // 2. Verify the cruise exists
  const cruiseDoc = await Cruise.findById(cruiseId).select('_id').lean();
  if (!cruiseDoc) return next(new AppError('Cruise not found', 404));

  // 3. Generate all candidate departure times for the requested schedule
  const candidates = buildStartTimes({ startDate, endDate, daysOfWeek, times });

  // 4. Enforce the 400-departure cap before any filtering
  if (candidates.length > 400) {
    return next(new AppError('Too many departures in one request (max 400)', 400));
  }

  // 5. Capture the current instant once so every candidate is evaluated consistently
  const now = new Date();

  // 6. Skip candidates in the past (startsAt must be strictly in the future)
  const futureCandidates = [];
  let skippedPast = 0;
  for (const startsAt of candidates) {
    if (startsAt > now) {
      futureCandidates.push(startsAt);
    } else {
      skippedPast += 1;
    }
  }

  // 7. Skip candidates that already exist in the database (single query)
  let skippedExisting = 0;
  let toInsert = futureCandidates;

  if (futureCandidates.length > 0) {
    // Avoid an $in query with an empty array
    const existing = await Departure.find(
      { cruise: cruiseId, startsAt: { $in: futureCandidates } },
      { startsAt: 1, _id: 0 }
    ).lean();

    if (existing.length > 0) {
      const existingSet = new Set(existing.map((d) => d.startsAt.getTime()));
      toInsert = futureCandidates.filter((d) => !existingSet.has(d.getTime()));
      skippedExisting = existing.length;
    }
  }

  // 8. Dry-run: report what would be created without writing anything
  if (dryRun) {
    const wouldCreate = toInsert.length;
    return res.status(200).json({
      success: true,
      data: {
        wouldCreate,
        skippedExisting,
        skippedPast,
        firstStartsAt: wouldCreate > 0 ? toInsert[0].toISOString() : null,
        lastStartsAt: wouldCreate > 0 ? toInsert[toInsert.length - 1].toISOString() : null,
      },
    });
  }

  // 9. Nothing to insert after filtering
  if (toInsert.length === 0) {
    return res.status(201).json({
      success: true,
      data: {
        created: 0,
        skippedExisting,
        skippedPast,
        firstStartsAt: null,
        lastStartsAt: null,
      },
    });
  }

  // 10. Build document array – seatsRemaining is always set server-side
  const docs = toInsert.map((startsAt) => {
    const doc = { cruise: cruiseId, startsAt, capacity, seatsRemaining: capacity, status };
    if (adultPrice !== undefined) doc.adultPrice = adultPrice;
    if (childPrice !== undefined) doc.childPrice = childPrice;
    return doc;
  });

  // 11. Insert with ordered:false so a duplicate-key race only skips that document
  let insertedDocs = [];
  try {
    insertedDocs = await Departure.insertMany(docs, { ordered: false });
  } catch (err) {
    // Mongoose 9 sets err.insertedDocs with the documents that were
    // successfully inserted even when ordered:false throws on duplicates.
    const writeErrors = err.writeErrors || [];
    const allDuplicateKey = writeErrors.length > 0 && writeErrors.every((we) => we.code === 11000);
    const singleDuplicateKey = !writeErrors.length && err.code === 11000;

    if (!allDuplicateKey && !singleDuplicateKey) {
      // A non-duplicate-key failure (connection, validation, etc.) – rethrow
      throw err;
    }

    // Recover the docs that were successfully inserted
    insertedDocs = Array.isArray(err.insertedDocs) ? err.insertedDocs : [];

    // Each code-11000 write error is a duplicate-key race
    const raceCount = writeErrors.length > 0 ? writeErrors.length : 1;
    skippedExisting += raceCount;
  }

  const created = insertedDocs.length;

  // Sort inserted docs by startsAt to determine first/last timestamps
  const sortedInserted = insertedDocs
    .map((d) => (typeof d.toObject === 'function' ? d.toObject() : d))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  return res.status(201).json({
    success: true,
    data: {
      created,
      skippedExisting,
      skippedPast,
      firstStartsAt: created > 0 ? new Date(sortedInserted[0].startsAt).toISOString() : null,
      lastStartsAt: created > 0 ? new Date(sortedInserted[created - 1].startsAt).toISOString() : null,
    },
  });
});
