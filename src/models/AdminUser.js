// src/models/AdminUser.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emailValidator = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const adminUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: emailValidator, maxlength: 200 },
  password: { type: String, required: true, minlength: 10, select: false },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
}, { timestamps: true });

// Hash password before save if modified
adminUserSchema.pre('save', async function () {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Instance method to compare password
adminUserSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Ensure password not returned in JSON
adminUserSchema.set('toJSON', {
  transform: function (doc, ret, options) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('AdminUser', adminUserSchema);
