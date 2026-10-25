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

// ---------------------------------------------------------------------------
// Bulk schedule schema  –  POST /api/admin/departures/bulk
// ---------------------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECTID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Parse a "YYYY-MM-DD" string using UTC arithmetic so the server's local
 * timezone cannot affect the result.  Returns null for invalid calendar dates.
 */
function parseCalendarDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [year, month, day] = str.split('-').map(Number);
  // Reconstruct via Date.UTC and verify round-trip to catch rolled-over dates
  // such as 2026-02-31 (which Date would silently move to 2026-03-03).
  const ts = Date.UTC(year, month - 1, day);
  const d = new Date(ts);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, ts };
}

const calendarDateField = (label) =>
  z.string().superRefine((val, ctx) => {
    if (parseCalendarDate(val) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be a real calendar date in YYYY-MM-DD format`,
      });
    }
  });

const departureBulkSchema = z
  .object({
    // Required fields
    cruise: z
      .string({ required_error: 'cruise is required' })
      .regex(OBJECTID_RE, 'cruise must be a 24-character hexadecimal MongoDB ObjectId'),
    startDate: calendarDateField('startDate'),
    endDate: calendarDateField('endDate'),
    capacity: z
      .number({ required_error: 'capacity is required' })
      .int('capacity must be a whole number')
      .min(1, 'capacity must be at least 1')
      .max(1000, 'capacity must be at most 1000'),
    times: z
      .array(z.string().regex(TIME_RE, 'each time must be in HH:mm format (24-hour clock)'))
      .min(1, 'times must contain at least 1 entry')
      .max(6, 'times must contain at most 6 entries'),

    // Optional fields with defaults
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'daysOfWeek must not be empty')
      .max(7, 'daysOfWeek must contain at most 7 entries')
      .optional(),
    adultPrice: z.number().min(0).optional(),
    childPrice: z.number().min(0).optional(),
    status: z.enum(['open', 'closed']).default('open'),
    dryRun: z.boolean().default(false),
  })
  .strict() // reject unknown keys such as seatsRemaining
  .superRefine((data, ctx) => {
    // Reject duplicate times
    const timesSet = new Set(data.times);
    if (timesSet.size !== data.times.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'times must not contain duplicates',
        path: ['times'],
      });
    }

    // Reject duplicate weekdays (if provided)
    if (data.daysOfWeek !== undefined) {
      const dowSet = new Set(data.daysOfWeek);
      if (dowSet.size !== data.daysOfWeek.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'daysOfWeek must not contain duplicates',
          path: ['daysOfWeek'],
        });
      }
    }

    // Date comparisons and range check – only if both dates parse cleanly.
    const start = parseCalendarDate(data.startDate);
    const end = parseCalendarDate(data.endDate);
    if (start !== null && end !== null) {
      if (end.ts < start.ts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate must not be before startDate',
          path: ['endDate'],
        });
      } else {
        // Inclusive range = (end.ts - start.ts) / ONE_DAY_MS + 1
        const rangeDays = (end.ts - start.ts) / 86_400_000 + 1;
        if (rangeDays > 92) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'The date range must not exceed 92 days',
            path: ['endDate'],
          });
        }
      }
    }
  })
  // Apply default: all days when daysOfWeek is omitted
  .transform((data) => ({
    ...data,
    daysOfWeek: data.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
  }));

module.exports = { departureCreateSchema, departureUpdateSchema, departureBulkSchema };
