/**
 * Aggregator Service
 * Fetches forecasts from all 5 API sources in parallel
 * 
 * 모든 소스가 독립적으로 병렬 실행됩니다.
 * API 키가 없는 소스는 자동으로 skip됩니다.
 */

import { fetchOpenMeteo } from './adapters/openmeteo.js';
import { fetchOpenWeatherMap } from './adapters/openweathermap.js';
import { fetchWeatherAPI } from './adapters/weatherapi.js';
import { fetchKMA } from './adapters/kma.js';
import { fetchTomorrow } from './adapters/tomorrow.js';

/**
 * Fetch forecasts from all 5 sources in parallel (fully independent)
 */
export async function fetchAllForecasts(lat, lon) {
  const results = await Promise.all([
    fetchOpenMeteo(lat, lon),
    fetchOpenWeatherMap(lat, lon),
    fetchWeatherAPI(lat, lon),
    fetchKMA(lat, lon),
    fetchTomorrow(lat, lon),
  ]);

  return results;
}
