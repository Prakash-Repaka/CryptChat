const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  roomId: { type: String, default: null },
  encryptedMessage: { type: String },
  encryptedKey: { type: String },
  encryptedFileData: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  ephemeralPublicKey: { type: String },
  expiresAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now },

  // Edit & Delete
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },

  // Reactions – Map of emoji string -> array of usernames
  reactions: { type: Map, of: [String], default: {} },

  // Read Receipts
  readBy: { type: [String], default: [] },

  // Reply / Quote
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

  // Pin
  pinned: { type: Boolean, default: false },
  pinnedBy: { type: String, default: null },
  pinnedAt: { type: Date, default: null },
});

module.exports = mongoose.model('Message', MessageSchema);
