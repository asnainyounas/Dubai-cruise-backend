// src/routes/admin.routes.js
'use strict';

const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const cruiseController = require('../controllers/cruise.controller');
const departureController = require('../controllers/departure.controller');
const bookingController = require('../controllers/booking.controller');
const enquiryController = require('../controllers/enquiry.controller');
const blogController = require('../controllers/blog.controller');

const router = express.Router();

// All admin routes require a valid session and the "admin" role
router.use(protect, restrictTo('admin'));

// ---------------------------------------------------------------------------
// Cruise admin routes  →  /api/admin/cruises
// ---------------------------------------------------------------------------
router.get('/cruises', cruiseController.adminListCruises);
router.post('/cruises', cruiseController.adminCreateCruise);
router.patch('/cruises/:id', cruiseController.adminUpdateCruise);
router.delete('/cruises/:id', cruiseController.adminDeleteCruise);

// ---------------------------------------------------------------------------
// Departure admin routes  →  /api/admin/departures
// ---------------------------------------------------------------------------
router.get('/departures', departureController.adminListDepartures);
router.post('/departures', departureController.adminCreateDeparture);
// bulk MUST be registered before /:id so "bulk" is not matched as an ObjectId
router.post('/departures/bulk', departureController.adminBulkCreateDepartures);
router.patch('/departures/:id', departureController.adminUpdateDeparture);
router.delete('/departures/:id', departureController.adminDeleteDeparture);

// ---------------------------------------------------------------------------
// Booking admin routes  →  /api/admin/bookings
// ---------------------------------------------------------------------------
router.get('/bookings', bookingController.adminListBookings);
router.get('/bookings/:id', bookingController.adminGetBooking);
router.patch('/bookings/:id/status', bookingController.adminUpdateBookingStatus);

// ---------------------------------------------------------------------------
// Enquiry admin routes  →  /api/admin/enquiries
// ---------------------------------------------------------------------------
router.get('/enquiries', enquiryController.adminListEnquiries);
router.patch('/enquiries/:id', enquiryController.adminUpdateEnquiry);

// ---------------------------------------------------------------------------
// Blog admin routes  →  /api/admin/blog
// ---------------------------------------------------------------------------
router.get('/blog', blogController.adminListBlogPosts);
router.get('/blog/:id', blogController.adminGetBlogPost);
router.post('/blog', blogController.adminCreateBlogPost);
router.patch('/blog/:id', blogController.adminUpdateBlogPost);
router.delete('/blog/:id', blogController.adminDeleteBlogPost);

module.exports = router;
