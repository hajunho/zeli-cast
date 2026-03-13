/**
 * Weather Condition Normalization
 * Maps various weather conditions from different APIs to 8 unified categories
 */

export const CONDITIONS = {
  CLEAR: 'CLEAR',
  PARTLY_CLOUDY: 'PARTLY_CLOUDY',
  CLOUDY: 'CLOUDY',
  RAIN: 'RAIN',
  HEAVY_RAIN: 'HEAVY_RAIN',
  SNOW: 'SNOW',
  SLEET: 'SLEET',
  FOG: 'FOG',
};

export const CONDITION_LABELS = {
  CLEAR: '맑음',
  PARTLY_CLOUDY: '구름 조금',
  CLOUDY: '흐림',
  RAIN: '비',
  HEAVY_RAIN: '폭우',
  SNOW: '눈',
  SLEET: '진눈깨비',
  FOG: '안개',
};

export const CONDITION_ICONS = {
  CLEAR: '☀️',
  PARTLY_CLOUDY: '⛅',
  CLOUDY: '☁️',
  RAIN: '🌧️',
  HEAVY_RAIN: '⛈️',
  SNOW: '🌨️',
  SLEET: '🌧️',
  FOG: '🌫️',
};

/**
 * WMO Weather Interpretation Codes → Unified Condition
 * Used by Open-Meteo
 */
export function wmoCodeToCondition(code) {
  if (code <= 1) return CONDITIONS.CLEAR;
  if (code === 2) return CONDITIONS.PARTLY_CLOUDY;
  if (code === 3) return CONDITIONS.CLOUDY;
  if (code >= 45 && code <= 48) return CONDITIONS.FOG;
  if (code >= 51 && code <= 55) return CONDITIONS.RAIN;
  if (code >= 56 && code <= 57) return CONDITIONS.SLEET;
  if (code >= 61 && code <= 63) return CONDITIONS.RAIN;
  if (code >= 65 && code <= 67) return CONDITIONS.HEAVY_RAIN;
  if (code >= 71 && code <= 77) return CONDITIONS.SNOW;
  if (code >= 80 && code <= 82) return CONDITIONS.RAIN;
  if (code >= 85 && code <= 86) return CONDITIONS.SNOW;
  if (code >= 95 && code <= 99) return CONDITIONS.HEAVY_RAIN;
  return CONDITIONS.CLOUDY;
}

/**
 * OpenWeatherMap condition IDs → Unified Condition
 */
export function owmIdToCondition(id) {
  if (id >= 200 && id < 300) return CONDITIONS.HEAVY_RAIN; // Thunderstorm
  if (id >= 300 && id < 400) return CONDITIONS.RAIN;       // Drizzle
  if (id >= 500 && id < 505) return CONDITIONS.RAIN;       // Rain
  if (id >= 505 && id < 600) return CONDITIONS.HEAVY_RAIN; // Heavy rain
  if (id >= 600 && id < 613) return CONDITIONS.SNOW;       // Snow
  if (id >= 613 && id < 700) return CONDITIONS.SLEET;      // Sleet
  if (id >= 700 && id < 800) return CONDITIONS.FOG;        // Atmosphere
  if (id === 800) return CONDITIONS.CLEAR;                 // Clear
  if (id === 801) return CONDITIONS.PARTLY_CLOUDY;         // Few clouds
  if (id >= 802) return CONDITIONS.CLOUDY;                 // Clouds
  return CONDITIONS.CLOUDY;
}

/**
 * Generic text-based condition mapping
 */
export function textToCondition(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('thunder') || lower.includes('heavy rain') || lower.includes('폭우')) return CONDITIONS.HEAVY_RAIN;
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower') || lower.includes('비')) return CONDITIONS.RAIN;
  if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('눈')) return CONDITIONS.SNOW;
  if (lower.includes('sleet') || lower.includes('freezing') || lower.includes('진눈깨비')) return CONDITIONS.SLEET;
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze') || lower.includes('안개')) return CONDITIONS.FOG;
  if (lower.includes('clear') || lower.includes('sunny') || lower.includes('맑')) return CONDITIONS.CLEAR;
  if (lower.includes('partly') || lower.includes('구름 조금')) return CONDITIONS.PARTLY_CLOUDY;
  if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('흐림') || lower.includes('흐')) return CONDITIONS.CLOUDY;
  return CONDITIONS.PARTLY_CLOUDY;
}
