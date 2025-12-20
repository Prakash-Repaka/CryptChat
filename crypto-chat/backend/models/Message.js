const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for Rooms
  roomId: { type: String }, // For Room-based chat
  encryptedMessage: { type: String, required: true },
  encryptedKey: { type: String, required: true },
  encryptedFileData: { type: String }, // Base64 encrypted file
  fileName: { type: String },
  fileType: { type: String },
  ephemeralPublicKey: { type: String }, // For PFS handshake
  timestamp: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // For self-destructing messages
});

// TTL index to automatically delete expired messages
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', MessageSchema);
