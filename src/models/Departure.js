// src/models/Departure.js
const mongoose = require('mongoose');

const isInt = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const departureSchema = new mongoose.Schema({
  cruise: { type: mongoose.Schema.Types.ObjectId, ref: 'Cruise', required: true },
  startsAt: { type: Date, required: true }, // stored in UTC
  capacity: { type: Number, required: true, min: 1, validate: isInt },
  seatsRemaining: {
    type: Number,
    required: true,
    min: 0,
    validate: [
      isInt,
      {
        validator: function (value) {
          return value <= this.capacity;
        },
        message: 'seatsRemaining cannot be greater than capacity',
      },
    ],
  },
  adultPrice: { type: Number, min: 0 },
  childPrice: { type: Number, min: 0 },
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
}, { timestamps: true });

departureSchema.index({ cruise: 1, startsAt: 1 }, { unique: true });
departureSchema.index({ startsAt: 1, status: 1 });

module.exports = mongoose.model('Departure', departureSchema);