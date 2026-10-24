// src/controllers/cruise.controller.js
'use strict';

const mongoose = require('mongoose');
const Cruise = require('../models/Cruise');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { cruiseCreateSchema, cruiseUpdateSchema } = require('../validators/cruise.validator');

const CATEGORIES = ['dinner', 'sightseeing', 'private-charter', 'other'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Fields to project for the public listing
const LIST_PROJECTION = {
  id: '$_id',
  _id: 0,
  title: 1,
  slug: 1,
  shortDescription: 1,
  category: 1,
  departurePoint: 1,
  durationMinutes: 1,
  adultPrice: 1,
  childPrice: 1,
  currency: 1,
  pickupAvailable: 1,
  'images.$': 1,        // slice handled below via aggregate
};

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/cruises
// ---------------------------------------------------------------------------
exports.listCruises = asyncHandler(async (req, res, next) => {
  const { category } = req.query;

  if (category !== undefined && !CATEGORIES.includes(category)) {
    return next(new AppError(`category must be one of: ${CATEGORIES.join(', ')}`, 400));
  }

  const filter = { isActive: true };
  if (category) filter.category = category;

  const cruises = await Cruise.find(filter)
    .sort({ sortOrder: 1, createdAt: 1 })
    .limit(50)
    .select('title slug shortDescription category departurePoint durationMinutes adultPrice childPrice currency images pickupAvailable')
    .lean();

  // Return only the first image
  const data = cruises.map(({ _id, images, ...rest }) => ({
    id: _id,
    ...rest,
    image: images && images.length > 0 ? images[0] : null,
  }));

  return res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/cruises/:slug
// ---------------------------------------------------------------------------
exports.getCruise = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;

  if (!SLUG_RE.test(slug)) {
    return next(new AppError('Invalid slug format', 400));
  }

  const cruise = await Cruise.findOne({ slug, isActive: true }).select('-__v').lean();
  if (!cruise) return next(new AppError('Cruise not found', 404));

  const { _id, ...rest } = cruise;
  return res.json({ success: true, data: { id: _id, ...rest } });
});

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/cruises/:slug/departures
// ---------------------------------------------------------------------------
exports.getCruiseDepartures = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { days: daysParam = '60' } = req.query;

  if (!SLUG_RE.test(slug)) {
    return next(new AppError('Invalid slug format', 400));
  }

  const days = parseInt(daysParam, 10);
  if (!Number.isInteger(days) || days < 1 || days > 180) {
    return next(new AppError('days must be an integer between 1 and 180', 400));
  }

  const cruise = await Cruise.findOne({ slug, isActive: true }).select('_id adultPrice childPrice currency').lean();
  if (!cruise) return next(new AppError('Cruise not found', 404));

  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Require lazy-load of Departure to avoid circular-require issues at top-level
  const Departure = require('../models/Departure');

  const departures = await Departure.find({
    cruise: cruise._id,
    status: 'open',
    startsAt: { $gt: now, $lte: until },
    seatsRemaining: { $gt: 0 },
  })
    .sort({ startsAt: 1 })
    .select('_id startsAt seatsRemaining adultPrice childPrice')
    .lean();

  const data = departures.map(({ _id, adultPrice, childPrice, ...rest }) => ({
    id: _id,
    ...rest,
    // Price: departure price if set, otherwise cruise price
    adultPrice: adultPrice !== undefined ? adultPrice : cruise.adultPrice,
    childPrice: childPrice !== undefined ? childPrice : cruise.childPrice,
    currency: cruise.currency,
  }));

  return res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/cruises
// ---------------------------------------------------------------------------
exports.adminListCruises = asyncHandler(async (_req, res) => {
  const cruises = await Cruise.find().sort({ sortOrder: 1, createdAt: 1 }).select('-__v').lean();
  const data = cruises.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  return res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// ADMIN: POST /api/admin/cruises
// ---------------------------------------------------------------------------
exports.adminCreateCruise = asyncHandler(async (req, res, next) => {
  const parsed = cruiseCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);

  const cruise = await Cruise.create(parsed.data);
  const { __v, _id, ...rest } = cruise.toObject();
  return res.status(201).json({ success: true, data: { id: _id, ...rest } });
});

// ---------------------------------------------------------------------------
// ADMIN: PATCH /api/admin/cruises/:id
// ---------------------------------------------------------------------------
exports.adminUpdateCruise = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid id', 400));

  const parsed = cruiseUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);

  const cruise = await Cruise.findByIdAndUpdate(id, parsed.data, {
    new: true,
    runValidators: true,
  }).select('-__v');

  if (!cruise) return next(new AppError('Cruise not found', 404));

  const { _id, ...rest } = cruise.toObject();
  return res.json({ success: true, data: { id: _id, ...rest } });
});

// ---------------------------------------------------------------------------
// ADMIN: DELETE /api/admin/cruises/:id  (soft-delete: set isActive = false)
// ---------------------------------------------------------------------------
exports.adminDeleteCruise = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid id', 400));

  const cruise = await Cruise.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true, runValidators: false }
  ).select('-__v');

  if (!cruise) return next(new AppError('Cruise not found', 404));

  const { _id, ...rest } = cruise.toObject();
  return res.json({ success: true, data: { id: _id, ...rest } });
});
