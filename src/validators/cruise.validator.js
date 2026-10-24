// src/validators/cruise.validator.js
'use strict';

const { z } = require('zod');

const CATEGORIES = ['dinner', 'sightseeing', 'private-charter', 'other'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_RE = /^https:\/\//;

// ---------------------------------------------------------------------------
// Shared field definitions
// ---------------------------------------------------------------------------
const titleField = z.string({ required_error: 'title is required' }).trim().min(1).max(200);
const slugField = z
  .string({ required_error: 'slug is required' })
  .trim()
  .toLowerCase()
  .min(1)
  .max(200)
  .regex(SLUG_RE, 'slug must be lowercase letters, numbers and hyphens only');
const shortDescField = z.string().trim().max(500).optional();
const descField = z.string().trim().optional();
const categoryField = z.enum(CATEGORIES).optional();
const departurePointField = z.string().trim().max(200).optional();
const durationField = z.number().int().min(1).optional();
const adultPriceField = z.number({ required_error: 'adultPrice is required' }).min(0);
const childPriceField = z.number({ required_error: 'childPrice is required' }).min(0);
const currencyField = z.string().trim().max(10).optional();
const imageSchema = z.object({ url: z.string().trim().max(500), alt: z.string().trim().max(200).optional() });
const faqSchema = z.object({
  question: z.string().trim().max(300),
  answer: z.string().trim().max(1000),
});
const inclusionsField = z.array(z.string().trim().max(200)).optional();
const imagesField = z.array(imageSchema).optional();
const faqsField = z.array(faqSchema).optional();
const seoTitleField = z.string().trim().max(70).optional();
const seoDescField = z.string().trim().max(160).optional();
const isActiveField = z.boolean().optional();
const menuUrlField = z
  .string().trim().max(500)
  .regex(HTTPS_RE, 'menuUrl must start with https://')
  .optional();
const mapUrlField = z
  .string().trim().max(500)
  .regex(HTTPS_RE, 'mapUrl must start with https://')
  .optional();
const pickupAvailableField = z.boolean().optional();
const sortOrderField = z.number().int().optional();

// ---------------------------------------------------------------------------
// Create schema – required fields match the model
// ---------------------------------------------------------------------------
const cruiseCreateSchema = z
  .object({
    title: titleField,
    slug: slugField,
    shortDescription: shortDescField,
    description: descField,
    category: categoryField,
    departurePoint: departurePointField,
    durationMinutes: durationField,
    adultPrice: adultPriceField,
    childPrice: childPriceField,
    currency: currencyField,
    images: imagesField,
    inclusions: inclusionsField,
    faqs: faqsField,
    seoTitle: seoTitleField,
    seoDescription: seoDescField,
    isActive: isActiveField,
    menuUrl: menuUrlField,
    mapUrl: mapUrlField,
    pickupAvailable: pickupAvailableField,
    sortOrder: sortOrderField,
  })
  .strict(); // reject unknown fields

// ---------------------------------------------------------------------------
// Update schema – every field optional, at least one required
// ---------------------------------------------------------------------------
const cruiseUpdateSchema = z
  .object({
    title: titleField.optional(),
    slug: slugField.optional(),
    shortDescription: shortDescField,
    description: descField,
    category: categoryField,
    departurePoint: departurePointField,
    durationMinutes: durationField,
    adultPrice: adultPriceField.optional(),
    childPrice: childPriceField.optional(),
    currency: currencyField,
    images: imagesField,
    inclusions: inclusionsField,
    faqs: faqsField,
    seoTitle: seoTitleField,
    seoDescription: seoDescField,
    isActive: isActiveField,
    menuUrl: menuUrlField,
    mapUrl: mapUrlField,
    pickupAvailable: pickupAvailableField,
    sortOrder: sortOrderField,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

module.exports = { cruiseCreateSchema, cruiseUpdateSchema };
