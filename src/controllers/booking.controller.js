// src/controllers/booking.controller.js
'use strict';

const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Departure = require('../models/Departure');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { withId } = require('../utils/serialize');
const { bookingCreateSchema, bookingStatusSchema } = require('../validators/booking.validator');

// ---------------------------------------------------------------------------
// PUBLIC: POST /api/bookings
// ---------------------------------------------------------------------------
const createBooking = asyncHandler(async (req, res) => {
  // 1. Validate
  const body = bookingCreateSchema.parse(req.body);

  // Honeypot: if website is a non-empty string, silently return success without saving
  if (body.website && typeof body.website === 'string' && body.website.trim().length > 0) {
    return res.status(201).json({
      success: true,
      data: {
        message: 'Booking request received',
      },
    });
  }

  const { departureId, adults, children, customer, notes } = body;

  // Load departure and its cruise
  const departure = await Departure.findById(departureId).populate('cruise');
  if (!departure || !departure.cruise || departure.cruise.isActive === false) {
    throw new AppError('Departure not found', 404);
  }

  if (departure.status !== 'open' || new Date(departure.startsAt) <= new Date()) {
    throw new AppError('This departure is no longer available', 409);
  }

  // 2. Seats calculation (children occupy seats)
  const seats = adults + children;

  // 3. Price on server only: unit prices = departure price if set, otherwise cruise price
  const adultUnit = departure.adultPrice != null ? departure.adultPrice : departure.cruise.adultPrice;
  const childUnit = departure.childPrice != null ? departure.childPrice : departure.cruise.childPrice;
  const totalPrice = adults * adultUnit + children * childUnit;
  const currency = departure.cruise.currency || 'AED';

  // 4. Reserve seats atomically with ONE call
  const reservedDeparture = await Departure.findOneAndUpdate(
    {
      _id: departure._id,
      status: 'open',
      startsAt: { $gt: new Date() },
      seatsRemaining: { $gte: seats },
    },
    { $inc: { seatsRemaining: -seats } },
    { new: true }
  );

  if (!reservedDeparture) {
    throw new AppError('Not enough seats available', 409);
  }

  // 5 & 6. Create booking with retry (up to 3 times) and compensation
  let booking;
  try {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const bookingData = {
          departure: departure._id,
          adults,
          children,
          customer,
          totalPrice,
          currency,
          status: 'pending',
        };
        if (notes !== undefined) bookingData.notes = notes;

        // Leave reference unset so the Booking model pre-validate hook generates one
        booking = await Booking.create(bookingData);
        break;
      } catch (err) {
        const isDuplicateRef =
          err.code === 11000 &&
          ((err.keyPattern && err.keyPattern.reference) ||
           (err.message && err.message.includes('reference')));

        if (isDuplicateRef && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    // COMPENSATION: if booking creation fails for ANY reason, return seats and rethrow
    await Departure.updateOne(
      { _id: departure._id },
      { $inc: { seatsRemaining: seats } }
    );
    throw err;
  }

  // 7. Respond 201 with public summary (no customer details, no internal ids)
  return res.status(201).json({
    success: true,
    data: {
      reference: booking.reference,
      status: booking.status,
      cruiseTitle: departure.cruise.title,
      startsAt: departure.startsAt,
      adults: booking.adults,
      children: booking.children,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
    },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/bookings
// ---------------------------------------------------------------------------
const adminListBookings = asyncHandler(async (req, res) => {
  const { status, departure, from, to, page = '1', limit = '20' } = req.query;

  const filter = {};

  if (status !== undefined) {
    const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    filter.status = status;
  }

  if (departure !== undefined) {
    if (!mongoose.isValidObjectId(departure)) {
      throw new AppError('Invalid departure id', 400);
    }
    filter.departure = departure;
  }

  if (from !== undefined) {
    const d = new Date(from);
    if (isNaN(d.getTime())) {
      throw new AppError('from must be a valid ISO date', 400);
    }
    filter.createdAt = { ...filter.createdAt, $gte: d };
  }

  if (to !== undefined) {
    const d = new Date(to);
    if (isNaN(d.getTime())) {
      throw new AppError('to must be a valid ISO date', 400);
    }
    filter.createdAt = { ...filter.createdAt, $lte: d };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'departure',
        select: 'startsAt cruise',
        populate: { path: 'cruise', select: 'title' },
      })
      .select('-__v')
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: bookings.map(withId),
    meta: { page: pageNum, limit: limitNum, total },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/bookings/:id
// ---------------------------------------------------------------------------
const adminGetBooking = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const booking = await Booking.findById(req.params.id)
    .populate({
      path: 'departure',
      select: 'startsAt cruise',
      populate: { path: 'cruise', select: 'title' },
    })
    .select('-__v');

  if (!booking) throw new AppError('Booking not found', 404);

  return res.json({ success: true, data: withId(booking) });
});

// ---------------------------------------------------------------------------
// ADMIN: PATCH /api/admin/bookings/:id/status
// ---------------------------------------------------------------------------
const adminUpdateBookingStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const { status: newStatus } = bookingStatusSchema.parse(req.body);

  // CONFIRM branch: pending -> confirmed
  if (newStatus === 'confirmed') {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'confirmed' },
      { new: true }
    ).select('-__v');

    if (!booking) {
      const exists = await Booking.findById(req.params.id).select('status').lean();
      if (!exists) throw new AppError('Booking not found', 404);
      throw new AppError('Invalid status change', 409);
    }

    return res.json({ success: true, data: withId(booking) });
  }

  // CANCEL branch: pending/confirmed -> cancelled
  if (newStatus === 'cancelled') {
    // 1. Flip status atomically, returns OLD document
    const oldBooking = await Booking.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled' }
    );

    if (!oldBooking) {
      const exists = await Booking.findById(req.params.id).select('status').lean();
      if (!exists) throw new AppError('Booking not found', 404);
      throw new AppError('Booking already cancelled', 409);
    }

    // 2. Only after flip succeeds, give seats back
    await Departure.updateOne(
      { _id: oldBooking.departure },
      { $inc: { seatsRemaining: oldBooking.adults + oldBooking.children } }
    );

    const updated = await Booking.findById(req.params.id).select('-__v').lean();
    return res.json({ success: true, data: withId(updated) });
  }
});

module.exports = {
  createBooking,
  adminListBookings,
  adminGetBooking,
  adminUpdateBookingStatus,
};
