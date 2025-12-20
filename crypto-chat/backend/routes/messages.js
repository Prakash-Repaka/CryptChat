const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

const auth = require('../middleware/auth');

const { logActivity } = require('../utils/logger');
const { messageLimiter } = require('../middleware/rateLimiter');

// Send message
router.post('/', [auth, messageLimiter], async (req, res) => {
  const { receiverUsername, roomId, encryptedMessage, encryptedKey, expiryMinutes, encryptedFileData, fileName, fileType, ephemeralPublicKey } = req.body;
  try {
    let receiverId = null;
    let senderUsername = 'Unknown';
    let expiresAt = null;

    if (expiryMinutes && !isNaN(expiryMinutes)) {
      expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    }

    try {
      const sender = await User.findById(req.user);
      if (sender) senderUsername = sender.username;
    } catch (e) {
      console.error("Error finding sender:", e);
    }

    if (receiverUsername) {
      const receiver = await User.findOne({ username: receiverUsername });
      if (!receiver) {
        return res.status(400).json({ message: 'Receiver not found' });
      }
      receiverId = receiver._id;
    } else if (!roomId) {
      return res.status(400).json({ message: 'Receiver or Room ID required' });
    }

    const message = new Message({
      sender: req.user,
      receiver: receiverId,
      roomId: roomId,
      encryptedMessage,
      encryptedKey,
      encryptedFileData,
      fileName,
      fileType,
      ephemeralPublicKey,
      expiresAt,
    });

    await message.save();

    await logActivity(req.user, senderUsername, 'MESSAGE_SENT', `Sent ${roomId ? 'room' : 'direct'} message. Room: ${roomId || 'N/A'}`);

    // Populate sender for emission
    await message.populate('sender', 'username');
    if (message.receiver) await message.populate('receiver', 'username');

    // Emit logic
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    if (roomId) {
      // Emit to room
      io.to(roomId).emit('newMessage', message);
      console.log(`[Socket] Broadcasted message to room ${roomId}`);
    } else if (receiverId && connectedUsers[receiverUsername]) {
      // Direct Message
      io.to(connectedUsers[receiverUsername]).emit('newMessage', message);
    }

    res.json({ message: 'Message sent' });
  } catch (err) {
    console.error("Critical Backend Error in POST /api/messages:", err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get messages (Filter by Room or Direct Fetch)
// Query params: ?roomId=XYZ or default to user's received messages
router.get('/', auth, async (req, res) => {
  const { roomId } = req.query;
  try {
    let messages;
    if (roomId) {
      // Fetch room messages
      messages = await Message.find({ roomId }).populate('sender', 'username').sort({ timestamp: 1 });
    } else {
      // Fetch direct messages where user is receiver or sender
      // Note: Ideally, we should fetch "Conversations", but for now fetching all involving user
      messages = await Message.find({
        $or: [{ receiver: req.user }, { sender: req.user }]
      }).populate('sender', 'username').sort({ timestamp: 1 });
    }
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
