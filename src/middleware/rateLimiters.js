const rateLimit = require('express-rate-limit');

// Helper to generate JSON response when limit exceeded
function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
  });
}

// Global limiter: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  handler: rateLimitHandler,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers for older clients
});

// Auth limiter: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: true,
  skipSuccessfulRequests: true,
});

// Form limiter: 5 requests per 15 minutes per IP
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: true,
});

module.exports = {
  globalLimiter,
  authLimiter,
  formLimiter,
};
