// src/routes/enquiry.routes.js
'use strict';

const express = require('express');
const { formLimiter } = require('../middleware/rateLimiters');
const { createEnquiry } = require('../controllers/enquiry.controller');

const router = express.Router();

// POST /api/enquiries  – public, rate-limited
router.post('/', formLimiter, createEnquiry);

module.exports = router;
