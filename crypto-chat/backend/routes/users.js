const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Search users
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const users = await User.find({
            username: { $regex: query, $options: 'i' }
        }).select('username _id');

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user public key by username
router.get('/:username/key', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ publicKey: user.publicKey });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
