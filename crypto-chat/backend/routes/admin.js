const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');

// Admin Middleware
const adminAuth = async (req, res, next) => {
    // Basic check - in real world use signed JWT with role or DB check
    // For this MVP, we will check if the user exists and has isAdmin
    // We expect the 'auth' middleware to run BEFORE this to populate req.user

    // However, if we mount this as router.use(auth, adminAuth), we need auth middleware imported or passed.
    // Let's rely on server.js to use auth middleware for this route, OR implement check here.
    // Best practice: rely on req.user which should be the ID from JWT

    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const user = await User.findById(req.user);
        if (user && user.isAdmin) {
            next();
        } else {
            res.status(403).json({ message: "Access denied. Admin only." });
        }
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

// Get All Users
router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Exclude password
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get System Stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const messageCount = await Message.countDocuments();
        res.json({ userCount, messageCount });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
