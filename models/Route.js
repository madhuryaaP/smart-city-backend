const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  startLocation: {
    type: String,
    required: true
  },
  destinations: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length >= 2;
      },
      message: 'At least 2 destinations are required'
    }
  },
  totalDistance: {
    type: Number, // in kilometers
    default: 0
  },
  totalDuration: {
    type: Number, // in minutes
    default: 0
  },
  waypoints: {
    type: [String], // Ordered waypoints
    default: []
  },
  optimized: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Route', routeSchema);
