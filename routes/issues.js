const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        'Pothole',
        'Damaged Road',
        'Garbage',
        'Street Light',
        'Water Leak',
        'Drainage Issue',
        'Traffic Light',
        'Streetlight',
        'Other',
      ],
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved'],
      default: 'Pending',
    },

    // Location
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    // Keep coordinates too for compatibility
    coordinates: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
    },

    // Uploaded image
    image: {
      type: String,
      default: null,
    },

    // Keep photo for compatibility with existing frontend
    photo: {
      type: String,
      default: null,
    },

    photoMimeType: {
      type: String,
      default: null,
    },

    // Citizen who created the report
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Department responsible for this report
    department: {
      type: String,
      enum: [
        'roads',
        'sanitation',
        'electrical',
        'water',
        'drainage',
        'traffic',
        'general',
      ],
      default: 'general',
    },

    // Firebase topic used for department notification
    departmentTopic: {
      type: String,
      default: 'department_general',
    },

    // Prevent duplicate department notifications
    notificationSent: {
      type: Boolean,
      default: false,
    },

    notificationMessageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Issue', IssueSchema);