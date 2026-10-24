// src/routes/auth.routes.js
'use strict';

const express = require('express');
const { authLimiter } = require('../middleware/rateLimiters');
const { protect } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/login – rate-limited
router.post('/login', authLimiter, authController.login);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// GET /api/auth/me – protected
router.get('/me', protect, authController.me);

module.exports = router;
