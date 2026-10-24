// src/validators/departure.validator.js
'use strict';

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Shared field definitions
// ---------------------------------------------------------------------------
const startsAtField = z
  .string({ required_error: 'startsAt is required' })
  .datetime({ offset: true, message: 'startsAt must be a valid ISO 8601 date-time string' })
  .refine((v) => new Date(v) > new Date(), { message: 'startsAt must be in the future' });

const capacityField = z
  .number({ required_error: 'capacity is required' })
  .int('capacity must be a whole number')
  .min(1, 'capacity must be at least 1');

const statusField = z.enum(['open', 'closed', 'cancelled']).optional();
const priceField = z.number().min(0).optional();

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------
const departureCreateSchema = z
  .object({
    cruise: z.string({ required_error: 'cruise is required' }).min(1),
    startsAt: startsAtField,
    capacity: capacityField,
    // seatsRemaining is NOT accepted from the client – set server-side
    adultPrice: priceField,
    childPrice: priceField,
    status: statusField,
  })
  .strict();

// ---------------------------------------------------------------------------
// Update schema – only allowed fields; seatsRemaining and cruise are blocked
// ---------------------------------------------------------------------------
const departureUpdateSchema = z
  .object({
    startsAt: startsAtField.optional(),
    status: statusField,
    adultPrice: priceField,
    childPrice: priceField,
    capacity: capacityField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

module.exports = { departureCreateSchema, departureUpdateSchema };
