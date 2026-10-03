const express = require('express');
const { body, validationResult } = require('express-validator');
const DailyPlan = require('../models/DailyPlan');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET all daily plans
router.get('/', protect, async (req, res) => {
  try {
    const { completed, date } = req.query;
    const filter = { user: req.user.id };
    
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }

    const plans = await DailyPlan.find(filter).sort({ date: -1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single daily plan
router.get('/:id', protect, async (req, res) => {
  try {
    const plan = await DailyPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    
    // Check ownership
    if (plan.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new daily plan
router.post(
  '/',
  protect,
  [
    body('startLocation').trim().isLength({ min: 3 }),
    body('destination').trim().isLength({ min: 3 }),
    body('arrivalTime').matches(/^\d{1,2}:\d{2}$/) // HH:mm format
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { startLocation, destination, arrivalTime, distance, estimatedDuration, notes } = req.body;

      const plan = new DailyPlan({
        user: req.user.id,
        startLocation,
        destination,
        arrivalTime,
        distance: distance ? parseFloat(distance) : 0,
        estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : 0,
        notes: notes || '',
        route: []
      });

      await plan.save();
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT update daily plan
router.put('/:id', protect, async (req, res) => {
  try {
    let plan = await DailyPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (plan.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    plan = await DailyPlan.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE daily plan
router.delete('/:id', protect, async (req, res) => {
  try {
    const plan = await DailyPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (plan.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await plan.deleteOne();

    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
