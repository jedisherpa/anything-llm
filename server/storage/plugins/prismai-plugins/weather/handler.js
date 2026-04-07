/**
 * Weather plugin handler
 *
 * Fetches real weather data from the Open-Meteo API (free, no API key required).
 * Demonstrates async HTTP calls and the secrets env-var fallback pattern.
 *
 * Two-step process:
 *   1. Geocode the location name to coordinates via Open-Meteo geocoding API.
 *   2. Fetch current weather for those coordinates.
 */

const https = require("https");

// Secrets pattern: check env var but Open-Meteo needs no key.
// When Sprint 2 delivers secrets-bridge, replace with getSecret("weather", "WEATHER_API_KEY").
const _apiKey = process.env.WEATHER_API_KEY || null; // eslint-disable-line no-unused-vars

/** WMO weather code to human-readable description mapping (partial). */
const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/**
 * Perform an HTTPS GET request and return the parsed JSON body.
 *
 * @param {string} url
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<object>}
 */
function httpsGetJson(url, timeoutMs) {
  const timeout = timeoutMs !== undefined ? timeoutMs : 10000;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              "HTTP " + res.statusCode + " from " + url
            )
          );
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (parseErr) {
          reject(new Error("Failed to parse JSON response: " + parseErr.message));
        }
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy(new Error("Request timed out after " + timeout + "ms"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Get the current weather forecast for a named location.
 *
 * @param {{ location: string }} args
 * @returns {Promise<object>}
 */
async function get_forecast(args) {
  const location = args && args.location ? String(args.location).trim() : "";
  if (!location) {
    return { error: "location is required" };
  }

  // Step 1: Geocode location name to coordinates
  const geocodeUrl =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(location) +
    "&count=1";

  let geocodeData;
  try {
    geocodeData = await httpsGetJson(geocodeUrl, 10000);
  } catch (err) {
    return { error: "Weather API request failed: " + err.message };
  }

  if (
    !geocodeData.results ||
    !Array.isArray(geocodeData.results) ||
    geocodeData.results.length === 0
  ) {
    return { error: "Location not found: " + location };
  }

  const place = geocodeData.results[0];
  const latitude = place.latitude;
  const longitude = place.longitude;
  const resolvedName = place.name || location;
  const country = place.country || "";

  // Step 2: Fetch current weather
  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + latitude +
    "&longitude=" + longitude +
    "&current=temperature_2m,wind_speed_10m,weather_code" +
    "&timezone=auto";

  let forecastData;
  try {
    forecastData = await httpsGetJson(forecastUrl, 10000);
  } catch (err) {
    return { error: "Weather API request failed: " + err.message };
  }

  if (!forecastData.current) {
    return { error: "Unexpected API response: missing current weather data" };
  }

  const current = forecastData.current;
  const weatherCode = current.weather_code;
  const weatherDescription =
    WEATHER_CODES[weatherCode] !== undefined
      ? WEATHER_CODES[weatherCode]
      : "Unknown (code " + weatherCode + ")";

  return {
    location: resolvedName,
    country,
    temperature_c: current.temperature_2m,
    wind_speed_kmh: current.wind_speed_10m,
    weather: weatherDescription,
    weather_code: weatherCode,
    coordinates: { latitude, longitude },
  };
}

module.exports = { get_forecast };
