// src/models/Cruise.js
const mongoose = require('mongoose');

const slugValidator = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true, maxlength: 500 },
  alt: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 300 },
  answer: { type: String, required: true, trim: true, maxlength: 1000 },
}, { _id: false });

const cruiseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
 slug: { type: String, required: true, trim: true},
  shortDescription: { type: String, trim: true, maxlength: 500 },
  description: { type: String, trim: true },
  category: { type: String, enum: ['dinner', 'sightseeing', 'private-charter', 'other'], default: 'other' },
  departurePoint: { type: String, trim: true, maxlength: 200 },
  durationMinutes: { type: Number, min: 1 },
  adultPrice: { type: Number, required: true, min: 0 },
  childPrice: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'AED', trim: true, maxlength: 10 },
  images: [imageSchema],
  inclusions: [{ type: String, trim: true, maxlength: 200 }],
  faqs: [faqSchema],
  seoTitle: { type: String, trim: true, maxlength: 70 },
  seoDescription: { type: String, trim: true, maxlength: 160 },
  isActive: { type: Boolean, default: true },
  menuUrl: {
    type: String, trim: true, maxlength: 500,
    match: [/^https:\/\//, 'menuUrl must start with https://'],
  },
  mapUrl: {
    type: String, trim: true, maxlength: 500,
    match: [/^https:\/\//, 'mapUrl must start with https://'],
  },
  pickupAvailable: { type: Boolean, default: false },
  sortOrder: {
    type: Number, default: 0,
    validate: { validator: Number.isInteger, message: 'sortOrder must be a whole number' },
  },
}, { timestamps: true });

cruiseSchema.index({ slug: 1 }, { unique: true });
cruiseSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('Cruise', cruiseSchema);
