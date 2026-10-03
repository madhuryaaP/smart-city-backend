const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  area: {
    type: String,
    required: true
  },
  trafficStatus: {
    type: String,
    enum: ['Light', 'Moderate', 'Heavy', 'Severe'],
    default: 'Moderate'
  },
  weatherStatus: {
    type: String,
    enum: ['Clear', 'Cloudy', 'Rain', 'Snow', 'Foggy', 'Thunderstorm'],
    default: 'Clear'
  },
  temperature: {
    type: Number, // in Celsius
    default: 20
  },
  humidity: {
    type: Number, // percentage
    default: 50
  },
  visibility: {
    type: Number, // in km
    default: 10
  },
  windSpeed: {
    type: Number, // in km/h
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Condition', conditionSchema);
