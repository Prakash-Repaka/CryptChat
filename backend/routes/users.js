const express = require('express');
const User = require('../models/User');
const router = express.Router();
const auth = require('../middleware/auth');

// ── GET /search ────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const users = await User.find({ username: { $regex: query, $options: 'i' } })
            .select('username _id profilePic statusMessage');
        res.json(users);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /me ───────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user)
            .select('username email firstName lastName profilePic bio statusMessage');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── PUT /me/profile ───────────────────────────────────────────────────────
router.put('/me/profile', auth, async (req, res) => {
    try {
        const { bio, statusMessage, profilePic } = req.body;
        const update = {};
        if (bio !== undefined) update.bio = bio.slice(0, 200);
        if (statusMessage !== undefined) update.statusMessage = statusMessage.slice(0, 100);
        if (profilePic !== undefined) {
            if (profilePic.length > 270000) return res.status(400).json({ message: 'Profile picture too large (max ~200KB)' });
            update.profilePic = profilePic;
        }
        const user = await User.findByIdAndUpdate(req.user, update, { new: true })
            .select('username profilePic bio statusMessage');
        res.json(user);
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /me/change-password ──────────────────────────────────────────────
router.post('/me/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

        user.password = newPassword;
        await user.save(); // triggers bcrypt hash in pre-save hook
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── GET /me/sessions ──────────────────────────────────────────────────────
router.get('/me/sessions', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user).select('sessions');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.sessions || []);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── DELETE /me/sessions/:sessionId ────────────────────────────────────────
router.delete('/me/sessions/:sessionId', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user, {
            $pull: { sessions: { _id: req.params.sessionId } }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /:username/key ─────────────────────────────────────────────────────
router.get('/:username/key', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ publicKey: user.publicKey });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /:username/profile ─────────────────────────────────────────────────
router.get('/:username/profile', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username profilePic bio statusMessage');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
