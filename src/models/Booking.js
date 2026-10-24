// src/models/Booking.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const emailValidator = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, required: true, trim: true, lowercase: true, match: emailValidator, maxlength: 200 },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
   reference: { type: String },
  departure: { type: mongoose.Schema.Types.ObjectId, ref: 'Departure', required: true },
  customer: { type: customerSchema, required: true },
  adults: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'adults must be integer' } },
  children: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'children must be integer' } },
  totalPrice: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'AED', trim: true, maxlength: 10 },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  notes: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

// Generate unique reference before validation (async, no next())
bookingSchema.pre('validate', async function () {
  if (!this.isNew) return; // only generate for new docs
  if (!this.reference) {
    // Generate reference matching required pattern
    const candidate = 'DC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    if (/^DC-[A-Z0-9]{8}$/.test(candidate)) {
      this.reference = candidate;
    }
  }
});

// Indexes
bookingSchema.index({ reference: 1 }, { unique: true });
bookingSchema.index({ departure: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ 'customer.email': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
