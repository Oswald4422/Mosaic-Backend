const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminCheck = require('../middleware/admin');
const { body, validationResult } = require('express-validator');

// Validation middleware
const validateEvent = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time in HH:MM format is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('type').isIn(['Academic', 'Social', 'Sports', 'Cultural', 'Workshop', 'Conference']).withMessage('Invalid event type'),
];

// Get all events with filtering and pagination
router.get('/', async (req, res) => {
  console.log('[EVENTS API] Fetching all events');
  try {
    const { type, page = 1, limit = 10 } = req.query;
    let query = {};

    // Type filter
    if (type) {
      const types = type.split(',');
      query.type = { $in: types };
    }

    // Only get upcoming events
    const now = new Date('2024-12-14T04:13:12Z'); // Using the provided current time
    console.log('[EVENTS API] Current time:', now.toISOString());

    // Get all events and filter in memory to handle date+time comparison
    const allEvents = await Event.find(query).populate('creator', 'name');
    
    // Filter events where the combined date and time is in the future
    const upcomingEvents = allEvents.filter(event => {
      const [hours, minutes] = event.time.split(':').map(Number);
      const eventDateTime = new Date(event.date);
      eventDateTime.setUTCHours(hours, minutes, 0, 0);
      
      console.log(`[EVENTS API] Comparing event: ${event.title}`);
      console.log(`Event datetime: ${eventDateTime.toISOString()}`);
      console.log(`Current time: ${now.toISOString()}`);
      console.log(`Is upcoming: ${eventDateTime > now}`);
      
      return eventDateTime > now;
    });

    // Sort events by date and time
    upcomingEvents.sort((a, b) => {
      const aDateTime = new Date(a.date);
      const bDateTime = new Date(b.date);
      const [aHours, aMinutes] = a.time.split(':').map(Number);
      const [bHours, bMinutes] = b.time.split(':').map(Number);
      
      aDateTime.setUTCHours(aHours, aMinutes, 0, 0);
      bDateTime.setUTCHours(bHours, bMinutes, 0, 0);
      
      return aDateTime - bDateTime;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedEvents = upcomingEvents.slice(startIndex, endIndex);

    console.log(`[EVENTS API] Found ${paginatedEvents.length} events after filtering and pagination`);
    paginatedEvents.forEach(event => {
      const [hours, minutes] = event.time.split(':').map(Number);
      const eventDateTime = new Date(event.date);
      eventDateTime.setUTCHours(hours, minutes, 0, 0);
      console.log(`Returning event: ${event.title}, DateTime: ${eventDateTime.toISOString()}`);
    });

    res.json({
      events: paginatedEvents,
      pagination: {
        total: upcomingEvents.length,
        page: parseInt(page),
        pages: Math.ceil(upcomingEvents.length / limit),
      },
    });
  } catch (error) {
    console.error('[EVENTS API] Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching events' });
  }
});

// Get user's registered events with filtering
router.get('/registered', auth, async (req, res) => {
  console.log(`[EVENTS API] Fetching registered events for user ${req.user.id}`);
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build query for registered events
    let query = {
      _id: { $in: user.registeredEvents }
    };

    // Add type filter if provided
    const { type } = req.query;
    if (type) {
      const types = type.split(',');
      // Only filter by types that are in user's preferences
      const allowedTypes = types.filter(t => user.preferences.includes(t));
      if (allowedTypes.length > 0) {
        query.type = { $in: allowedTypes };
      }
    }

    // Get events and sort by date
    const events = await Event.find(query)
      .sort({ date: 1, time: 1 })
      .populate('creator', 'name')
      .lean();

    // Add registration status to each event
    const eventsWithStatus = events.map(event => ({
      ...event,
      isRegistered: true, // All events here are registered
      registrationDate: event.registrations.find(
        r => r.user.toString() === req.user.id
      )?.registeredAt
    }));

    res.json(eventsWithStatus);
  } catch (error) {
    console.error('Error fetching registered events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get past events for current user
router.get('/past', auth, async (req, res) => {
  console.log(`[EVENTS API] Fetching past events for user ${req.user.id}`);
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Create a date string in ISO format for today at current time
    const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
    
    console.log('[EVENTS API] Current time:', nowString);
    
    const events = await Event.find({
      'registrations.user': req.user.id,
      $expr: {
        $or: [
          // If date is in the past
          { $lt: ['$date', now] },
          // If date is today, check the time
          {
            $and: [
              { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$date' } }, { $dateToString: { format: '%Y-%m-%d', date: now } }] },
              { $lt: ['$time', { $dateToString: { format: '%H:%M', date: now } }] }
            ]
          }
        ]
      }
    })
    .populate('creator', 'name')
    .sort({ date: -1, time: -1 });

    console.log(`[EVENTS API] Found ${events.length} past events`);
    res.json(events);
  } catch (error) {
    console.error('[EVENTS API] Error fetching past events:', error);
    res.status(500).json({ message: 'Error fetching past events' });
  }
});

// Get all events (admin only)
router.get('/admin', [auth, adminCheck], async (req, res) => {
  try {
    const { status = 'upcoming' } = req.query;
    let dateQuery = {};

    if (status === 'upcoming') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Create a date string in ISO format for today at current time
      const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
      
      console.log('[EVENTS API] Current time:', nowString);
      
      dateQuery.$expr = {
        $or: [
          // If date is in the future
          { $gt: ['$date', now] },
          // If date is today, check the time
          {
            $and: [
              { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$date' } }, { $dateToString: { format: '%Y-%m-%d', date: now } }] },
              { $gt: ['$time', { $dateToString: { format: '%H:%M', date: now } }] }
            ]
          }
        ]
      };
    } else if (status === 'past') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Create a date string in ISO format for today at current time
      const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
      
      console.log('[EVENTS API] Current time:', nowString);
      
      dateQuery.$expr = {
        $or: [
          // If date is in the past
          { $lt: ['$date', now] },
          // If date is today, check the time
          {
            $and: [
              { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$date' } }, { $dateToString: { format: '%Y-%m-%d', date: now } }] },
              { $lt: ['$time', { $dateToString: { format: '%H:%M', date: now } }] }
            ]
          }
        ]
      };
    }

    const events = await Event.find(dateQuery)
      .populate('creator', 'name')
      .populate('registrations.user', 'name email')
      .sort({ date: status === 'past' ? -1 : 1, time: status === 'past' ? -1 : 1 });

    res.json(events);
  } catch (error) {
    console.error('Get admin events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create event (admin only)
router.post('/admin', [auth, adminCheck, validateEvent], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, date, time, location, capacity, type } = req.body;

    // Create event with validated data
    const event = new Event({
      title,
      description,
      date,
      time,
      location,
      capacity,
      type,
      creator: req.user.id,
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event (admin only)
router.put('/admin/:id', [auth, adminCheck, validateEvent], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if reducing capacity below current registrations
    if (req.body.capacity < event.registrations.length) {
      return res.status(400).json({
        message: 'Cannot reduce capacity below current number of registrations',
      });
    }

    Object.assign(event, req.body);
    await event.save();

    res.json(event);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event (admin only)
router.delete('/admin/:id', [auth, adminCheck], async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event has already started
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Create a date string in ISO format for today at current time
    const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
    
    console.log('[EVENTS API] Current time:', nowString);
    
    if (event.date < now || (event.date.toISOString().split('T')[0] === now.toISOString().split('T')[0] && event.time < { $dateToString: { format: '%H:%M', date: now } })) {
      return res.status(400).json({
        message: 'Cannot delete an event that has already started',
      });
    }

    // Notify registered users (implement notification system)
    // TODO: Implement notification system

    await event.remove();
    res.json({ message: 'Event removed successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  console.log(`[EVENTS API] Fetching event ${req.params.id}`);
  try {
    const event = await Event.findById(req.params.id)
      .populate('creator', 'name')
      .populate('registrations.user', 'name email');

    if (!event) {
      console.log('[EVENTS API] Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log('[EVENTS API] Event found successfully');
    res.json(event);
  } catch (error) {
    console.error('[EVENTS API] Error fetching event:', error);
    res.status(500).json({ message: 'Error fetching event' });
  }
});

// Register for an event
router.post('/:id/register', auth, async (req, res) => {
  console.log(`[EVENTS API] Registering user ${req.user.id} for event ${req.params.id}`);
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event type is in user's preferences
    const user = await User.findById(req.user.id);
    if (!user.preferences.includes(event.type)) {
      return res.status(400).json({ 
        message: 'Cannot register for event type not in preferences' 
      });
    }

    // Check if already registered
    const isRegistered = event.registrations.some(
      reg => reg.user.toString() === req.user.id
    );
    if (isRegistered) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Check capacity
    if (event.registrations.length >= event.capacity) {
      return res.status(400).json({ message: 'Event is full' });
    }

    // Add registration
    event.registrations.push({
      user: req.user.id,
      registeredAt: new Date()
    });
    await event.save();

    // Add event to user's registered events
    user.registeredEvents.push(event._id);
    await user.save();

    res.json({ message: 'Successfully registered for event' });
  } catch (error) {
    console.error('Error registering for event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel registration
router.delete('/:id/register', auth, async (req, res) => {
  console.log(`[EVENTS API] Cancelling registration for user ${req.user.id} event ${req.params.id}`);
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      console.log('[EVENTS API] Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event has already started
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Create a date string in ISO format for today at current time
    const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
    
    console.log('[EVENTS API] Current time:', nowString);
    
    if (event.date < now || (event.date.toISOString().split('T')[0] === now.toISOString().split('T')[0] && event.time < { $dateToString: { format: '%H:%M', date: now } })) {
      return res.status(400).json({ message: 'Cannot cancel registration for past events' });
    }

    // Find registration index
    const registrationIndex = event.registrations.findIndex(
      reg => reg.user.toString() === req.user.id
    );

    if (registrationIndex === -1) {
      console.log('[EVENTS API] Registration not found');
      return res.status(404).json({ message: 'Not registered for this event' });
    }

    // Remove registration
    event.registrations.splice(registrationIndex, 1);
    await event.save();

    // Update user's registered events
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { registeredEvents: event._id }
    });

    console.log('[EVENTS API] Registration cancelled successfully');
    res.json({ message: 'Successfully cancelled registration' });
  } catch (error) {
    console.error('[EVENTS API] Error cancelling registration:', error);
    res.status(500).json({ message: 'Error cancelling registration' });
  }
});

// Cancel registration (admin only)
router.delete('/:eventId/registrations/:userId', [auth, adminCheck], async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event has already started
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Create a date string in ISO format for today at current time
    const nowString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
    
    console.log('[EVENTS API] Current time:', nowString);
    
    if (event.date < now || (event.date.toISOString().split('T')[0] === now.toISOString().split('T')[0] && event.time < { $dateToString: { format: '%H:%M', date: now } })) {
      return res.status(400).json({ message: 'Cannot cancel registration for past events' });
    }

    // Remove user from event registrations
    const registrationIndex = event.registrations.findIndex(
      reg => reg.user.toString() === userId
    );

    if (registrationIndex === -1) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    event.registrations.splice(registrationIndex, 1);
    await event.save();

    // Remove event from user's registered events
    await User.findByIdAndUpdate(userId, {
      $pull: { registeredEvents: eventId }
    });

    res.json({ message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('Admin cancel registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
