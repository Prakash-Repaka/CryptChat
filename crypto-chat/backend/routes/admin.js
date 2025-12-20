const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');

const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/logger');

// Admin Middleware
const adminAuth = async (req, res, next) => {
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

// Delete User
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.id);
        if (!userToDelete) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (userToDelete.isAdmin) {
            return res.status(403).json({ message: 'Cannot delete an admin user' });
        }

        await User.findByIdAndDelete(req.params.id);

        // Also delete their messages? For MVP just logs.
        await logActivity(req.user, 'ADMIN', 'USER_DELETED', `Admin deleted user: ${userToDelete.username}`);

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Active Rooms
router.get('/rooms', adminAuth, async (req, res) => {
    try {
        const rooms = await Message.distinct('roomId', { roomId: { $ne: null } });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get System Stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const messageCount = await Message.countDocuments();
        const activityCount = await ActivityLog.countDocuments();
        const roomCount = (await Message.distinct('roomId', { roomId: { $ne: null } })).length;
        res.json({ userCount, messageCount, activityCount, roomCount });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Activity Logs
router.get('/activities', adminAuth, async (req, res) => {
    try {
        const activities = await ActivityLog.find()
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(activities);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
