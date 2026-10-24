// src/utils/token.js
'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV } = require('../config/env');

const COOKIE_NAME = 'token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Cookie options shared by set and clear helpers.
 * Using a function so NODE_ENV is evaluated at call-time (useful in tests).
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS,
  };
}

/**
 * Signs a JWT for the given AdminUser document.
 * Payload contains only id and role — never email or password.
 *
 * @param {{ _id: string, role: string }} user
 * @returns {string} Signed JWT string.
 */
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Sets the HttpOnly auth cookie on the response.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

/**
 * Clears the auth cookie. Uses identical options so the browser accepts
 * the Set-Cookie header and removes the stored cookie.
 *
 * @param {import('express').Response} res
 */
function clearAuthCookie(res) {
  const { maxAge, ...options } = cookieOptions(); // no maxAge, so the cookie really expires
  res.clearCookie('token', options);
}

module.exports = { signToken, setAuthCookie, clearAuthCookie };
