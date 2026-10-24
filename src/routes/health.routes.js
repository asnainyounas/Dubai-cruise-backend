// src/routes/health.routes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    database: dbState,
  });
});

module.exports = router;
