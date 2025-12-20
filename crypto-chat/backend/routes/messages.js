const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

const auth = require('../middleware/auth');

// Send message
router.post('/', auth, async (req, res) => {
  const { receiverUsername, roomId, encryptedMessage, encryptedKey } = req.body;
  try {
    let receiverId = null;

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
    });
    await message.save();

    // Populate sender for emission
    await message.populate('sender', 'username');

    // Emit logic
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    if (roomId) {
      // Emit to room
      io.to(roomId).emit('newMessage', message);
    } else if (receiverId && connectedUsers[receiverUsername]) {
      // Direct Message
      io.to(connectedUsers[receiverUsername]).emit('newMessage', message);
    }

    res.json({ message: 'Message sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
