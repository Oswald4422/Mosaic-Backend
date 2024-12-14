const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: ['Academic', 'Social', 'Sports', 'Cultural', 'Workshop', 'Conference']
  },
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1'],
    required: [true, 'Capacity is required']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  registrations: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if event is full
eventSchema.virtual('isFull').get(function() {
  return this.registrations.length >= this.capacity;
});

// Virtual for available spots
eventSchema.virtual('availableSpots').get(function() {
  return Math.max(0, this.capacity - this.registrations.length);
});

module.exports = mongoose.model('Event', eventSchema);
