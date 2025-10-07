const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Send message
router.post('/', auth, async (req, res) => {
  const { receiverUsername, encryptedMessage } = req.body;
  try {
    const receiver = await User.findOne({ username: receiverUsername });
    if (!receiver) {
      return res.status(400).json({ message: 'Receiver not found' });
    }
    const message = new Message({
      sender: req.user,
      receiver: receiver._id,
      encryptedMessage,
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
