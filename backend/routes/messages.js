const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();
const auth = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { messageLimiter } = require('../middleware/rateLimiter');

// ── POST / — Send message ──────────────────────────────────────────────────
router.post('/', [auth, messageLimiter], async (req, res) => {
  const { receiverUsername, roomId, encryptedMessage, encryptedKey, expiryMinutes,
    encryptedFileData, fileName, fileType, ephemeralPublicKey, replyTo } = req.body;
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
    } catch (e) { console.error('Error finding sender:', e); }

    if (receiverUsername) {
      const receiver = await User.findOne({ username: receiverUsername });
      if (!receiver) return res.status(400).json({ message: 'Receiver not found' });
      receiverId = receiver._id;
    } else if (!roomId) {
      return res.status(400).json({ message: 'Receiver or Room ID required' });
    }

    const message = new Message({
      sender: req.user, receiver: receiverId, roomId,
      encryptedMessage, encryptedKey, encryptedFileData,
      fileName, fileType, ephemeralPublicKey, expiresAt,
      replyTo: replyTo || null,
    });

    await message.save();
    await logActivity(req.user, senderUsername, 'MESSAGE_SENT', `Sent ${roomId ? 'room' : 'direct'} message.`);
    await message.populate('sender', 'username profilePic');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    if (message.receiver) await message.populate('receiver', 'username');

    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    if (roomId) {
      io.to(roomId).emit('newMessage', message);
    } else if (receiverId && connectedUsers[receiverUsername]) {
      io.to(connectedUsers[receiverUsername]).emit('newMessage', message);
    }

    res.json({ message: 'Message sent', id: message._id });
  } catch (err) {
    console.error('POST /api/messages error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ── GET / — Fetch messages with pagination ────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { roomId, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  try {
    let query;
    let total;

    if (roomId) {
      query = Message.find({ roomId });
      total = await Message.countDocuments({ roomId });
    } else {
      const { recipient } = req.query;
      let filter = { $or: [{ receiver: req.user }, { sender: req.user }] };
      if (recipient) {
        const other = await User.findOne({ username: recipient });
        if (other) {
          filter = {
            $or: [
              { sender: req.user, receiver: other._id },
              { sender: other._id, receiver: req.user }
            ]
          };
        }
      }
      query = Message.find(filter);
      total = await Message.countDocuments(filter);
    }

    const messages = await query
      .populate('sender', 'username profilePic')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Return in ascending order for display
    messages.reverse();

    res.json({ messages, hasMore: skip + messages.length < total, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /pinned — Get pinned messages for a room ──────────────────────────
router.get('/pinned', auth, async (req, res) => {
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ message: 'roomId required' });
  try {
    const msgs = await Message.find({ roomId, pinned: true, isDeleted: { $ne: true } })
      .populate('sender', 'username')
      .sort({ pinnedAt: -1 })
      .limit(10);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /:id — Edit own message ────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user.toString()) return res.status(403).json({ message: 'Not your message' });
    if (message.isDeleted) return res.status(400).json({ message: 'Cannot edit deleted message' });

    message.encryptedMessage = req.body.encryptedMessage;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const io = req.app.get('io');
    const payload = { messageId: message._id, encryptedMessage: req.body.encryptedMessage, editedAt: message.editedAt };
    if (message.roomId) io.to(message.roomId).emit('messageEdited', payload);
    else io.emit('messageEdited', payload);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /:id — Soft-delete own message ──────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user.toString()) return res.status(403).json({ message: 'Not your message' });

    message.isDeleted = true;
    message.encryptedMessage = '';
    await message.save();

    const io = req.app.get('io');
    if (message.roomId) io.to(message.roomId).emit('messageDeleted', { messageId: message._id });
    else io.emit('messageDeleted', { messageId: message._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /:id/react — Toggle reaction ─────────────────────────────────────
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji required' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const sender = await User.findById(req.user);
    const username = sender ? sender.username : req.user.toString();
    const reactions = message.reactions || new Map();
    const current = reactions.get(emoji) || [];

    if (current.includes(username)) {
      reactions.set(emoji, current.filter(u => u !== username));
      if (reactions.get(emoji).length === 0) reactions.delete(emoji);
    } else {
      reactions.set(emoji, [...current, username]);
    }

    message.reactions = reactions;
    message.markModified('reactions');
    await message.save();

    const io = req.app.get('io');
    const payload = { messageId: message._id, reactions: Object.fromEntries(message.reactions) };
    if (message.roomId) io.to(message.roomId).emit('messageReaction', payload);
    else io.emit('messageReaction', payload);

    res.json({ success: true, reactions: Object.fromEntries(message.reactions) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /:id/read — Mark as read ─────────────────────────────────────────
router.post('/:id/read', auth, async (req, res) => {
  try {
    const sender = await User.findById(req.user);
    const username = sender ? sender.username : req.user.toString();

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (!message.readBy.includes(username)) {
      message.readBy.push(username);
      await message.save();
      const io = req.app.get('io');
      const payload = { messageId: message._id, readBy: message.readBy };
      if (message.roomId) io.to(message.roomId).emit('messageRead', payload);
      else io.emit('messageRead', payload);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /:id/pin — Toggle pin ─────────────────────────────────────────────
router.post('/:id/pin', auth, async (req, res) => {
  try {
    const sender = await User.findById(req.user);
    const username = sender ? sender.username : 'Unknown';

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    message.pinned = !message.pinned;
    message.pinnedBy = message.pinned ? username : null;
    message.pinnedAt = message.pinned ? new Date() : null;
    await message.save();

    const io = req.app.get('io');
    const payload = { messageId: message._id, pinned: message.pinned, pinnedBy: message.pinnedBy };
    if (message.roomId) io.to(message.roomId).emit('messagePinned', payload);

    res.json({ success: true, pinned: message.pinned });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
