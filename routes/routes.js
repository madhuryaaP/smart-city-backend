const express = require('express');
const { body, validationResult } = require('express-validator');
const Route = require('../models/Route');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET all routes
router.get('/', protect, async (req, res) => {
  try {
    const { optimized } = req.query;
    const filter = { user: req.user.id };
    
    if (optimized !== undefined) {
      filter.optimized = optimized === 'true';
    }

    const routes = await Route.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// ============================================================
// CALCULATE MULTI-DESTINATION ROUTE
// ============================================================

router.post('/estimate', async (req, res) => {
  try {
    const { startLocation, destinations } = req.body;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!startLocation || !startLocation.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Starting location is required',
      });
    }

    if (
      !Array.isArray(destinations) ||
      destinations.length < 1
    ) {
      return res.status(400).json({
        success: false,
        message: 'At least one destination is required',
      });
    }

    const stops = [
      startLocation.trim(),
      ...destinations
        .map((value) => String(value).trim())
        .filter(Boolean),
    ];

    if (stops.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two locations are required',
      });
    }

    // ----------------------------------------------------------
    // GEOCODE USING OPENSTREETMAP NOMINATIM
    // ----------------------------------------------------------

    async function geocode(place) {
      const url =
        'https://nominatim.openstreetmap.org/search' +
        `?q=${encodeURIComponent(place + ', Hyderabad, India')}` +
        '&format=json' +
        '&limit=1';

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'SmartCityPlanner/1.0 (smartcityplanner@example.com)',
          'Accept-Language': 'en',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Geocoding failed for "${place}"`
        );
      }

      const results = await response.json();

      if (
        !Array.isArray(results) ||
        results.length === 0
      ) {
        throw new Error(
          `Could not find "${place}"`
        );
      }

      const latitude =
        Number(results[0].lat);

      const longitude =
        Number(results[0].lon);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          `Invalid coordinates for "${place}"`
        );
      }

      return {
        name: place,
        latitude,
        longitude,
      };
    }

    // ----------------------------------------------------------
    // GEOCODE ALL STOPS
    // ----------------------------------------------------------

    const coordinates = [];

    for (const stop of stops) {
      const location =
        await geocode(stop);

      coordinates.push(location);
    }

    // ----------------------------------------------------------
    // BUILD OSRM COORDINATE STRING
    // OSRM expects longitude,latitude
    // ----------------------------------------------------------

    const coordinateString =
      coordinates
        .map(
          (point) =>
            `${point.longitude},${point.latitude}`
        )
        .join(';');

    // ----------------------------------------------------------
    // CALL OSRM
    // ----------------------------------------------------------

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${coordinateString}` +
      `?overview=false&alternatives=false&steps=false`;

    const osrmResponse =
      await fetch(osrmUrl);

    if (!osrmResponse.ok) {
      throw new Error(
        'Routing service is currently unavailable'
      );
    }

    const osrmData =
      await osrmResponse.json();

    if (
      osrmData.code !== 'Ok' ||
      !osrmData.routes ||
      osrmData.routes.length === 0
    ) {
      throw new Error(
        'No driving route could be calculated for these locations'
      );
    }

    const route =
      osrmData.routes[0];

    // OSRM:
    // distance = metres
    // duration = seconds

    const distanceKm =
      Number(route.distance) / 1000;

    const durationMinutes =
      Math.max(
        1,
        Math.round(
          Number(route.duration) / 60
        )
      );

    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    return res.json({
      success: true,

      data: {
        startLocation:
          startLocation.trim(),

        destinations:
          destinations.map(
            (value) => String(value).trim()
          ),

        stops: stops.length,

        distanceKm:
          Number(distanceKm.toFixed(1)),

        durationMinutes,

        coordinates,
      },
    });

  } catch (error) {
    console.error(
      'Route estimation error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Unable to calculate route',
    });
  }
});
// GET single route
router.get('/:id', protect, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    if (route.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new route
router.post(
  '/',
  protect,
  [
    body('startLocation').trim().isLength({ min: 3 }),
    body('destinations').isArray({ min: 2 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { startLocation, destinations, totalDistance, totalDuration, optimized, notes } = req.body;

      const route = new Route({
        user: req.user.id,
        startLocation,
        destinations,
        totalDistance: totalDistance ? parseFloat(totalDistance) : 0,
        totalDuration: totalDuration ? parseInt(totalDuration) : 0,
        optimized: optimized || false,
        notes: notes || '',
        waypoints: [startLocation, ...destinations]
      });

      await route.save();
      res.status(201).json({ success: true, data: route });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT update route
router.put('/:id', protect, async (req, res) => {
  try {
    let route = await Route.findById(req.params.id);

    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    if (route.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    route = await Route.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE route
router.delete('/:id', protect, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    if (route.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await route.deleteOne();

    res.json({ success: true, message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
