const express = require('express');
const https = require('https');

const router = express.Router();

// ============================================================
// HTTPS JSON HELPER
// ============================================================

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const json = JSON.parse(data);

          if (response.statusCode >= 400) {
            reject(
              new Error(
                json.message ||
                  `API request failed: ${response.statusCode}`
              )
            );
            return;
          }

          resolve(json);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
  });
}

// ============================================================
// GET LIVE ENVIRONMENT DATA + ALERTS
// ============================================================

async function getLiveAlerts() {
  const alerts = [];

  // ==========================================================
  // 1. OPENWEATHER
  // ==========================================================

  const weatherUrl =
    'https://api.openweathermap.org/data/2.5/weather' +
    '?q=Hyderabad' +
    '&appid=' +
    process.env.OPENWEATHER_API_KEY +
    '&units=metric';

  const weather = await fetchJson(weatherUrl);

  const weatherMain = weather.weather?.[0]?.main;
  const weatherDescription = weather.weather?.[0]?.description;

  const temperature = Number(weather.main?.temp);
  const humidity = Number(weather.main?.humidity);

  // ----------------------------------------------------------
  // Rain / Thunderstorm
  // ----------------------------------------------------------

  if (
    weatherMain === 'Rain' ||
    weatherMain === 'Thunderstorm'
  ) {
    alerts.push({
      title:
        weatherMain === 'Thunderstorm'
          ? 'Thunderstorm Alert'
          : 'Rainfall Alert',

      description:
        `Current weather in Hyderabad: ${weatherDescription}. ` +
        `Temperature is ${temperature}°C.`,

      source: 'OpenWeather',

      severity:
        weatherMain === 'Thunderstorm'
          ? 'High'
          : 'Medium',

      type: 'weather',

      icon:
        weatherMain === 'Thunderstorm'
          ? 'thunderstorm'
          : 'rain',

      // Important:
      // Stable identifier for detecting changes.
      condition:
        weatherMain === 'Thunderstorm'
          ? 'thunderstorm'
          : 'rain',
    });
  }

  // ----------------------------------------------------------
  // High temperature
  // ----------------------------------------------------------

  if (temperature >= 35) {
    alerts.push({
      title: 'High Temperature',

      description:
        `Temperature in Hyderabad is currently ` +
        `${temperature}°C.`,

      source: 'OpenWeather',
      severity: 'High',
      type: 'weather',
      icon: 'temperature',

      condition: 'high_temperature',
    });
  }

  // ----------------------------------------------------------
  // High humidity
  // ----------------------------------------------------------

  if (humidity >= 85) {
    alerts.push({
      title: 'High Humidity',

      description:
        `Humidity in Hyderabad is currently ` +
        `${humidity}%.`,

      source: 'OpenWeather',
      severity: 'Medium',
      type: 'weather',
      icon: 'humidity',

      condition: 'high_humidity',
    });
  }

  // ==========================================================
  // 2. TOMTOM TRAFFIC
  // ==========================================================

  const trafficUrl =
    'https://api.tomtom.com/traffic/services/4/' +
    'flowSegmentData/absolute/10/json' +
    '?point=17.3850,78.4867' +
    '&unit=KMPH' +
    '&key=' +
    process.env.TOMTOM_API_KEY;

  const traffic = await fetchJson(trafficUrl);

  const flow = traffic.flowSegmentData;

  let currentSpeed = null;
  let freeFlowSpeed = null;
  let trafficLevel = 'normal';

  if (flow) {
    currentSpeed = Number(flow.currentSpeed);
    freeFlowSpeed = Number(flow.freeFlowSpeed);

    if (
      currentSpeed > 0 &&
      freeFlowSpeed > 0
    ) {
      const speedRatio =
        currentSpeed / freeFlowSpeed;

      if (speedRatio < 0.5) {
        trafficLevel = 'heavy';

        alerts.push({
          title: 'Heavy Traffic',

          description:
            `Traffic is moving at ${currentSpeed} km/h ` +
            `compared with a normal speed of ` +
            `${freeFlowSpeed} km/h.`,

          source: 'TomTom',
          severity: 'High',
          type: 'traffic',
          icon: 'traffic',

          condition: 'heavy_traffic',
        });
      } else if (speedRatio < 0.7) {
        trafficLevel = 'moderate';

        alerts.push({
          title: 'Traffic Congestion',

          description:
            `Traffic is slower than normal at ` +
            `${currentSpeed} km/h.`,

          source: 'TomTom',
          severity: 'Medium',
          type: 'traffic',
          icon: 'traffic',

          condition: 'traffic_congestion',
        });
      }
    }
  }

  // ==========================================================
  // 3. OPENAQ
  // ==========================================================

  const airQualityUrl =
    'https://api.openaq.org/v3/locations' +
    '?coordinates=17.3850,78.4867' +
    '&radius=10000' +
    '&limit=5';

  const airQuality = await fetchJson(
    airQualityUrl,
    {
      headers: {
        'X-API-Key': process.env.OPENAQ_API_KEY,
      },
    }
  );

  const locations =
    airQuality.results || [];

  let pm25Value = null;

  for (const location of locations) {
    const sensors =
      location.sensors || [];

    for (const sensor of sensors) {
      if (
        sensor.parameter?.name !== 'pm25'
      ) {
        continue;
      }

      try {
        const measurementUrl =
          `https://api.openaq.org/v3/sensors/${sensor.id}/hours?limit=1&page=1`;

        const measurement =
          await fetchJson(
            measurementUrl,
            {
              headers: {
                'X-API-Key':
                  process.env.OPENAQ_API_KEY,
              },
            }
          );

        const result =
          measurement.results?.[0];

        if (
          result &&
          typeof result.value === 'number'
        ) {
          pm25Value =
            Number(result.value);

          console.log(
            `OpenAQ PM2.5 from sensor ${sensor.id}: ${pm25Value}`
          );

          break;
        }
      } catch (error) {
        console.log(
          `OpenAQ sensor ${sensor.id} failed:`,
          error.message
        );
      }
    }

    if (pm25Value !== null) {
      break;
    }
  }

  // ----------------------------------------------------------
  // Poor air quality
  // ----------------------------------------------------------

  if (
    pm25Value !== null &&
    pm25Value >= 55
  ) {
    alerts.push({
      title: 'Poor Air Quality',

      description:
        `PM2.5 level is currently ` +
        `${pm25Value.toFixed(1)} µg/m³ near Hyderabad.`,

      source: 'OpenAQ',

      severity:
        pm25Value >= 150
          ? 'High'
          : 'Medium',

      type: 'air_quality',
      icon: 'air',

      condition: 'poor_air_quality',
    });
  }

  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  return {
    location: 'Hyderabad',

    generatedAt:
      new Date().toISOString(),

    weather: {
      temperature,
      feelsLike:
        Number(weather.main?.feels_like),
      humidity,
      description: weatherDescription,
      windSpeed:
        Number(weather.wind?.speed),
      clouds:
        Number(weather.clouds?.all),
      weatherMain,
    },

    traffic: {
      currentSpeed,
      freeFlowSpeed,
      level: trafficLevel,
    },

    airQuality: {
      pm25: pm25Value,
    },

    alerts,
  };
}

// ============================================================
// API ROUTE
// ============================================================

router.get('/', async (req, res) => {
  try {
    const data = await getLiveAlerts();

    res.json({
      success: true,
      ...data,

      sources: [
        'OpenWeather',
        'TomTom',
        'OpenAQ',
      ],
    });
  } catch (error) {
    console.error(
      'Live alerts error:',
      error.message
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// EXPORT BOTH ROUTER + FUNCTION
// ============================================================

router.getLiveAlerts = getLiveAlerts;

module.exports = router;
module.exports.getLiveAlerts = getLiveAlerts;