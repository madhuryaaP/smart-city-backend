require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// =========================================================
// FIREBASE ADMIN v14 MODULAR API
// =========================================================

const {
  initializeApp,
  cert,
  getApps,
} = require('firebase-admin/app');

const {
  getMessaging,
} = require('firebase-admin/messaging');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require('./serviceAccountKey.json');

// =========================================================
// 1. INITIALIZE FIREBASE ADMIN
// =========================================================

const firebaseApp =
  getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

const messaging =
  getMessaging(firebaseApp);

console.log('====================================');
console.log(
  'Firebase Admin initialized:',
  true
);
console.log(
  'Firebase apps:',
  getApps().length
);
console.log(
  'Firebase Messaging initialized:',
  !!messaging
);
console.log('====================================');

// =========================================================
// 2. EXPRESS
// =========================================================

const app = express();

const connectDB =
  require('./db');

connectDB();

app.use(cors());

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    limit: '10mb',
    extended: true,
  })
);

// =========================================================
// 3. UPLOADS
// =========================================================

app.use(
  '/uploads',
  express.static(
    path.join(
      __dirname,
      'uploads'
    )
  )
);

// =========================================================
// 4. EXISTING ROUTES
// =========================================================

app.use(
  '/api/auth',
  require('./routes/auth')
);

app.use(
  '/api/issues',
  require('./routes/issues')
);

app.use(
  '/api/daily-plans',
  require('./routes/dailyPlans')
);

// =========================================================
// GOOGLE MAPS ROUTE ESTIMATE
// =========================================================
app.post('/api/routes/google-estimate', async (req, res) => {
  try {
    const { startLocation, destinations } = req.body || {};

    if (typeof startLocation !== 'string' || !startLocation.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Start location is required.',
      });
    }

    const cleanDestinations = Array.isArray(destinations)
      ? destinations.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (cleanDestinations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid destination is required.',
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GOOGLE_MAPS_API_KEY is not configured on the backend.',
      });
    }

    const destination = cleanDestinations[cleanDestinations.length - 1];
    const intermediates = cleanDestinations
      .slice(0, -1)
      .map((address) => ({ address }));

    const requestBody = {
      origin: { address: startLocation.trim() },
      destination: { address: destination },
      ...(intermediates.length > 0 ? { intermediates } : {}),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
    };

    const googleResponse = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const googleData = await googleResponse.json();

    if (!googleResponse.ok) {
      console.error('Google Routes API error:', googleData);
      return res.status(502).json({
        success: false,
        message:
          googleData?.error?.message ||
          'Google Maps route calculation failed.',
      });
    }

    const route = googleData?.routes?.[0];
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Google Maps could not find a route for these places.',
      });
    }

    const distanceMeters = Number(route.distanceMeters);
    const durationText = String(route.duration || '');
    const durationMatch = durationText.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
    const durationSeconds = durationMatch ? Number(durationMatch[1]) : NaN;

    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
      return res.status(502).json({
        success: false,
        message: 'Google Maps returned incomplete route details.',
      });
    }

    return res.json({
      success: true,
      data: {
        distanceKm: Number((distanceMeters / 1000).toFixed(1)),
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        source: 'Google Maps Routes API',
      },
    });
  } catch (error) {
    console.error('Google Maps route estimate error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Google Maps route calculation failed.',
    });
  }
});

app.use(
  '/api/routes',
  require('./routes/routes')
);

app.use(
  '/api/conditions',
  require('./routes/conditions')
);

app.use(
  '/api/alerts',
  require('./routes/alerts')
);

app.use(
  '/api/emergency',
  require('./routes/emergency')
);

// =========================================================
// 5. HEALTH CHECK
// =========================================================

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      status: 'OK',
      message:
        'Smart City Planner backend is running',
    });
  }
);

// =========================================================
// 6. TEST NOTIFICATION USING FCM TOKEN
// =========================================================

app.post(
  '/api/notifications/test',
  async (req, res) => {
    try {
      const { token } =
        req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message:
            'FCM token is required',
        });
      }

      console.log(
        'Sending notification to token...'
      );

      const message = {
        token: token,

        notification: {
          title:
            'Smart City Alert 🚨',

          body:
            'Test notification from Smart City Planner backend',
        },

        data: {
          type: 'test',
        },

        android: {
          priority: 'high',

          notification: {
            channelId:
              'smart_city_alerts',

            sound: 'default',
          },
        },
      };

      const response =
        await messaging.send(
          message
        );

      console.log(
        '===================================='
      );

      console.log(
        'FCM notification sent successfully'
      );

      console.log(
        'Message ID:',
        response
      );

      console.log(
        '===================================='
      );

      res.json({
        success: true,
        message:
          'Notification sent successfully',
        messageId: response,
      });

    } catch (error) {
      console.error(
        '===================================='
      );

      console.error(
        'FCM notification error'
      );

      console.error(error);

      console.error(
        '===================================='
      );

      res.status(500).json({
        success: false,
        message:
          error.message,

        errorCode:
          error.code || null,
      });
    }
  }
);

// =========================================================
// 7. TEST NOTIFICATION USING TOPIC
// =========================================================

app.get(
  '/api/notifications/test-topic',
  async (req, res) => {
    try {
      const message = {
        topic:
          'city_alerts',

        notification: {
          title:
            'Smart City Alert 🚨',

          body:
            'Topic notification is working!',
        },

        data: {
          type:
            'topic_test',
        },

        android: {
          priority: 'high',

          notification: {
            channelId:
              'smart_city_alerts',

            sound: 'default',
          },
        },
      };

      const response =
        await messaging.send(
          message
        );

      console.log(
        '===================================='
      );

      console.log(
        'FCM topic notification sent'
      );

      console.log(
        'Message ID:',
        response
      );

      console.log(
        '===================================='
      );

      res.json({
        success: true,

        message:
          'Topic notification sent successfully',

        messageId:
          response,
      });

    } catch (error) {
      console.error(
        'FCM topic notification error:',
        error
      );

      res.status(500).json({
        success: false,

        message:
          error.message,

        errorCode:
          error.code || null,
      });
    }
  }
);

// =========================================================
// 8. ALERT MONITOR
// =========================================================

// Import AFTER Firebase initialization.
// The same Firebase Messaging instance created above
// will be passed to the monitor.

const {
  startAlertMonitor,
} = require('./alertMonitor');

// =========================================================
// 9. START SERVER
// =========================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      '===================================='
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Health: http://localhost:${PORT}/api/health`
    );

    console.log(
      '===================================='
    );

    // Start environmental monitoring.
    //
    // IMPORTANT:
    // Pass the already initialized Firebase
    // Messaging object to alertMonitor.js.
    startAlertMonitor(
      messaging
    );
  }
);