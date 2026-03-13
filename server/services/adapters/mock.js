/**
 * Simulated API Adapters
 *
 * These adapters generate realistic weather data that varies slightly between
 * sources to demonstrate the consensus algorithm. When real API keys are added,
 * each adapter can be replaced with actual API calls.
 *
 * The mock data is based on the Open-Meteo data with realistic perturbations
 * to simulate how different weather models produce varying forecasts.
 */

import { CONDITIONS } from '../conditions.js';

const ALL_CONDITIONS = Object.values(CONDITIONS);

/**
 * Generate a perturbed condition based on a reference
 * ~70% chance of matching the reference (simulates real-world API agreement)
 */
function perturbCondition(reference, agreeChance = 0.7) {
  if (Math.random() < agreeChance) return reference;
  // Pick a "nearby" condition
  const neighbors = {
    CLEAR: ['PARTLY_CLOUDY'],
    PARTLY_CLOUDY: ['CLEAR', 'CLOUDY'],
    CLOUDY: ['PARTLY_CLOUDY', 'RAIN'],
    RAIN: ['CLOUDY', 'HEAVY_RAIN'],
    HEAVY_RAIN: ['RAIN'],
    SNOW: ['SLEET', 'CLOUDY'],
    SLEET: ['SNOW', 'RAIN'],
    FOG: ['CLOUDY', 'PARTLY_CLOUDY'],
  };
  const pool = neighbors[reference] || ['CLOUDY'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function perturbTemp(ref, range = 2) {
  return Math.round((ref + (Math.random() * range * 2 - range)) * 10) / 10;
}

function perturbPercent(ref, range = 15) {
  return Math.max(0, Math.min(100, Math.round(ref + (Math.random() * range * 2 - range))));
}

/**
 * Generate simulated data based on a reference forecast (from Open-Meteo)
 */
function generateMockFromReference(reference, sourceName, agreeChance = 0.7) {
  if (!reference) return null;

  const current = reference.current ? {
    condition: perturbCondition(reference.current.condition, agreeChance),
    temp: perturbTemp(reference.current.temp),
    feels_like: reference.current.feels_like ? perturbTemp(reference.current.feels_like) : null,
    humidity: perturbPercent(reference.current.humidity, 8),
    wind_speed: Math.max(0, perturbTemp(reference.current.wind_speed, 3)),
    precipitation_prob: reference.current.precipitation_prob != null
      ? perturbPercent(reference.current.precipitation_prob)
      : Math.round(Math.random() * 30),
  } : null;

  const hourly = (reference.hourly || []).map(h => ({
    time: h.time,
    condition: perturbCondition(h.condition, agreeChance),
    temp: perturbTemp(h.temp),
    precipitation_prob: perturbPercent(h.precipitation_prob || 0),
    wind_speed: Math.max(0, perturbTemp(h.wind_speed || 0, 3)),
  }));

  const daily = (reference.daily || []).map(d => ({
    date: d.date,
    condition: perturbCondition(d.condition, agreeChance),
    temp_min: perturbTemp(d.temp_min),
    temp_max: perturbTemp(d.temp_max),
    precipitation_prob: perturbPercent(d.precipitation_prob || 0),
    wind_speed: d.wind_speed ? Math.max(0, perturbTemp(d.wind_speed, 3)) : null,
  }));

  return { current, hourly, daily };
}

/**
 * Create a simulated adapter for a given API source
 */
export function createMockAdapter(sourceName, agreeChance = 0.7) {
  return async function fetchMock(lat, lon, referenceData) {
    const start = Date.now();
    try {
      // Simulate network latency (100-800ms)
      await new Promise(r => setTimeout(r, 100 + Math.random() * 700));

      const data = generateMockFromReference(referenceData, sourceName, agreeChance);

      return {
        name: sourceName,
        status: 'ok',
        responseTime: Date.now() - start,
        data,
      };
    } catch (err) {
      return {
        name: sourceName,
        status: 'error',
        responseTime: Date.now() - start,
        error: err.message,
        data: null,
      };
    }
  };
}

// Pre-built mock adapters with different agreement rates
export const fetchOpenWeatherMap = createMockAdapter('OpenWeatherMap', 0.75);
export const fetchWeatherAPI = createMockAdapter('WeatherAPI', 0.70);
export const fetchKMA = createMockAdapter('기상청', 0.80);  // Korean Met Agency - higher accuracy for Korea
export const fetchTomorrow = createMockAdapter('Tomorrow.io', 0.65);
