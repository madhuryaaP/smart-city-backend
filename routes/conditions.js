const express = require('express');
const https = require('https');

const router = express.Router();

const HYDERABAD_LAT = 17.3850;
const HYDERABAD_LON = 78.4867;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          try {
            const json = JSON.parse(body);

            if (response.statusCode >= 400) {
              reject(
                new Error(
                  json.message ||
                    `External API failed with status ${response.statusCode}`
                )
              );
              return;
            }

            resolve(json);
          } catch (error) {
            reject(
              new Error(
                `Invalid JSON from external API: ${error.message}`
              )
            );
          }
        });
      })
      .on('error', reject);
  });
}

function weatherText(main, description) {
  if (description) {
    return (
      description.charAt(0).toUpperCase() +
      description.slice(1)
    );
  }

  return main || 'Unknown';
}

function trafficLevel(currentSpeed, freeFlowSpeed) {
  if (!currentSpeed || !freeFlowSpeed) {
    return 'Unavailable';
  }

  const ratio = currentSpeed / freeFlowSpeed;

  if (ratio < 0.50) return 'Heavy';
  if (ratio < 0.75) return 'Moderate';

  return 'Light';
}

function aqiLabel(aqi) {
  switch (Number(aqi)) {
    case 1:
      return 'Good';

    case 2:
      return 'Fair';

    case 3:
      return 'Moderate';

    case 4:
      return 'Poor';

    case 5:
      return 'Very Poor';

    default:
      return 'Unavailable';
  }
}

router.get('/', async (req, res) => {
  try {
    if (!process.env.OPENWEATHER_API_KEY) {
      throw new Error(
        'OPENWEATHER_API_KEY is not configured'
      );
    }

    const weatherUrl =
      'https://api.openweathermap.org/data/2.5/weather' +
      `?lat=${HYDERABAD_LAT}` +
      `&lon=${HYDERABAD_LON}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}` +
      '&units=metric';

    const forecastUrl =
      'https://api.openweathermap.org/data/2.5/forecast' +
      `?lat=${HYDERABAD_LAT}` +
      `&lon=${HYDERABAD_LON}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}` +
      '&units=metric' +
      '&cnt=8';

    const pollutionUrl =
      'https://api.openweathermap.org/data/2.5/air_pollution' +
      `?lat=${HYDERABAD_LAT}` +
      `&lon=${HYDERABAD_LON}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}`;

    const trafficUrl = process.env.TOMTOM_API_KEY
      ? 'https://api.tomtom.com/traffic/services/4/' +
        'flowSegmentData/absolute/10/json' +
        `?point=${HYDERABAD_LAT},${HYDERABAD_LON}` +
        '&unit=KMPH' +
        `&key=${process.env.TOMTOM_API_KEY}`
      : null;

    const [
      weatherResult,
      forecastResult,
      pollutionResult,
      trafficResult,
    ] = await Promise.allSettled([
      fetchJson(weatherUrl),
      fetchJson(forecastUrl),
      fetchJson(pollutionUrl),
      trafficUrl
        ? fetchJson(trafficUrl)
        : Promise.resolve(null),
    ]);

    if (weatherResult.status === 'rejected') {
      throw weatherResult.reason;
    }

    if (forecastResult.status === 'rejected') {
      throw forecastResult.reason;
    }

    if (pollutionResult.status === 'rejected') {
      throw pollutionResult.reason;
    }

    const weather = weatherResult.value;
    const forecast = forecastResult.value;
    const pollution = pollutionResult.value;

    const traffic =
      trafficResult.status === 'fulfilled'
        ? trafficResult.value
        : null;

    const currentWeather =
      weather.weather?.[0] || {};

    const current =
      weather.main || {};

    const forecastItems =
      Array.isArray(forecast.list)
        ? forecast.list
        : [];

    const rainProbabilities =
      forecastItems
        .map((item) => Number(item.pop || 0))
        .filter((value) => Number.isFinite(value));

    const maxRainProbability =
      rainProbabilities.length
        ? Math.round(
            Math.max(...rainProbabilities) * 100
          )
        : 0;

    const nextRain =
      forecastItems.find(
        (item) => Number(item.pop || 0) >= 0.30
      );

    const pollutionData =
      pollution.list?.[0] || {};

    const pollutionMain =
      pollutionData.main || {};

    const components =
      pollutionData.components || {};

    const flow =
      traffic?.flowSegmentData || {};

    const currentSpeed =
      Number(flow.currentSpeed || 0);

    const freeFlowSpeed =
      Number(
        flow.freeFlowSpeed ??
        flow.freeFlow ??
        0
      );

    const trafficPercentage =
      freeFlowSpeed > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (1 - currentSpeed / freeFlowSpeed) * 100
              )
            )
          )
        : 0;

    const response = {
      success: true,

      location: {
        city: 'Hyderabad',
        latitude: HYDERABAD_LAT,
        longitude: HYDERABAD_LON,
      },

      updatedAt:
        new Date().toISOString(),

      weather: {
        temperature:
          Number(current.temp),

        feelsLike:
          Number(current.feels_like),

        humidity:
          Number(current.humidity),

        condition:
          weatherText(
            currentWeather.main,
            currentWeather.description
          ),

        main:
          currentWeather.main ||
          'Unknown',

        icon:
          currentWeather.icon ||
          null,
      },

      rainfall: {
        probability:
          maxRainProbability,

        description:
          maxRainProbability >= 70
            ? 'Heavy rainfall expected'
            : maxRainProbability >= 40
              ? 'Rain possible'
              : 'Low chance of rain',

        nextRainTime:
          nextRain?.dt_txt || null,
      },

      aqi: {
        value:
          Number(pollutionMain.aqi || 0),

        label:
          aqiLabel(
            pollutionMain.aqi
          ),

        pm2_5:
          Number(
            components.pm2_5 || 0
          ),

        pm10:
          Number(
            components.pm10 || 0
          ),
      },

      traffic: {
        status:
          traffic
            ? trafficLevel(
                currentSpeed,
                freeFlowSpeed
              )
            : 'Unavailable',

        currentSpeed,

        freeFlowSpeed,

        trafficPercentage,

        confidence:
          flow.confidence || null,
      },

      sources: [
        'OpenWeather',
        'TomTom',
      ],
    };

    res.json(response);

  } catch (error) {
    console.error(
      'Conditions API error:',
      error.message
    );

    res.status(500).json({
      success: false,

      message:
        'Unable to fetch live city conditions',

      error:
        error.message,
    });
  }
});

module.exports = router;