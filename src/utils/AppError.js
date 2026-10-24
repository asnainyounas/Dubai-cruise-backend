// src/utils/AppError.js
'use strict';

/**
 * Operational error class. All expected failures (bad input, auth, not found)
 * should throw an AppError so the global errorHandler formats them properly.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable message sent to the client.
   * @param {number} statusCode - HTTP status code (4xx / 5xx).
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    // Capture stack trace, excluding the constructor call itself
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
