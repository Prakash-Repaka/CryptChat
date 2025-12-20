const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Signup route
router.post('/signup', async (req, res) => {
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
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username, publicKey: user.publicKey, isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
