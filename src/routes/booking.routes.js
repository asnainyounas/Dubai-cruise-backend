// src/routes/booking.routes.js
'use strict';

const express = require('express');
const { formLimiter } = require('../middleware/rateLimiters');
const { createBooking } = require('../controllers/booking.controller');

const router = express.Router();

// POST /api/bookings  – public, rate-limited
router.post('/', formLimiter, createBooking);

module.exports = router;
