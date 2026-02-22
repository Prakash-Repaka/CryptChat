const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const router = express.Router();

const { logActivity } = require('../utils/logger');
const { authLimiter } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Signup route
router.post('/signup', authLimiter, async (req, res) => {
  const { username, password, publicKey, firstName, lastName, email, contactNumber } = req.body;

  try {
    // 0. Check Database Connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database processing error. Please ensure MongoDB is running.' });
    }

    // 1. Basic Presence Check
    if (!username || !password || !firstName || !lastName || !email || !contactNumber || !publicKey) {
      return res.status(400).json({
        message: 'All fields (Username, Password, First Name, Last Name, Email, Phone, and Security Key) are required.'
      });
    }

    // 2. Length Check
    if (username.length < 3 || password.length < 3) {
      return res.status(400).json({ message: 'Username and Password must be at least 3 characters long.' });
    }

    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    user = new User({ username, password, publicKey, firstName, lastName, email, contactNumber });
    await user.save();

    await logActivity(user._id, user.username, 'USER_SIGNUP', `User ${user.username} joined the platform.`);

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Signup Error Detail:", err);

    // Handle specific MongoDB Duplicate Key Error (Code 11000)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Username already exists. Please choose another or login.' });
    }

    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Login route
router.post('/login', authLimiter, async (req, res) => {
  const { username, password, mfaToken } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable. Please ensure MongoDB is running.' });
    }

    // Case-insensitive search by username OR email
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } },
        { email: { $regex: new RegExp(`^${username.trim()}$`, 'i') } }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'No account found with that username or email.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: `Account banned: ${user.banReason || 'Contact support.'}` });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password. Please try again.' });
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      if (!mfaToken) {
        return res.json({ requiresMFA: true, username: user.username });
      }
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaToken,
        window: 2
      });
      if (!verified) {
        return res.status(400).json({ message: 'Invalid MFA code. Please try again.' });
      }
    }

    // Register Session
    const newSession = {
      deviceId: req.body.deviceId || `DEVICE_${Date.now()}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      lastSeen: new Date()
    };
    user.sessions.unshift(newSession);
    if (user.sessions.length > 5) user.sessions.pop();
    await user.save();

    const token = jwt.sign({ id: user._id, deviceId: newSession.deviceId }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username, publicKey: user.publicKey, isAdmin: user.isAdmin, deviceId: newSession.deviceId });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});


// Setup MFA - Generate secret and QR code
router.post('/setup-mfa', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CryptChat (${username})`,
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (will be confirmed on verification)
    user.mfaSecret = secret.base32;
    await user.save();

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (err) {
    console.error('MFA Setup Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify and enable MFA
router.post('/verify-mfa', async (req, res) => {
  try {
    const { username, token } = req.body;
    const user = await User.findOne({ username });

    if (!user || !user.mfaSecret) {
      return res.status(400).json({ message: 'MFA not set up' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid MFA code' });
    }

    // Enable MFA
    user.mfaEnabled = true;
    await user.save();

    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    console.error('MFA Verification Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Disable MFA
router.post('/disable-mfa', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecret = null;
    await user.save();

    res.json({ message: 'MFA disabled successfully' });
  } catch (err) {
    console.error('MFA Disable Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
