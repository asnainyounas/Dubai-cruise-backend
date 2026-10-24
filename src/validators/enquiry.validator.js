// src/validators/enquiry.validator.js
'use strict';

const { z } = require('zod');

const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

// ---------------------------------------------------------------------------
// Public – POST /api/enquiries
// ---------------------------------------------------------------------------
const enquiryCreateSchema = z
  .object({
    name: z
      .string({ required_error: 'name is required' })
      .trim()
      .min(2, 'name must be at least 2 characters')
      .max(100, 'name cannot exceed 100 characters'),
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .email('email must be a valid email address'),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'phone is not a valid phone number')
      .optional(),
    message: z
      .string({ required_error: 'message is required' })
      .trim()
      .min(5, 'message must be at least 5 characters')
      .max(2000, 'message cannot exceed 2000 characters'),
    website: z.string().optional(), // honeypot
  })
  .strict();

// ---------------------------------------------------------------------------
// Admin – PATCH /api/admin/enquiries/:id
// ---------------------------------------------------------------------------
const enquiryStatusSchema = z
  .object({
    status: z.enum(['new', 'handled'], {
      required_error: 'status is required',
      invalid_type_error: 'status must be "new" or "handled"',
    }),
  })
  .strict();

module.exports = { enquiryCreateSchema, enquiryStatusSchema };
