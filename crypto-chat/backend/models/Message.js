const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for Rooms
  roomId: { type: String }, // For Room-based chat
  encryptedMessage: { type: String, required: true },
  encryptedKey: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
