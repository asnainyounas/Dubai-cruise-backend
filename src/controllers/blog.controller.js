// src/controllers/blog.controller.js
'use strict';

const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { withId } = require('../utils/serialize');
const {
  blogCreateSchema,
  blogUpdateSchema,
  blogQuerySchema,
  blogSlugParamSchema,
} = require('../validators/blog.validator');

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/blog
// Only isPublished posts with publishedAt <= now.
// ?page= (default 1) and ?limit= (default 10, max 50, otherwise 400).
// Newest first. Return: title, slug, excerpt, coverImage, publishedAt.
// Response meta: { page, limit, total }.
// ---------------------------------------------------------------------------
const listBlogPosts = asyncHandler(async (req, res) => {
  const { page, limit } = blogQuerySchema.parse(req.query);
  const skip = (page - 1) * limit;

  const filter = {
    isPublished: true,
    publishedAt: { $lte: new Date() },
  };

  const [posts, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title slug excerpt coverImage publishedAt -_id')
      .lean(),
    BlogPost.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: posts,
    meta: { page, limit, total },
  });
});

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/blog/:slug
// Validate slug format (400). Only published posts, else 404.
// Return: title, slug, excerpt, content, coverImage, seoTitle,
// seoDescription, publishedAt, updatedAt.
// ---------------------------------------------------------------------------
const getBlogPostBySlug = asyncHandler(async (req, res) => {
  const parsedSlug = blogSlugParamSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    throw new AppError('Invalid slug format', 400);
  }
  const slug = parsedSlug.data;

  const post = await BlogPost.findOne({
    slug,
    isPublished: true,
    publishedAt: { $lte: new Date() },
  })
    .select('title slug excerpt content coverImage seoTitle seoDescription publishedAt updatedAt -_id')
    .lean();

  if (!post) {
    throw new AppError('Blog post not found', 404);
  }

  return res.json({
    success: true,
    data: post,
  });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/blog
// All posts, newest first, paged like above, without the content field.
// ---------------------------------------------------------------------------
const adminListBlogPosts = asyncHandler(async (req, res) => {
  const { page, limit } = blogQuerySchema.parse(req.query);
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    BlogPost.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-content -__v')
      .lean(),
    BlogPost.countDocuments(),
  ]);

  return res.json({
    success: true,
    data: posts.map(withId),
    meta: { page, limit, total },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/blog/:id
// One post, full.
// ---------------------------------------------------------------------------
const adminGetBlogPost = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const post = await BlogPost.findById(req.params.id).select('-__v').lean();
  if (!post) {
    throw new AppError('Blog post not found', 404);
  }

  return res.json({
    success: true,
    data: withId(post),
  });
});

// ---------------------------------------------------------------------------
// ADMIN: POST /api/admin/blog
// Create post. If isPublished is true, set publishedAt = now.
// ---------------------------------------------------------------------------
const adminCreateBlogPost = asyncHandler(async (req, res) => {
  const data = blogCreateSchema.parse(req.body);

  if (data.isPublished === true) {
    data.publishedAt = new Date();
  }

  const post = await BlogPost.create(data);

  return res.status(201).json({
    success: true,
    data: withId(post),
  });
});

// ---------------------------------------------------------------------------
// ADMIN: PATCH /api/admin/blog/:id
// Update post. If post becomes published and has no publishedAt, set publishedAt = now.
// If unpublished later, keep publishedAt as it is.
// ---------------------------------------------------------------------------
const adminUpdateBlogPost = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const data = blogUpdateSchema.parse(req.body);

  const existingPost = await BlogPost.findById(req.params.id);
  if (!existingPost) {
    throw new AppError('Blog post not found', 404);
  }

  if (data.isPublished === true && !existingPost.publishedAt) {
    data.publishedAt = new Date();
  }

  const updatedPost = await BlogPost.findByIdAndUpdate(
    req.params.id,
    data,
    { new: true, runValidators: true }
  ).select('-__v');

  return res.json({
    success: true,
    data: withId(updatedPost),
  });
});

// ---------------------------------------------------------------------------
// ADMIN: DELETE /api/admin/blog/:id
// Delete post.
// ---------------------------------------------------------------------------
const adminDeleteBlogPost = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid id', 400);
  }

  const post = await BlogPost.findByIdAndDelete(req.params.id);
  if (!post) {
    throw new AppError('Blog post not found', 404);
  }

  return res.json({
    success: true,
    data: null,
  });
});

module.exports = {
  listBlogPosts,
  getBlogPostBySlug,
  adminListBlogPosts,
  adminGetBlogPost,
  adminCreateBlogPost,
  adminUpdateBlogPost,
  adminDeleteBlogPost,
};
