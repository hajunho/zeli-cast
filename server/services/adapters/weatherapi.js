/**
 * WeatherAPI Adapter — REAL API
 * https://www.weatherapi.com/
 * Free: 1,000,000 calls/month
 */
import { httpsGetJson } from './httpUtil.js';
import { textToCondition } from '../conditions.js';

const API_KEY = process.env.WEATHERAPI_KEY;
const BASE = 'https://api.weatherapi.com/v1';

export async function fetchWeatherAPI(lat, lon) {
  const start = Date.now();
  if (!API_KEY || API_KEY === 'your_key_here') {
    return { name: 'WeatherAPI', status: 'skipped', responseTime: 0, error: 'API key not configured', data: null };
  }

  try {
    const json = await httpsGetJson(
      `${BASE}/forecast.json?key=${API_KEY}&q=${lat},${lon}&days=7&lang=ko&aqi=no`
    );

    return {
      name: 'WeatherAPI',
      status: 'ok',
      responseTime: Date.now() - start,
      data: normalize(json),
    };
  } catch (err) {
    console.error(`[WeatherAPI] ❌ ${err.message}`);
    return { name: 'WeatherAPI', status: 'error', responseTime: Date.now() - start, error: err.message, data: null };
  }
}

function normalize(json) {
  const c = json.current;
  const current = c ? {
    condition: textToCondition(c.condition?.text || ''),
    temp: c.temp_c,
    feels_like: c.feelslike_c,
    humidity: c.humidity,
    wind_speed: c.wind_kph,
    precipitation_prob: null,
  } : null;

  // Hourly from forecast days
  const hourly = [];
  const now = new Date();
  (json.forecast?.forecastday || []).forEach(day => {
    (day.hour || []).forEach(h => {
      const hTime = new Date(h.time);
      if (hTime >= now && hourly.length < 24) {
        hourly.push({
          time: h.time,
          condition: textToCondition(h.condition?.text || ''),
          temp: h.temp_c,
          precipitation_prob: h.chance_of_rain || 0,
          wind_speed: h.wind_kph,
        });
      }
    });
  });

  const daily = (json.forecast?.forecastday || []).map(day => ({
    date: day.date,
    condition: textToCondition(day.day?.condition?.text || ''),
    temp_min: day.day.mintemp_c,
    temp_max: day.day.maxtemp_c,
    precipitation_prob: day.day.daily_chance_of_rain || 0,
    wind_speed: day.day.maxwind_kph,
  }));

  return { current, hourly, daily };
}
