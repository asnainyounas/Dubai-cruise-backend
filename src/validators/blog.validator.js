// src/validators/blog.validator.js
'use strict';

const { z } = require('zod');

// ---------------------------------------------------------------------------
// NOTE: Content is stored as MARKDOWN text.
// The frontend must render it safely without allowing raw HTML (e.g. use an
// HTML sanitizer or disable HTML rendering in the markdown parser).
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_RE = /^https:\/\//;

const titleField = z
  .string({ required_error: 'title is required' })
  .trim()
  .min(3, 'title must be between 3 and 200 characters')
  .max(200, 'title must be between 3 and 200 characters');

const slugField = z
  .string({ required_error: 'slug is required' })
  .trim()
  .max(120, 'slug must be at most 120 characters')
  .regex(SLUG_RE, 'Invalid slug format');

const excerptField = z
  .string()
  .trim()
  .max(300, 'excerpt must be at most 300 characters')
  .optional();

const contentField = z
  .string({ required_error: 'content is required' })
  .trim()
  .min(1, 'content is required')
  .max(100000, 'content must be at most 100000 characters');

const coverImageSchema = z
  .object({
    url: z
      .string({ required_error: 'url is required' })
      .trim()
      .max(500, 'url must be at most 500 characters')
      .regex(HTTPS_RE, 'url must start with https://'),
    alt: z
      .string()
      .trim()
      .max(200, 'alt must be at most 200 characters')
      .optional(),
  })
  .strict();

const coverImageField = coverImageSchema.optional();

const seoTitleField = z
  .string()
  .trim()
  .max(70, 'seoTitle must be at most 70 characters')
  .optional();

const seoDescField = z
  .string()
  .trim()
  .max(160, 'seoDescription must be at most 160 characters')
  .optional();

const isPublishedField = z.boolean().optional();

// ---------------------------------------------------------------------------
// Create schema – strict, strings trimmed
// ---------------------------------------------------------------------------
const blogCreateSchema = z
  .object({
    title: titleField,
    slug: slugField,
    excerpt: excerptField,
    content: contentField,
    coverImage: coverImageField,
    seoTitle: seoTitleField,
    seoDescription: seoDescField,
    isPublished: isPublishedField,
  })
  .strict();

// ---------------------------------------------------------------------------
// Update schema – every field optional, at least one required, strict
// ---------------------------------------------------------------------------
const blogUpdateSchema = z
  .object({
    title: titleField.optional(),
    slug: slugField.optional(),
    excerpt: excerptField,
    content: contentField.optional(),
    coverImage: coverImageField,
    seoTitle: seoTitleField,
    seoDescription: seoDescField,
    isPublished: isPublishedField,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// ---------------------------------------------------------------------------
// Query pagination schema – ?page= (default 1), ?limit= (default 10, max 50)
// ---------------------------------------------------------------------------
const blogQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1;
      },
      { message: 'page must be a positive integer' }
    )
    .transform((val) => (val !== undefined ? Number(val) : 1)),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1 && num <= 50;
      },
      { message: 'limit must be an integer between 1 and 50' }
    )
    .transform((val) => (val !== undefined ? Number(val) : 10)),
});

// ---------------------------------------------------------------------------
// Slug param schema
// ---------------------------------------------------------------------------
const blogSlugParamSchema = z
  .string({ required_error: 'slug is required' })
  .trim()
  .max(120, 'slug must be at most 120 characters')
  .regex(SLUG_RE, 'Invalid slug format');

module.exports = {
  blogCreateSchema,
  blogUpdateSchema,
  blogQuerySchema,
  blogSlugParamSchema,
};
