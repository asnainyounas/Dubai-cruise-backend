// src/controllers/auth.controller.js
'use strict';

const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/token');

// A bcrypt hash of an arbitrary string, used to equalise response time when
// the email is not found (prevents timing-based user enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const INVALID_CREDENTIALS = 'Invalid email or password';

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Type-check prevents object injection like { email: { $gt: "" } }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return next(new AppError('Email and password are required', 400));
  }

  const normalised = email.toLowerCase().trim();

  // Always use +password because select: false hides it by default
  const user = await AdminUser.findOne({ email: normalised }).select('+password');

  // Constant-time compare regardless of whether the email was found
  const hashToCompare = user ? user.password : DUMMY_HASH;
  const isMatch = await bcrypt.compare(password, hashToCompare);

  // Inactive users get the same generic message
  if (!user || !isMatch || !user.isActive) {
    return next(new AppError(INVALID_CREDENTIALS, 401));
  }

  // Update last login timestamp (fire-and-forget, non-blocking)
  AdminUser.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })
  .exec()
  .catch(() => {});
  const token = signToken(user);
  setAuthCookie(res, token);

  return res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
exports.logout = (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out' });
};

// ---------------------------------------------------------------------------
// GET /api/auth/me  (protected — req.user already set by protect middleware)
// ---------------------------------------------------------------------------
exports.me = (req, res) => {
  const { _id, name, email, role } = req.user;
  return res.status(200).json({
    success: true,
    user: { id: _id, name, email, role },
  });
};
