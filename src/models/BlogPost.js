// src/models/BlogPost.js
const mongoose = require('mongoose');

const slugValidator = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const coverImageSchema = new mongoose.Schema({
  url: { type: String, trim: true, maxlength: 500 },
  alt: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 200,
    match: [slugValidator, 'Invalid slug format'],
  },
  excerpt: { type: String, trim: true, maxlength: 300 },
  content: { type: String, required: true },
  coverImage: { type: coverImageSchema, default: undefined },
  seoTitle: { type: String, trim: true, maxlength: 70 },
  seoDescription: { type: String, trim: true, maxlength: 160 },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
}, { timestamps: true });

// Indexes
blogPostSchema.index({ slug: 1 }, { unique: true });
blogPostSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);

