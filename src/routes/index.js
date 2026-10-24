// src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const cruiseRoutes = require('./cruise.routes');
const bookingRoutes = require('./booking.routes');
const enquiryRoutes = require('./enquiry.routes');
const blogRoutes = require('./blog.routes');
const adminRoutes = require('./admin.routes');

// Mount routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/cruises', cruiseRoutes);     // public
router.use('/bookings', bookingRoutes);   // public
router.use('/enquiries', enquiryRoutes); // public
router.use('/blog', blogRoutes);           // public
router.use('/admin', adminRoutes);         // protected

module.exports = router;
