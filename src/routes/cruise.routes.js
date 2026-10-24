// src/routes/cruise.routes.js
'use strict';

const express = require('express');
const cruiseController = require('../controllers/cruise.controller');

const router = express.Router();

// GET /api/cruises
router.get('/', cruiseController.listCruises);

// GET /api/cruises/:slug
router.get('/:slug', cruiseController.getCruise);

// GET /api/cruises/:slug/departures
router.get('/:slug/departures', cruiseController.getCruiseDepartures);

module.exports = router;
