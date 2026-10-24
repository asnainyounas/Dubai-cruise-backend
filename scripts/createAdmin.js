const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// scripts/createAdmin.js
'use strict';

/**
 * Seed script to create an initial admin user.
 *
 * Usage (set env vars before running):
 *   ADMIN_NAME="Alice" ADMIN_EMAIL="alice@example.com" ADMIN_PASSWORD="..." \
 *     node scripts/createAdmin.js
 *
 * On Windows PowerShell:
 *   $env:ADMIN_NAME="Alice"; $env:ADMIN_EMAIL="alice@example.com"; `
 *   $env:ADMIN_PASSWORD="..."; node scripts/createAdmin.js
 *
 * Rules:
 *   - Reads credentials exclusively from environment variables.
 *   - Never prints the password.
 *   - Exits without changes if an admin with that email already exists.
 */

// env.js will exit the process if MONGODB_URI / JWT_SECRET are missing/invalid.
require('../src/config/env');

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AdminUser = require('../src/models/AdminUser');

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  // Validate required seed variables
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'Error: ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must all be set ' +
      'as environment variables before running this script.'
    );
    process.exit(1);
  }

  const normalised = ADMIN_EMAIL.toLowerCase().trim();

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await AdminUser.findOne({ email: normalised });
  if (existing) {
    console.log(`Admin already exists: ${normalised}  — no changes made.`);
    await mongoose.disconnect();
    return;
  }

  await AdminUser.create({
    name: ADMIN_NAME.trim(),
    email: normalised,
    password: ADMIN_PASSWORD, // hashed by pre-save hook in AdminUser model
    role: 'admin',
  });

  console.log(`Admin created: ${normalised}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('createAdmin failed:', err.message);
  process.exit(1);
});
