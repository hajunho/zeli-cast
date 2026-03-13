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
 * If reference is null (Open-Meteo failed), generate standalone data
 */
function generateMockFromReference(reference, sourceName, agreeChance = 0.7) {
  // Open-Meteo 실패 시 — 독립적으로 데이터 생성
  if (!reference) {
    reference = generateFallbackData();
  }

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

/**
 * Open-Meteo 없이도 합리적인 날씨 데이터 생성 (fallback)
 */
function generateFallbackData() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  // 서울 기준 월별 평균 기온 (대략)
  const avgTemps = [-2, 0, 5, 12, 18, 23, 26, 27, 22, 15, 7, 0];
  const baseTemp = avgTemps[month] ?? 15;
  const conditions = ['CLEAR', 'PARTLY_CLOUDY', 'CLOUDY'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];

  const current = {
    condition,
    temp: baseTemp + (Math.random() * 6 - 3),
    feels_like: baseTemp + (Math.random() * 4 - 4),
    humidity: 40 + Math.random() * 30,
    wind_speed: 2 + Math.random() * 8,
    precipitation_prob: Math.round(Math.random() * 30),
  };

  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now.getTime() + i * 3600000);
    hourly.push({
      time: hour.toISOString(),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      temp: baseTemp + (Math.random() * 8 - 4) - (i > 12 ? 3 : 0),
      precipitation_prob: Math.round(Math.random() * 25),
      wind_speed: 2 + Math.random() * 8,
    });
  }

  const daily = [];
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    daily.push({
      date: d.toISOString().split('T')[0],
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      temp_min: baseTemp - 3 + (Math.random() * 2),
      temp_max: baseTemp + 3 + (Math.random() * 2),
      precipitation_prob: Math.round(Math.random() * 30),
      wind_speed: 2 + Math.random() * 8,
    });
  }

  return { current, hourly, daily };
}
