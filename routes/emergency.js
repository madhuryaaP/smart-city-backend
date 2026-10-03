const express = require('express');

const router = express.Router();

const emergencyServices = [
  {
    name: 'Police',
    type: 'Police',
    number: '100',
  },
  {
    name: 'Ambulance',
    type: 'Medical',
    number: '108',
  },
  {
    name: 'Fire & Rescue',
    type: 'Fire & Rescue',
    number: '101',
  },
];

router.get('/services', (req, res) => {
  res.json({
    success: true,
    location: 'Hyderabad',
    services: emergencyServices,
  });
});

router.post('/sos', (req, res) => {
  const { service, number } = req.body || {};

  if (!service || !number) {
    return res.status(400).json({
      success: false,
      message: 'Service and number are required',
    });
  }

  console.log(
    `[SOS] ${new Date().toISOString()} | service=${service} | number=${number}`
  );

  return res.status(201).json({
    success: true,
    message: 'SOS request recorded',
    service,
    number,
    createdAt: new Date().toISOString(),
  });
});

module.exports = router;
