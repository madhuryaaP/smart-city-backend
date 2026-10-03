const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema(
  {
    // =========================================================
    // REPORT DETAILS
    // =========================================================

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

    // =========================================================
    // LOCATION
    // =========================================================

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    // =========================================================
    // IMAGE
    // =========================================================

    image: {
      type: String,
      default: null,
    },

    // =========================================================
    // USER WHO CREATED THE REPORT
    // =========================================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // =========================================================
    // DEPARTMENT ASSIGNMENT
    // =========================================================

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

    // Firebase topic for the responsible department
    departmentTopic: {
      type: String,
      default: 'department_general',
    },

    // =========================================================
    // NOTIFICATION TRACKING
    // =========================================================

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