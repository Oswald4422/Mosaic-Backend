const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all users (admin only)
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics (admin only)
router.get('/dashboard', [auth, admin], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalEvents = await Event.countDocuments();
    const upcomingEvents = await Event.countDocuments({
      date: { $gte: new Date() }
    });
    const eventsByType = await Event.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalUsers,
      totalEvents,
      upcomingEvents,
      eventsByType
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create event (admin only)
router.post('/events', [auth, admin], async (req, res) => {
  try {
    const event = new Event({
      ...req.body,
      createdBy: req.user.id,
      availableSeats: req.body.capacity
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update event (admin only)
router.put('/events/:id', [auth, admin], async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    Object.assign(event, req.body);
    await event.save();
    res.json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete event (admin only)
router.delete('/events/:id', [auth, admin], async (req, res) => {
  try {
    console.log(`[ADMIN API] Attempting to delete event ${req.params.id}`);
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      console.log('[ADMIN API] Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log('[ADMIN API] Event deleted successfully');
    res.json({ message: 'Event deleted successfully', event });
  } catch (error) {
    console.error('[ADMIN API] Error deleting event:', error);
    res.status(500).json({ message: 'Server error deleting event' });
  }
});

// Get event registrations (admin only)
router.get('/events/:id/registrations', [auth, admin], async (req, res) => {
  try {
    console.log(`[ADMIN API] Fetching registrations for event ${req.params.id}`);
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'registrations.user',
        select: 'name email role'
      });

    if (!event) {
      console.log('[ADMIN API] Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log(`[ADMIN API] Found ${event.registrations.length} registrations`);
    res.json(event.registrations);
  } catch (error) {
    console.error('[ADMIN API] Error fetching registrations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all registrations (Admin only)
router.get('/registrations', [auth, admin], async (req, res) => {
  console.log('[ADMIN API] Fetching all registrations');
  try {
    const events = await Event.find()
      .populate({
        path: 'registrations.user',
        select: 'name email role'
      })
      .select('title date registrations');
    
    console.log(`[ADMIN API] Found ${events.length} events with registrations`);
    res.json(events);
  } catch (error) {
    console.error('[ADMIN API] Error fetching registrations:', error);
    res.status(500).json({ message: 'Error fetching registrations' });
  }
});

// Get all events (Admin only)
router.get('/events', [auth, admin], async (req, res) => {
  console.log('[ADMIN API] Fetching all events');
  try {
    const events = await Event.find()
      .populate('creator', 'name email')
      .populate({
        path: 'registrations.user',
        select: 'name email role'
      })
      .sort({ date: -1 }); // Sort by date descending

    console.log(`[ADMIN API] Found ${events.length} events`);
    res.json(events);
  } catch (error) {
    console.error('[ADMIN API] Error fetching events:', error);
    res.status(500).json({ 
      message: 'Error fetching events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Cancel registration (Admin only)
router.delete('/events/:eventId/registrations/:userId', [auth, admin], async (req, res) => {
  console.log(`[ADMIN API] Cancelling registration for event ${req.params.eventId} user ${req.params.userId}`);
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      console.log('[ADMIN API] Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    const registrationIndex = event.registrations.findIndex(
      reg => reg.user.toString() === req.params.userId
    );

    if (registrationIndex === -1) {
      console.log('[ADMIN API] Registration not found');
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Remove the registration and increment available seats
    event.registrations.splice(registrationIndex, 1);
    event.availableSeats += 1;
    await event.save();

    console.log('[ADMIN API] Registration cancelled successfully');
    res.json({ message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('[ADMIN API] Error cancelling registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
