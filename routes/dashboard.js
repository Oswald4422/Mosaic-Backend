const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

// Get admin dashboard stats
router.get('/admin', auth, isAdmin, async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const totalUsers = await User.countDocuments();
    
    const upcomingEvents = await Event.find({
      date: { $gte: new Date() }
    })
    .sort({ date: 1 })
    .limit(5)
    .populate('registeredUsers', 'username email');

    const recentRegistrations = await Event.aggregate([
      { $unwind: '$registeredUsers' },
      { $sort: { 'registeredUsers.registeredAt': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'registeredUsers',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          eventName: '$name',
          user: {
            _id: '$user._id',
            username: '$user.username',
            email: '$user.email'
          },
          registeredAt: '$registeredUsers.registeredAt'
        }
      }
    ]);

    res.json({
      totalEvents,
      totalUsers,
      upcomingEvents,
      recentRegistrations
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user dashboard data
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'registeredEvents',
        match: { date: { $gte: new Date() } },
        options: { sort: { date: 1 } }
      });

    res.json({
      preferences: user.eventPreferences,
      registeredEvents: user.registeredEvents
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
