// src/models/Enquiry.js
const mongoose = require('mongoose');

const emailValidator = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, required: true, trim: true, lowercase: true, match: emailValidator, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 20 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'handled'], default: 'new' },
}, { timestamps: true });

enquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
