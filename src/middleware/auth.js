// src/middleware/auth.js
'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const AdminUser = require('../models/AdminUser');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const NOT_AUTHENTICATED = 'Not authenticated';

/**
 * protect middleware
 *
 * Reads the JWT exclusively from the HttpOnly cookie "token".
 * Attaches the AdminUser document (without password) to req.user.
 * Responds 401 for any failure — missing token, bad signature, expired,
 * user deleted, or user deactivated.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return next(new AppError(NOT_AUTHENTICATED, 401));
  }

  let decoded;
  try {
   decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (_err) {
    // Covers JsonWebTokenError and TokenExpiredError
    return next(new AppError(NOT_AUTHENTICATED, 401));
  }

  const user = await AdminUser.findById(decoded.id).select('-password');

  if (!user || !user.isActive) {
    return next(new AppError(NOT_AUTHENTICATED, 401));
  }

  req.user = user;
  next();
});

/**
 * restrictTo(...roles) middleware factory
 *
 * Must be used after protect. Responds 403 if req.user.role is not in
 * the allowed roles list.
 *
 * @param {...string} roles - Allowed role values (e.g. 'admin', 'staff').
 * @returns {Function} Express middleware.
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user && req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

module.exports = { protect, restrictTo };
