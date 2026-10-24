// src/controllers/enquiry.controller.js
'use strict';

const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { withId } = require('../utils/serialize');
const { enquiryCreateSchema, enquiryStatusSchema } = require('../validators/enquiry.validator');

// ---------------------------------------------------------------------------
// PUBLIC: POST /api/enquiries
// ---------------------------------------------------------------------------
const createEnquiry = asyncHandler(async (req, res) => {
  const body = enquiryCreateSchema.parse(req.body);

  // Honeypot: non-empty website field → silent success without saving
  if (body.website && typeof body.website === 'string' && body.website.trim().length > 0) {
    return res.status(201).json({ success: true, data: { message: 'Enquiry received' } });
  }

  const { name, email, phone, message } = body;

  const doc = { name, email, message };
  if (phone !== undefined) doc.phone = phone;

  await Enquiry.create(doc);

  return res.status(201).json({ success: true, data: { message: 'Enquiry received' } });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/enquiries
// ---------------------------------------------------------------------------
const adminListEnquiries = asyncHandler(async (req, res) => {
  const { status, page = '1', limit = '20' } = req.query;

  const filter = {};
  if (status !== undefined) {
    const VALID_STATUSES = ['new', 'handled'];
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: enquiries.map(withId),
    meta: { page: pageNum, limit: limitNum, total },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: PATCH /api/admin/enquiries/:id
// ---------------------------------------------------------------------------
const adminUpdateEnquiry = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const { status } = enquiryStatusSchema.parse(req.body);

  const enquiry = await Enquiry.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  ).select('-__v');

  if (!enquiry) throw new AppError('Enquiry not found', 404);

  return res.json({ success: true, data: withId(enquiry) });
});

module.exports = { createEnquiry, adminListEnquiries, adminUpdateEnquiry };
