const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const User = require('../models/User');

// Create a new room
router.post('/', auth, async (req, res) => {
    try {
        const { roomId, name } = req.body;
        if (!roomId) return res.status(400).json({ message: 'Room ID is required' });

        // Ensure user exists
        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Check if room already exists
        let room = await Room.findOne({ roomId });
        if (room) {
            return res.status(400).json({ message: 'Room already exists' });
        }

        room = new Room({
            roomId: roomId.toUpperCase(),
            name: name || roomId.toUpperCase(),
            owner: user._id,
            ownerUsername: user.username,
            participants: [user.username]
        });

        await room.save();
        res.json(room);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get room details
router.get('/:roomId', auth, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });
        if (!room) return res.status(404).json({ message: 'Room not found' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Kick a user from a room
router.post('/:roomId/kick', auth, async (req, res) => {
    try {
        const { username } = req.body;
        const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });

        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Only owner can kick
        if (room.owner.toString() !== req.user) {
            return res.status(403).json({ message: 'Only the room owner can kick users' });
        }

        // Emit socket event to kick user
        const io = req.app.get('io');
        const connectedUsers = req.app.get('connectedUsers');
        const targetSocketId = connectedUsers[username];

        if (targetSocketId) {
            io.to(targetSocketId).emit('kicked', { roomId: room.roomId });
            // Force the socket to leave the room room
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.leave(room.roomId);
        }

        res.json({ success: true, message: `User ${username} kicked` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Ban a user from a room
router.post('/:roomId/ban', auth, async (req, res) => {
    try {
        const { username } = req.body;
        const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });

        if (!room) return res.status(404).json({ message: 'Room not found' });

        if (room.owner.toString() !== req.user) {
            return res.status(403).json({ message: 'Only the room owner can ban users' });
        }

        if (!room.bannedUsers.includes(username)) {
            room.bannedUsers.push(username);
            await room.save();
        }

        // Also kick them
        const io = req.app.get('io');
        const connectedUsers = req.app.get('connectedUsers');
        const targetSocketId = connectedUsers[username];
        if (targetSocketId) {
            io.to(targetSocketId).emit('banned', { roomId: room.roomId });
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.leave(room.roomId);
        }

        res.json({ success: true, message: `User ${username} banned from room` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
