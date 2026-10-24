// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const { globalLimiter } = require('./middleware/rateLimiters');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { CLIENT_URL, NODE_ENV } = require('./config/env');

const app = express();

// Trust proxy in production for rate limiting behind proxies
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (CLIENT_URL.includes(origin)) {
      return callback(null, true);
    }
       const err = new Error('Not allowed by CORS');
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Logging
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection attacks
app.use(mongoSanitize());

// Global rate limiter
app.use(globalLimiter);

// Routes
const indexRouter = require('./routes');
app.use('/api', indexRouter);

// 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

module.exports = app;
