/**
 * Tomorrow.io Adapter — REAL API
 * https://www.tomorrow.io/weather-api/
 * Free: 500 calls/day
 */
import { httpsGetJson } from './httpUtil.js';
import { CONDITIONS } from '../conditions.js';

const API_KEY = process.env.TOMORROW_API_KEY;
const BASE = 'https://api.tomorrow.io/v4';

export async function fetchTomorrow(lat, lon) {
  const start = Date.now();
  if (!API_KEY || API_KEY === 'your_key_here') {
    return { name: 'Tomorrow.io', status: 'skipped', responseTime: 0, error: 'API key not configured', data: null };
  }

  try {
    const json = await httpsGetJson(
      `${BASE}/weather/forecast?location=${lat},${lon}&apikey=${API_KEY}&units=metric&timesteps=1h,1d`
    );

    return {
      name: 'Tomorrow.io',
      status: 'ok',
      responseTime: Date.now() - start,
      data: normalize(json),
    };
  } catch (err) {
    console.error(`[Tomorrow.io] ❌ ${err.message}`);
    return { name: 'Tomorrow.io', status: 'error', responseTime: Date.now() - start, error: err.message, data: null };
  }
}

function normalize(json) {
  const timelines = json.timelines || {};

  // Current: first hourly entry
  const firstHour = timelines.hourly?.[0]?.values;
  const current = firstHour ? {
    condition: tomorrowCodeToCondition(firstHour.weatherCode),
    temp: firstHour.temperature,
    feels_like: firstHour.temperatureApparent,
    humidity: firstHour.humidity,
    wind_speed: firstHour.windSpeed ? Math.round(firstHour.windSpeed * 3.6 * 10) / 10 : 0, // m/s → km/h
    precipitation_prob: firstHour.precipitationProbability || 0,
  } : null;

  // Hourly
  const hourly = (timelines.hourly || []).slice(0, 24).map(h => ({
    time: h.time,
    condition: tomorrowCodeToCondition(h.values.weatherCode),
    temp: h.values.temperature,
    precipitation_prob: h.values.precipitationProbability || 0,
    wind_speed: h.values.windSpeed ? Math.round(h.values.windSpeed * 3.6 * 10) / 10 : 0,
  }));

  // Daily
  const daily = (timelines.daily || []).slice(0, 7).map(d => ({
    date: d.time.split('T')[0],
    condition: tomorrowCodeToCondition(d.values.weatherCodeMax),
    temp_min: d.values.temperatureMin,
    temp_max: d.values.temperatureMax,
    precipitation_prob: d.values.precipitationProbabilityMax || 0,
    wind_speed: d.values.windSpeedMax ? Math.round(d.values.windSpeedMax * 3.6 * 10) / 10 : 0,
  }));

  return { current, hourly, daily };
}

/**
 * Tomorrow.io weatherCode → 8종 condition
 * https://docs.tomorrow.io/reference/data-layers-weather-codes
 */
function tomorrowCodeToCondition(code) {
  if (!code) return CONDITIONS.CLOUDY;
  const c = parseInt(code);

  if (c === 1000) return CONDITIONS.CLEAR;          // Clear
  if (c === 1100 || c === 1101) return CONDITIONS.PARTLY_CLOUDY; // Mostly Clear, Partly Cloudy
  if (c === 1102 || c === 1001) return CONDITIONS.CLOUDY; // Mostly Cloudy, Cloudy
  if (c >= 2000 && c <= 2100) return CONDITIONS.FOG;     // Fog, Light Fog
  if (c >= 4000 && c <= 4001) return CONDITIONS.RAIN;    // Drizzle, Rain
  if (c === 4200) return CONDITIONS.RAIN;                // Light Rain
  if (c === 4201) return CONDITIONS.HEAVY_RAIN;          // Heavy Rain
  if (c >= 5000 && c <= 5001) return CONDITIONS.SNOW;    // Snow, Flurries
  if (c === 5100) return CONDITIONS.SNOW;                // Light Snow
  if (c === 5101) return CONDITIONS.SNOW;                // Heavy Snow
  if (c >= 6000 && c <= 6201) return CONDITIONS.SLEET;   // Freezing Drizzle/Rain
  if (c >= 7000 && c <= 7102) return CONDITIONS.SLEET;   // Ice Pellets
  if (c >= 8000) return CONDITIONS.HEAVY_RAIN;           // Thunderstorm
  return CONDITIONS.CLOUDY;
}
