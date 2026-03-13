/**
 * WeatherAPI.com Adapter — REAL API
 * https://www.weatherapi.com/
 * Free: 1,000,000 calls/month
 */
import { httpsGetJson } from './httpUtil.js';
import { CONDITIONS } from '../conditions.js';

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

    if (json.error) throw new Error(json.error.message);

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
    condition: weatherApiCondition(c.condition?.code),
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
          condition: weatherApiCondition(h.condition?.code),
          temp: h.temp_c,
          precipitation_prob: h.chance_of_rain || 0,
          wind_speed: h.wind_kph,
        });
      }
    });
  });

  const daily = (json.forecast?.forecastday || []).map(day => ({
    date: day.date,
    condition: weatherApiCondition(day.day?.condition?.code),
    temp_min: day.day.mintemp_c,
    temp_max: day.day.maxtemp_c,
    precipitation_prob: day.day.daily_chance_of_rain || 0,
    wind_speed: day.day.maxwind_kph,
  }));

  return { current, hourly, daily };
}

/**
 * WeatherAPI.com condition code → 8종 통일 카테고리
 * https://www.weatherapi.com/docs/weather_conditions.json
 */
function weatherApiCondition(code) {
  if (!code) return CONDITIONS.CLOUDY;
  const c = parseInt(code);

  // Sunny / Clear
  if (c === 1000) return CONDITIONS.CLEAR;

  // Partly cloudy
  if (c === 1003) return CONDITIONS.PARTLY_CLOUDY;

  // Cloudy / Overcast
  if (c === 1006 || c === 1009) return CONDITIONS.CLOUDY;

  // Fog / Mist
  if (c === 1030 || c === 1135 || c === 1147) return CONDITIONS.FOG;

  // Light rain / Drizzle / Patchy rain
  if ([1063, 1150, 1153, 1168, 1180, 1183, 1186, 1189, 1240].includes(c))
    return CONDITIONS.RAIN;

  // Heavy rain / Thunderstorm
  if ([1087, 1192, 1195, 1243, 1246, 1273, 1276].includes(c))
    return CONDITIONS.HEAVY_RAIN;

  // Snow
  if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258, 1279, 1282].includes(c))
    return CONDITIONS.SNOW;

  // Sleet / Freezing
  if ([1069, 1072, 1171, 1198, 1201, 1204, 1207, 1237, 1249, 1252].includes(c))
    return CONDITIONS.SLEET;

  return CONDITIONS.CLOUDY;
}
