/**
 * Weather plugin health check
 *
 * Verifies that the Open-Meteo API is reachable and returning valid JSON.
 * Uses a known stable coordinate (0,0 equatorial) for a lightweight ping.
 *
 * Contract (enforced by manifest-validator.js runHealthCheck):
 *   - Must export a `check` function.
 *   - Must return { healthy: boolean, ... }.
 *   - Must complete within 5 seconds (validator enforces this externally).
 *   - This implementation applies its own 4-second HTTP timeout for safety margin.
 */

const https = require("https");

const HEALTH_CHECK_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=0&longitude=0&current=temperature_2m";

const HTTP_TIMEOUT_MS = 4000;

/**
 * Perform an HTTPS GET and return { statusCode, body }.
 *
 * This intentionally duplicates the httpsGet pattern from handler.js rather than
 * importing it, so that the health check module has no coupling to the handler.
 * Health checks must be independently loadable by the registry without pulling in
 * handler-side dependencies.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<{ statusCode: number, body: string }>}
 */
function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(
        new Error("Open-Meteo API request timed out (" + timeoutMs + "ms)")
      );
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Run the health check for the weather plugin.
 *
 * @returns {Promise<{ healthy: boolean, api?: string, latencyMs?: number, error?: string }>}
 */
async function check() {
  const startTime = Date.now();

  let response;
  try {
    response = await httpsGet(HEALTH_CHECK_URL, HTTP_TIMEOUT_MS);
  } catch (err) {
    return { healthy: false, error: err.message };
  }

  const latencyMs = Date.now() - startTime;

  if (response.statusCode !== 200) {
    return {
      healthy: false,
      error: "Open-Meteo API returned HTTP " + response.statusCode,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch (parseErr) {
    return {
      healthy: false,
      error: "Open-Meteo API returned non-JSON response",
    };
  }

  if (!parsed || !parsed.current) {
    return {
      healthy: false,
      error: "Open-Meteo API response missing expected 'current' field",
    };
  }

  return { healthy: true, api: "open-meteo", latencyMs };
}

module.exports = { check };
