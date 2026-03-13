/**
 * Consensus Engine — Majority Voting
 * Determines the agreed-upon forecast from normalized multi-source data
 */

import { CONDITIONS, CONDITION_LABELS, CONDITION_ICONS } from './conditions.js';

/**
 * Main consensus function
 * Takes normalized forecasts from all sources and produces consensus results
 */
export function getConsensus(allForecasts) {
  const activeSources = allForecasts.filter(f => f.status === 'ok');
  const failedSources = allForecasts.filter(f => f.status !== 'ok');

  return {
    current: buildCurrentConsensus(activeSources),
    hourly: buildHourlyConsensus(activeSources),
    daily: buildDailyConsensus(activeSources),
    sources: buildSourceSummary(allForecasts),
  };
}

/**
 * Build consensus for current weather
 */
function buildCurrentConsensus(sources) {
  const currentData = sources
    .map(s => s.data?.current)
    .filter(Boolean);

  if (currentData.length === 0) {
    return { condition: 'CLEAR', confidence: 0, temp: 0, humidity: 0, wind_speed: 0 };
  }

  const conditionVotes = currentData.map(d => d.condition);
  const { winner, count, total } = majorityVote(conditionVotes);

  const agreedSources = currentData.filter(d => d.condition === winner);
  const temps = agreedSources.map(d => d.temp);
  const humidities = agreedSources.map(d => d.humidity);
  const winds = agreedSources.map(d => d.wind_speed);
  const feelsLike = agreedSources.map(d => d.feels_like).filter(v => v != null);
  const precips = currentData.map(d => d.precipitation_prob).filter(v => v != null);

  return {
    condition: winner,
    condition_label: CONDITION_LABELS[winner] || winner,
    condition_icon: CONDITION_ICONS[winner] || '🌡️',
    confidence: count,
    confidence_total: total,
    temp: median(temps),
    feels_like: feelsLike.length > 0 ? median(feelsLike) : null,
    humidity: Math.round(median(humidities)),
    wind_speed: round1(median(winds)),
    precipitation_prob: precips.length > 0 ? Math.round(median(precips)) : null,
    votes: buildVoteDetail(conditionVotes, sources),
  };
}

/**
 * Build consensus for hourly forecast
 */
function buildHourlyConsensus(sources) {
  const allHourly = sources.map(s => s.data?.hourly || []);
  if (allHourly.every(h => h.length === 0)) return [];

  // Find common hours across sources (next 24 hours)
  const hoursSet = new Set();
  allHourly.forEach(hourList => {
    hourList.forEach(h => hoursSet.add(h.time));
  });

  const sortedHours = Array.from(hoursSet).sort().slice(0, 24);

  return sortedHours.map(time => {
    const dataForHour = allHourly
      .map(hourList => hourList.find(h => h.time === time))
      .filter(Boolean);

    if (dataForHour.length === 0) return null;

    const conditionVotes = dataForHour.map(d => d.condition);
    const { winner, count, total } = majorityVote(conditionVotes);

    const agreedData = dataForHour.filter(d => d.condition === winner);

    return {
      time,
      hour: new Date(time).getHours(),
      condition: winner,
      condition_icon: CONDITION_ICONS[winner] || '🌡️',
      condition_label: CONDITION_LABELS[winner] || winner,
      confidence: count,
      confidence_total: total,
      temp: round1(median(agreedData.map(d => d.temp))),
      precipitation_prob: Math.round(median(dataForHour.map(d => d.precipitation_prob).filter(v => v != null) || [0])),
    };
  }).filter(Boolean);
}

/**
 * Build consensus for daily forecast
 */
function buildDailyConsensus(sources) {
  const allDaily = sources.map(s => s.data?.daily || []);
  if (allDaily.every(d => d.length === 0)) return [];

  const datesSet = new Set();
  allDaily.forEach(dayList => {
    dayList.forEach(d => datesSet.add(d.date));
  });

  const sortedDates = Array.from(datesSet).sort().slice(0, 7);

  return sortedDates.map(date => {
    const dataForDay = allDaily
      .map(dayList => dayList.find(d => d.date === date))
      .filter(Boolean);

    if (dataForDay.length === 0) return null;

    const conditionVotes = dataForDay.map(d => d.condition);
    const { winner, count, total } = majorityVote(conditionVotes);

    const agreedData = dataForDay.filter(d => d.condition === winner);
    const allTempsMin = dataForDay.map(d => d.temp_min).filter(v => v != null);
    const allTempsMax = dataForDay.map(d => d.temp_max).filter(v => v != null);
    const allPrecips = dataForDay.map(d => d.precipitation_prob).filter(v => v != null);

    return {
      date,
      day_of_week: getDayOfWeek(date),
      condition: winner,
      condition_icon: CONDITION_ICONS[winner] || '🌡️',
      condition_label: CONDITION_LABELS[winner] || winner,
      confidence: count,
      confidence_total: total,
      temp_min: round1(median(allTempsMin)),
      temp_max: round1(median(allTempsMax)),
      precipitation_prob: allPrecips.length > 0 ? Math.round(median(allPrecips)) : null,
      votes: buildVoteDetail(conditionVotes, sources),
    };
  }).filter(Boolean);
}

/**
 * Majority vote: returns the most common value and its count
 */
function majorityVote(votes) {
  const counts = {};
  votes.forEach(v => {
    counts[v] = (counts[v] || 0) + 1;
  });

  let winner = null;
  let maxCount = 0;
  for (const [value, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }

  return { winner, count: maxCount, total: votes.length };
}

/**
 * Build vote detail for transparency
 */
function buildVoteDetail(conditionVotes, sources) {
  return sources.map((source, i) => ({
    name: source.name,
    condition: conditionVotes[i],
    condition_icon: CONDITION_ICONS[conditionVotes[i]] || '🌡️',
    condition_label: CONDITION_LABELS[conditionVotes[i]] || conditionVotes[i],
    agreed: conditionVotes[i] === majorityVote(conditionVotes).winner,
  }));
}

/**
 * Build source status summary
 */
function buildSourceSummary(allForecasts) {
  return allForecasts.map(f => ({
    name: f.name,
    status: f.status,
    error: f.error || null,
    responseTime: f.responseTime || null,
  }));
}

// Utility functions
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function getDayOfWeek(dateStr) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}
