/**
 * OpenWeatherMap Adapter — REAL API
 * https://openweathermap.org/api
 * Free: 1,000 calls/day
 */
import { httpsGetJson } from './httpUtil.js';
import { owmIdToCondition } from '../conditions.js';

const API_KEY = process.env.OWM_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';

export async function fetchOpenWeatherMap(lat, lon) {
  const start = Date.now();
  if (!API_KEY || API_KEY === 'your_key_here') {
    return { name: 'OpenWeatherMap', status: 'skipped', responseTime: 0, error: 'API key not configured', data: null };
  }

  try {
    // Current + 5-day/3-hour forecast (free tier)
    const [current, forecast] = await Promise.all([
      httpsGetJson(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`),
      httpsGetJson(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr&cnt=40`),
    ]);

    return {
      name: 'OpenWeatherMap',
      status: 'ok',
      responseTime: Date.now() - start,
      data: normalize(current, forecast),
    };
  } catch (err) {
    console.error(`[OWM] ❌ ${err.message}`);
    return { name: 'OpenWeatherMap', status: 'error', responseTime: Date.now() - start, error: err.message, data: null };
  }
}

function normalize(current, forecast) {
  const cur = current.weather?.[0];
  const currentData = cur ? {
    condition: owmIdToCondition(cur.id),
    temp: current.main.temp,
    feels_like: current.main.feels_like,
    humidity: current.main.humidity,
    wind_speed: current.wind?.speed ? Math.round(current.wind.speed * 3.6 * 10) / 10 : 0, // m/s → km/h
    precipitation_prob: null,
  } : null;

  // Hourly from 3-hour forecast (next 24h = 8 entries)
  const hourly = (forecast.list || []).slice(0, 8).map(item => ({
    time: item.dt_txt,
    condition: owmIdToCondition(item.weather?.[0]?.id || 800),
    temp: item.main.temp,
    precipitation_prob: Math.round((item.pop || 0) * 100),
    wind_speed: item.wind?.speed ? Math.round(item.wind.speed * 3.6 * 10) / 10 : 0,
  }));

  // Daily: aggregate 3-hour intervals by day
  const dayMap = {};
  (forecast.list || []).forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    if (!dayMap[date]) {
      dayMap[date] = { temps: [], conditions: [], precips: [], winds: [] };
    }
    dayMap[date].temps.push(item.main.temp);
    dayMap[date].conditions.push(owmIdToCondition(item.weather?.[0]?.id || 800));
    dayMap[date].precips.push(Math.round((item.pop || 0) * 100));
    dayMap[date].winds.push(item.wind?.speed ? Math.round(item.wind.speed * 3.6 * 10) / 10 : 0);
  });

  const daily = Object.entries(dayMap).slice(0, 7).map(([date, data]) => ({
    date,
    condition: modeOfArray(data.conditions),
    temp_min: Math.min(...data.temps),
    temp_max: Math.max(...data.temps),
    precipitation_prob: Math.max(...data.precips),
    wind_speed: Math.max(...data.winds),
  }));

  return { current: currentData, hourly, daily };
}

function modeOfArray(arr) {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CLOUDY';
}
