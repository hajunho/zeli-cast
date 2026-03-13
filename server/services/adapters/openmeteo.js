/**
 * Open-Meteo Adapter — REAL API (no key required)
 * https://open-meteo.com/
 */
import https from 'https';
import { wmoCodeToCondition } from '../conditions.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Node.js https.get wrapper → Promise<JSON> (IPv4 강제 — AWS EC2 IPv6 이슈 방지) */
function httpsGetJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      family: 4,  // ← IPv4 강제 (EC2 IPv6 차단 대응)
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

export async function fetchOpenMeteo(lat, lon) {
  const start = Date.now();
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
      hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
      timezone: 'Asia/Seoul',
      forecast_days: 7,
    });

    const json = await httpsGetJson(`${BASE_URL}?${params}`);

    return {
      name: 'Open-Meteo',
      status: 'ok',
      responseTime: Date.now() - start,
      data: normalize(json),
    };
  } catch (err) {
    console.error(`[Open-Meteo] ❌ ${err.code || ''} ${err.message}`);
    return {
      name: 'Open-Meteo',
      status: 'error',
      responseTime: Date.now() - start,
      error: err.message,
      data: null,
    };
  }
}

function normalize(json) {
  const current = json.current ? {
    condition: wmoCodeToCondition(json.current.weather_code),
    temp: json.current.temperature_2m,
    feels_like: json.current.apparent_temperature,
    humidity: json.current.relative_humidity_2m,
    wind_speed: json.current.wind_speed_10m,
    precipitation_prob: null,
  } : null;

  const hourly = [];
  if (json.hourly) {
    const now = new Date();
    for (let i = 0; i < json.hourly.time.length && hourly.length < 24; i++) {
      const t = new Date(json.hourly.time[i]);
      if (t >= now) {
        hourly.push({
          time: json.hourly.time[i],
          condition: wmoCodeToCondition(json.hourly.weather_code[i]),
          temp: json.hourly.temperature_2m[i],
          precipitation_prob: json.hourly.precipitation_probability[i],
          wind_speed: json.hourly.wind_speed_10m[i],
        });
      }
    }
  }

  const daily = [];
  if (json.daily) {
    for (let i = 0; i < json.daily.time.length; i++) {
      daily.push({
        date: json.daily.time[i],
        condition: wmoCodeToCondition(json.daily.weather_code[i]),
        temp_min: json.daily.temperature_2m_min[i],
        temp_max: json.daily.temperature_2m_max[i],
        precipitation_prob: json.daily.precipitation_probability_max[i],
        wind_speed: json.daily.wind_speed_10m_max[i],
      });
    }
  }

  return { current, hourly, daily };
}
