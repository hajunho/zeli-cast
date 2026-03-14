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
  // 각 소스별 current 데이터 추적
  const sourceData = sources.map(s => s.data?.current || null);
  const currentData = sourceData.filter(Boolean);

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
    votes: buildVoteDetail(sourceData, sources, winner),
  };
}

/**
 * Build consensus for hourly forecast
 * 각 소스의 시간 포맷이 다를 수 있으므로 KST 시(hour) 기준으로 그룹핑
 */
function buildHourlyConsensus(sources) {
  const allHourly = sources.map(s => s.data?.hourly || []);
  if (allHourly.every(h => h.length === 0)) return [];

  // 모든 시간을 KST hour 키로 정규화 (YYYY-MM-DDTHH)
  function toHourKey(timeStr) {
    const d = new Date(timeStr);
    // KST = UTC+9
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${dd}T${hh}`;
  }

  // Group by hour key
  const hourMap = {};
  allHourly.forEach(hourList => {
    hourList.forEach(h => {
      const key = toHourKey(h.time);
      if (!hourMap[key]) hourMap[key] = [];
      hourMap[key].push(h);
    });
  });

  const sortedKeys = Object.keys(hourMap).sort().slice(0, 24);

  return sortedKeys.map(key => {
    const dataForHour = hourMap[key];
    if (dataForHour.length === 0) return null;

    const conditionVotes = dataForHour.map(d => d.condition);
    const { winner, count, total } = majorityVote(conditionVotes);

    const agreedData = dataForHour.filter(d => d.condition === winner);
    const hour = parseInt(key.split('T')[1]);

    return {
      time: key + ':00',
      hour,
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

  // 오늘 날짜 제외 — 오늘 날씨는 current 섹션에서 이미 표시됨
  // daily의 오늘 데이터는 전일 요약(최저/최고)이라 current 스냅샷과 불일치할 수 있음
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString().split('T')[0]; // KST 기준 오늘 날짜
  const sortedDates = Array.from(datesSet)
    .filter(d => d !== todayStr)
    .sort()
    .slice(0, 7);

  return sortedDates.map(date => {
    // 각 소스별로 해당 날짜 데이터 확인 (데이터 없는 소스도 추적)
    const sourceData = sources.map(s => {
      const daily = s.data?.daily || [];
      return daily.find(d => d.date === date) || null;
    });

    const dataForDay = sourceData.filter(Boolean);
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
      votes: buildVoteDetail(sourceData, sources, winner),
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
 * sourceData: 각 소스별 해당 날짜/시간의 데이터 (없으면 null)
 */
function buildVoteDetail(sourceData, sources, winner) {
  return sources.map((source, i) => {
    const data = sourceData[i];
    if (!data) {
      return {
        name: source.name,
        condition: null,
        condition_icon: '—',
        condition_label: '데이터 없음',
        agreed: false,
        noData: true,
      };
    }
    return {
      name: source.name,
      condition: data.condition,
      condition_icon: CONDITION_ICONS[data.condition] || '🌡️',
      condition_label: CONDITION_LABELS[data.condition] || data.condition,
      agreed: data.condition === winner,
      noData: false,
    };
  });
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
