// src/middleware/errorHandler.js
'use strict';

const { NODE_ENV } = require('../config/env');

/**
 * Normalise well-known error types into { statusCode, message }.
 * Returns null if the error is not a recognised type.
 */
function normaliseError(err) {
  // Mongoose ValidationError
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
    return { statusCode: 400, message };
  }

  // Mongoose CastError (bad ObjectId etc.)
  if (err.name === 'CastError') {
    return { statusCode: 400, message: 'Invalid id' };
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return { statusCode: 409, message: 'A record with this value already exists' };
  }

  // ZodError (zod validation library)
  if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    return { statusCode: 400, message: err.issues[0].message };
  }

  return null;
}

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const normalised = normaliseError(err);

  if (normalised) {
    return res.status(normalised.statusCode).json({
      success: false,
      message: normalised.message,
    });
  }

  const statusCode =
    Number.isInteger(err.statusCode) ? err.statusCode :
    Number.isInteger(err.status) ? err.status : 500;
  const isServerError = statusCode >= 500;

  // Log the real error on the server, never send it to the client
  if (isServerError) console.error(err);

  const response = {
    success: false,
    message:
      isServerError && NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Error',
  };

  if (NODE_ENV !== 'production' && err.stack) response.stack = err.stack;

  return res.status(statusCode).json(response);
};