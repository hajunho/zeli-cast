/**
 * Aggregator Service
 * Fetches forecasts from all 5 API sources in parallel
 */

import { fetchOpenMeteo } from './adapters/openmeteo.js';
import { fetchOpenWeatherMap, fetchWeatherAPI, fetchKMA, fetchTomorrow } from './adapters/mock.js';

/**
 * Fetch forecasts from all 5 sources in parallel
 * Open-Meteo runs first as the reference, then mock sources use its data as base
 */
export async function fetchAllForecasts(lat, lon) {
  // First, get the real Open-Meteo data as reference
  const openMeteoResult = await fetchOpenMeteo(lat, lon);
  const referenceData = openMeteoResult.data;

  // Then run the other 4 sources in parallel (using reference for realistic mock data)
  const [owm, weatherApi, kma, tomorrow] = await Promise.all([
    fetchOpenWeatherMap(lat, lon, referenceData),
    fetchWeatherAPI(lat, lon, referenceData),
    fetchKMA(lat, lon, referenceData),
    fetchTomorrow(lat, lon, referenceData),
  ]);

  return [openMeteoResult, owm, weatherApi, kma, tomorrow];
}
