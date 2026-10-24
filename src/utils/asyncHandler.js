// src/utils/asyncHandler.js
'use strict';

/**
 * Wraps an async route handler so any rejected promise is forwarded to next().
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 *
 * @param {Function} fn - Async Express route handler.
 * @returns {Function} Express middleware that catches errors.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
