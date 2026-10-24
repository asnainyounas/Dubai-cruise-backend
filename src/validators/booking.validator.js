// src/validators/booking.validator.js
'use strict';

const { z } = require('zod');

const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

// ---------------------------------------------------------------------------
// Public – POST /api/bookings
// ---------------------------------------------------------------------------
const bookingCreateSchema = z
  .object({
    departureId: z
      .string({ required_error: 'departureId is required' })
      .length(24, 'departureId must be a 24-character hex ObjectId')
      .regex(/^[0-9a-fA-F]{24}$/, 'departureId must be a valid ObjectId'),
    adults: z
      .number({ required_error: 'adults is required' })
      .int('adults must be an integer')
      .min(1, 'adults must be at least 1')
      .max(50, 'adults cannot exceed 50'),
    children: z
      .number()
      .int('children must be an integer')
      .min(0, 'children cannot be negative')
      .max(50, 'children cannot exceed 50')
      .default(0),
    customer: z
      .object({
        name: z
          .string({ required_error: 'customer.name is required' })
          .trim()
          .min(2, 'customer.name must be at least 2 characters')
          .max(100, 'customer.name cannot exceed 100 characters'),
        phone: z
          .string({ required_error: 'customer.phone is required' })
          .trim()
          .regex(phoneRegex, 'customer.phone is not a valid phone number'),
        email: z
          .string({ required_error: 'customer.email is required' })
          .trim()
          .email('customer.email must be a valid email address')
          .max(200, 'customer.email cannot exceed 200 characters'),
      })
      .strict(),
    notes: z.string().trim().max(500, 'notes cannot exceed 500 characters').optional(),
    website: z.string().optional(), // honeypot
  })
  .strict();

// ---------------------------------------------------------------------------
// Admin – PATCH /api/admin/bookings/:id/status
// ---------------------------------------------------------------------------
const bookingStatusSchema = z
  .object({
    status: z.enum(['confirmed', 'cancelled'], {
      required_error: 'status is required',
      invalid_type_error: 'status must be "confirmed" or "cancelled"',
    }),
  })
  .strict();

module.exports = { bookingCreateSchema, bookingStatusSchema };
