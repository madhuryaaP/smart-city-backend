const fs = require('fs');
const path = require('path');

const alertsRouter = require('./routes/alerts');

const getLiveAlerts = alertsRouter.getLiveAlerts;

const CHECK_INTERVAL = 5 * 60 * 1000;

const STATE_FILE = path.join(__dirname, 'alertState.json');

// ============================================================
// STATE
// ============================================================

function loadPreviousState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }

    return JSON.parse(
      fs.readFileSync(STATE_FILE, 'utf8')
    );
  } catch (error) {
    console.error(
      'Could not load alert state:',
      error.message
    );

    return null;
  }
}

function saveState(state) {
  try {
    const tempFile = STATE_FILE + '.tmp';

    fs.writeFileSync(
      tempFile,
      JSON.stringify(state, null, 2),
      'utf8'
    );

    fs.renameSync(tempFile, STATE_FILE);
  } catch (error) {
    console.error(
      'Could not save alert state:',
      error.message
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

function round(value, decimals = 1) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return null;
  }

  const factor = Math.pow(10, decimals);

  return (
    Math.round(Number(value) * factor) / factor
  );
}

// ============================================================
// CREATE SNAPSHOT
// ============================================================

function createSnapshot(data) {
  return {
    temperature: round(
      data.weather?.temperature,
      1
    ),

    humidity: round(
      data.weather?.humidity,
      0
    ),

    trafficLevel:
      data.traffic?.level || 'normal',

    currentSpeed: round(
      data.traffic?.currentSpeed,
      0
    ),

    pm25: round(
      data.airQuality?.pm25,
      1
    ),

    weatherMain:
      data.weather?.weatherMain || 'Clear',

    alerts: (data.alerts || []).map(
      (alert) => ({
        key:
          `${alert.type}:${alert.condition}`,

        title: alert.title,

        severity: alert.severity,

        type: alert.type,

        condition: alert.condition
      })
    )
  };
}

// ============================================================
// ALERT MAP
// ============================================================

function createAlertMap(alerts) {
  const map = {};

  for (const alert of alerts) {
    const key =
      `${alert.type}:${alert.condition}`;

    map[key] = alert;
  }

  return map;
}

// ============================================================
// DETECT CHANGES
// ============================================================

function detectChanges(previous, current) {
  const changes = [];

  // ----------------------------------------------------------
  // TEMPERATURE
  // ----------------------------------------------------------

  if (
    previous.temperature !== null &&
    current.temperature !== null
  ) {
    const difference =
      Math.abs(
        current.temperature -
        previous.temperature
      );

    if (difference >= 2) {
      changes.push({
        type: 'temperature',

        title: 'Temperature Changed',

        body:
          `Temperature in Hyderabad changed ` +
          `from ${previous.temperature}°C ` +
          `to ${current.temperature}°C.`,

        severity:
          current.temperature >= 40
            ? 'High'
            : 'Medium'
      });
    }
  }

  // ----------------------------------------------------------
  // TRAFFIC
  // ----------------------------------------------------------

  if (
    previous.trafficLevel !==
    current.trafficLevel
  ) {
    const levelNames = {
      normal: 'Normal',
      moderate: 'Moderate',
      heavy: 'Heavy'
    };

    changes.push({
      type: 'traffic',

      title:
        current.trafficLevel === 'heavy'
          ? 'Heavy Traffic Alert'
          : current.trafficLevel === 'moderate'
            ? 'Traffic Congestion'
            : 'Traffic Improved',

      body:
        `Traffic changed from ` +
        `${levelNames[previous.trafficLevel] || previous.trafficLevel} ` +
        `to ` +
        `${levelNames[current.trafficLevel] || current.trafficLevel}.`,

      severity:
        current.trafficLevel === 'heavy'
          ? 'High'
          : current.trafficLevel === 'moderate'
            ? 'Medium'
            : 'Low'
    });
  }

  // ----------------------------------------------------------
  // PM2.5
  // ----------------------------------------------------------

  if (
    previous.pm25 !== null &&
    current.pm25 !== null
  ) {
    const difference =
      Math.abs(
        current.pm25 -
        previous.pm25
      );

    if (difference >= 10) {
      changes.push({
        type: 'air_quality',

        title:
          current.pm25 >= 150
            ? 'Very Poor Air Quality'
            : current.pm25 >= 55
              ? 'Air Quality Changed'
              : 'Air Quality Improved',

        body:
          `PM2.5 changed from ` +
          `${previous.pm25} µg/m³ ` +
          `to ${current.pm25} µg/m³ near Hyderabad.`,

        severity:
          current.pm25 >= 150
            ? 'High'
            : current.pm25 >= 55
              ? 'Medium'
              : 'Low'
      });
    }
  }

  // ----------------------------------------------------------
  // WEATHER
  // ----------------------------------------------------------

  if (
    previous.weatherMain !==
    current.weatherMain
  ) {
    const importantWeather = [
      'Rain',
      'Thunderstorm'
    ];

    const previousImportant =
      importantWeather.includes(
        previous.weatherMain
      );

    const currentImportant =
      importantWeather.includes(
        current.weatherMain
      );

    if (
      previousImportant !==
      currentImportant
    ) {
      if (currentImportant) {
        changes.push({
          type: 'weather',

          title:
            current.weatherMain ===
            'Thunderstorm'
              ? 'Thunderstorm Alert'
              : 'Rainfall Alert',

          body:
            `Weather conditions in Hyderabad ` +
            `have changed to ${current.weatherMain}.`,

          severity:
            current.weatherMain ===
            'Thunderstorm'
              ? 'High'
              : 'Medium'
        });
      } else {
        changes.push({
          type: 'weather',

          title: 'Weather Improved',

          body:
            'The previous weather alert condition in Hyderabad has cleared.',

          severity: 'Low'
        });
      }
    }
  }

  // ----------------------------------------------------------
  // NEW ALERTS
  // ----------------------------------------------------------

  const previousAlerts =
    createAlertMap(
      previous.alerts || []
    );

  const currentAlerts =
    createAlertMap(
      current.alerts || []
    );

  for (const key of Object.keys(currentAlerts)) {
    if (!previousAlerts[key]) {
      const alert =
        currentAlerts[key];

      const alreadyDetected =
        changes.some(
          (change) =>
            change.type === alert.type
        );

      if (!alreadyDetected) {
        changes.push({
          type: alert.type,

          title: alert.title,

          body:
            alert.description ||
            'A new city alert has been detected.',

          severity:
            alert.severity || 'Medium'
        });
      }
    }
  }

  return changes;
}

// ============================================================
// SEND FCM NOTIFICATION
// ============================================================

async function sendNotification(
  messaging,
  change
) {
  try {
    if (!messaging) {
      console.error(
        'Firebase Messaging is not available.'
      );

      return null;
    }

    const message = {
      topic: 'city_alerts',

      notification: {
        title: change.title,

        body: change.body
      },

      data: {
        type:
          String(change.type || 'alert'),

        severity:
          String(
            change.severity || 'Medium'
          ),

        timestamp:
          new Date().toISOString()
      },

      android: {
        priority: 'high',

        notification: {
          channelId:
            'smart_city_alerts',

          sound: 'default',

          notificationCount: 1
        }
      }
    };

    const response =
      await messaging.send(message);

    console.log(
      'FCM notification sent:',
      change.title
    );

    console.log(
      'Message ID:',
      response
    );

    return response;

  } catch (error) {
    console.error(
      'FCM notification failed:',
      error.message
    );

    return null;
  }
}

// ============================================================
// CHECK ENVIRONMENT
// ============================================================

async function checkEnvironment(messaging) {
  try {
    console.log('');
    console.log(
      '========================================'
    );

    console.log(
      'Checking city environment...'
    );

    console.log(
      'Time:',
      new Date().toLocaleString()
    );

    console.log(
      '========================================'
    );

    const data =
      await getLiveAlerts();

    const currentState =
      createSnapshot(data);

    const previousState =
      loadPreviousState();

    // --------------------------------------------------------
    // FIRST RUN
    // --------------------------------------------------------

    if (!previousState) {
      console.log(
        'No previous environment state found.'
      );

      saveState(currentState);

      // Notify currently active alerts
      for (
        const alert of data.alerts || []
      ) {
        await sendNotification(
          messaging,
          {
            type: alert.type,

            title: alert.title,

            body:
              alert.description ||
              'A city alert is currently active.',

            severity:
              alert.severity || 'Medium'
          }
        );
      }

      return;
    }

    // --------------------------------------------------------
    // DETECT CHANGES
    // --------------------------------------------------------

    const changes =
      detectChanges(
        previousState,
        currentState
      );

    if (changes.length === 0) {
      console.log(
        'No meaningful environmental changes.'
      );

      saveState(currentState);

      return;
    }

    console.log(
      `Detected ${changes.length} meaningful change(s).`
    );

    // --------------------------------------------------------
    // SEND NOTIFICATIONS
    // --------------------------------------------------------

    for (const change of changes) {
      await sendNotification(
        messaging,
        change
      );
    }

    saveState(currentState);

  } catch (error) {
    console.error(
      'Environment monitoring error:',
      error.message
    );
  }
}

// ============================================================
// START MONITOR
// ============================================================

function startAlertMonitor(messaging) {
  console.log('');
  console.log(
    '========================================'
  );

  console.log(
    'Smart City Alert Monitor Started'
  );

  console.log(
    `Checking every ${CHECK_INTERVAL / 60000} minutes`
  );

  console.log(
    '========================================'
  );

  // Check immediately
  checkEnvironment(messaging);

  // Continue checking
  setInterval(() => {
    checkEnvironment(messaging);
  }, CHECK_INTERVAL);
}

module.exports = {
  startAlertMonitor,
  checkEnvironment
};