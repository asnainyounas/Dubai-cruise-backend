// src/routes/blog.routes.js
'use strict';

const express = require('express');
const blogController = require('../controllers/blog.controller');

const router = express.Router();

// ---------------------------------------------------------------------------
// PUBLIC BLOG ROUTES  →  /api/blog
// ---------------------------------------------------------------------------
router.get('/', blogController.listBlogPosts);
router.get('/:slug', blogController.getBlogPostBySlug);

module.exports = router;
