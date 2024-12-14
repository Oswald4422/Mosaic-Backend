const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
    try {
        const { preferences } = req.body;
        
        if (!Array.isArray(preferences)) {
            return res.status(400).json({ message: 'Preferences must be an array' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.preferences = preferences;
        await user.save();

        res.json({ preferences: user.preferences });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
