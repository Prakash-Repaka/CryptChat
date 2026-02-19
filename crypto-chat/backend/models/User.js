const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicKey: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  contactNumber: { type: String, required: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String },
  // User Profile
  profilePic: { type: String, default: '' },       // base64 data URL
  bio: { type: String, default: '', maxlength: 200 },
  statusMessage: { type: String, default: '🔒 Encrypted & Private' },
  sessions: [{
    deviceId: String,
    ip: String,
    lastSeen: { type: Date, default: Date.now },
    userAgent: String
  }]
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
