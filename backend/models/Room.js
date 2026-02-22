const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerUsername: { type: String, required: true },
    participants: [{ type: String }], // List of usernames currently or historically in the room
    bannedUsers: [{ type: String }], // List of usernames banned from the room
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', RoomSchema);
