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

// Ban user
router.post('/users/:id/ban', adminAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        const targetUserId = req.params.id;
        const adminId = req.user;

        if (targetUserId === adminId) {
            return res.status(400).json({ message: 'You cannot ban yourself' });
        }

        const user = await User.findByIdAndUpdate(
            targetUserId,
            { isBanned: true, banReason: reason || 'No reason provided' },
            { new: true, runValidators: false }
        );

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isAdmin) return res.status(403).json({ message: 'Cannot ban an admin' });

        // Find admin username for logging
        const admin = await User.findById(adminId);
        const adminName = admin ? admin.username : 'Admin';

        await logActivity(adminId, adminName, 'USER_BANNED', `Admin ${adminName} banned user: ${user.username}. Reason: ${user.banReason}`);

        res.json({ message: 'User banned successfully' });
    } catch (err) {
        console.error('[AdminBanError]', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Unban user
router.post('/users/:id/unban', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isBanned: false, banReason: null },
            { new: true, runValidators: false }
        );

        if (!user) return res.status(404).json({ message: 'User not found' });

        const admin = await User.findById(req.user);
        const adminName = admin ? admin.username : 'Admin';

        await logActivity(req.user, adminName, 'USER_UNBANNED', `Admin ${adminName} unbanned user: ${user.username}`);

        res.json({ message: 'User unbanned successfully' });
    } catch (err) {
        console.error('[AdminUnbanError]', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Revoke User Session
router.post('/users/:id/sessions/:sessionId/revoke', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $pull: { sessions: { _id: req.params.sessionId } } },
            { new: true, runValidators: false }
        );

        if (!user) return res.status(404).json({ message: 'User not found' });

        await logActivity(req.user, 'ADMIN', 'SESSION_REVOKED', `Admin revoked a session for user: ${user.username}`);
        res.json({ message: 'Session revoked successfully' });
    } catch (err) {
        console.error('[AdminRevokeError]', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Get User Sessions
router.get('/users/:id/sessions', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.sessions);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Global Announcement
router.post('/announcements', adminAuth, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    try {
        const io = req.app.get('socketio');
        if (io) {
            io.emit('systemAnnouncement', {
                message,
                sender: 'System Admin',
                timestamp: new Date().toISOString()
            });
        }

        await logActivity(req.user, 'ADMIN', 'GLOBAL_ANNOUNCEMENT', `Admin sent global announcement: ${message.substring(0, 50)}...`);
        res.json({ message: 'Announcement sent to all users' });
    } catch (err) {
        console.error('Announcement error:', err);
        res.status(500).json({ message: 'Failed to send announcement' });
    }
});

module.exports = router;
