const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

const auth = require('../middleware/auth');

// Send message
router.post('/', auth, async (req, res) => {
  const { receiverUsername, encryptedMessage, encryptedKey } = req.body;
  try {
    const receiver = await User.findOne({ username: receiverUsername });
    if (!receiver) {
      return res.status(400).json({ message: 'Receiver not found' });
    }
    const message = new Message({
      sender: req.user,
      receiver: receiver._id,
      encryptedMessage,
      encryptedKey,
    });
    await message.save();

    // Populate sender for emission
    await message.populate('sender', 'username');

    // Emit to receiver if connected
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    if (connectedUsers[receiverUsername]) {
      io.to(connectedUsers[receiverUsername]).emit('newMessage', message);
    }

    res.json({ message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.find({ receiver: req.user }).populate('sender', 'username');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
