/**
 * 기상청 (KMA) Adapter — REAL API
 * 단기예보 (D+0~D+2) + 중기예보 (D+3~D+10) 통합
 * https://data.go.kr
 * Free: 10,000 calls/day per service
 */
import { httpsGetJson } from './httpUtil.js';
import { CONDITIONS } from '../conditions.js';

const API_KEY = process.env.KMA_API_KEY;
const BASE_SHORT = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
const BASE_MID   = 'https://apis.data.go.kr/1360000/MidFcstInfoService';

export async function fetchKMA(lat, lon) {
  const start = Date.now();
  if (!API_KEY || API_KEY === 'your_key_here') {
    return { name: '기상청', status: 'skipped', responseTime: 0, error: 'API key not configured', data: null };
  }

  try {
    // 단기 + 중기 병렬 호출
    const [shortTerm, midLand, midTa] = await Promise.all([
      fetchShortTerm(lat, lon),
      fetchMidLand(lat, lon),
      fetchMidTa(lat, lon),
    ]);

    // 단기 데이터 기본
    const data = shortTerm;

    // 중기 데이터 머지 (D+3 이후)
    const midDaily = mergeMidForecast(midLand, midTa);
    if (midDaily.length > 0) {
      const shortDates = new Set(data.daily.map(d => d.date));
      midDaily.forEach(md => {
        if (!shortDates.has(md.date)) {
          data.daily.push(md);
        }
      });
      data.daily.sort((a, b) => a.date.localeCompare(b.date));
      data.daily = data.daily.slice(0, 10); // 최대 10일
    }

    return {
      name: '기상청',
      status: 'ok',
      responseTime: Date.now() - start,
      data,
    };
  } catch (err) {
    console.error(`[KMA] ❌ ${err.message}`);
    return { name: '기상청', status: 'error', responseTime: Date.now() - start, error: err.message, data: null };
  }
}

// ═══════════════════════════════════════
// 단기예보 (VilageFcstInfoService)
// ═══════════════════════════════════════

async function fetchShortTerm(lat, lon) {
  const { nx, ny } = latLonToGrid(lat, lon);
  const { baseDate, baseTime } = getBaseDateTime();

  const params = `serviceKey=${API_KEY}&numOfRows=300&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
  const json = await httpsGetJson(`${BASE_SHORT}/getVilageFcst?${params}`);

  const items = json.response?.body?.items?.item;
  if (!items || items.length === 0) {
    throw new Error('No short-term forecast data');
  }

  return normalizeShortTerm(items);
}

function normalizeShortTerm(items) {
  const slots = {};
  items.forEach(item => {
    const key = `${item.fcstDate}_${item.fcstTime}`;
    if (!slots[key]) slots[key] = {};
    slots[key][item.category] = item.fcstValue;
    slots[key]._date = item.fcstDate;
    slots[key]._time = item.fcstTime;
  });

  const sortedKeys = Object.keys(slots).sort();
  const now = new Date();

  // Current
  const firstSlot = slots[sortedKeys[0]] || {};
  const current = {
    condition: kmaToCondition(firstSlot.SKY, firstSlot.PTY),
    temp: parseFloat(firstSlot.TMP || firstSlot.T1H || 0),
    feels_like: null,
    humidity: parseInt(firstSlot.REH || 0),
    wind_speed: parseFloat(firstSlot.WSD || 0) * 3.6,
    precipitation_prob: parseInt(firstSlot.POP || 0),
  };

  // Hourly
  const hourly = [];
  sortedKeys.forEach(key => {
    const s = slots[key];
    const dt = new Date(`${s._date.slice(0,4)}-${s._date.slice(4,6)}-${s._date.slice(6,8)}T${s._time.slice(0,2)}:${s._time.slice(2,4)}`);
    if (dt >= now && hourly.length < 24) {
      hourly.push({
        time: dt.toISOString(),
        condition: kmaToCondition(s.SKY, s.PTY),
        temp: parseFloat(s.TMP || s.T1H || 0),
        precipitation_prob: parseInt(s.POP || 0),
        wind_speed: parseFloat(s.WSD || 0) * 3.6,
      });
    }
  });

  // Daily
  const dayMap = {};
  sortedKeys.forEach(key => {
    const s = slots[key];
    const date = `${s._date.slice(0,4)}-${s._date.slice(4,6)}-${s._date.slice(6,8)}`;
    if (!dayMap[date]) dayMap[date] = { temps: [], conditions: [], precips: [], winds: [] };
    const temp = parseFloat(s.TMP || s.T1H || 0);
    if (temp !== 0 || s.TMP) dayMap[date].temps.push(temp);
    dayMap[date].conditions.push(kmaToCondition(s.SKY, s.PTY));
    dayMap[date].precips.push(parseInt(s.POP || 0));
    dayMap[date].winds.push(parseFloat(s.WSD || 0) * 3.6);
  });

  const daily = Object.entries(dayMap).map(([date, data]) => ({
    date,
    condition: modeOfArray(data.conditions),
    temp_min: data.temps.length > 0 ? Math.min(...data.temps) : 0,
    temp_max: data.temps.length > 0 ? Math.max(...data.temps) : 0,
    precipitation_prob: Math.max(...data.precips),
    wind_speed: Math.max(...data.winds),
  }));

  return { current, hourly, daily };
}

// ═══════════════════════════════════════
// 중기예보 (MidFcstInfoService)
// ═══════════════════════════════════════

async function fetchMidLand(lat, lon) {
  try {
    const regId = latLonToLandRegId(lat, lon);
    const tmFc = getMidBaseTmFc();
    const params = `serviceKey=${API_KEY}&numOfRows=10&pageNo=1&dataType=JSON&regId=${regId}&tmFc=${tmFc}`;
    const json = await httpsGetJson(`${BASE_MID}/getMidLandFcst?${params}`);
    return json.response?.body?.items?.item?.[0] || null;
  } catch (err) {
    console.error(`[KMA 중기육상] ⚠️ ${err.message}`);
    return null;
  }
}

async function fetchMidTa(lat, lon) {
  try {
    const regId = latLonToTaRegId(lat, lon);
    const tmFc = getMidBaseTmFc();
    const params = `serviceKey=${API_KEY}&numOfRows=10&pageNo=1&dataType=JSON&regId=${regId}&tmFc=${tmFc}`;
    const json = await httpsGetJson(`${BASE_MID}/getMidTa?${params}`);
    return json.response?.body?.items?.item?.[0] || null;
  } catch (err) {
    console.error(`[KMA 중기기온] ⚠️ ${err.message}`);
    return null;
  }
}

/**
 * 중기 육상예보 + 기온 → daily 배열로 변환
 * 필드: wf3Am/Pm ~ wf10, rnSt3Am/Pm ~ rnSt10, taMin3 ~ taMin10, taMax3 ~ taMax10
 */
function mergeMidForecast(land, ta) {
  if (!land && !ta) return [];

  const today = new Date();
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const daily = [];

  for (let d = 3; d <= 10; d++) {
    const futureDate = new Date(kst.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];

    // 하늘상태 (D+3~D+7: Am/Pm, D+8~D+10: 하루)
    let weatherText = '';
    if (land) {
      if (d <= 7) {
        weatherText = land[`wf${d}Am`] || land[`wf${d}Pm`] || '';
      } else {
        weatherText = land[`wf${d}`] || '';
      }
    }

    // 강수확률
    let precipProb = 0;
    if (land) {
      if (d <= 7) {
        const am = parseInt(land[`rnSt${d}Am`] || 0);
        const pm = parseInt(land[`rnSt${d}Pm`] || 0);
        precipProb = Math.max(am, pm);
      } else {
        precipProb = parseInt(land[`rnSt${d}`] || 0);
      }
    }

    // 기온
    let tempMin = null, tempMax = null;
    if (ta) {
      tempMin = ta[`taMin${d}`] != null ? parseFloat(ta[`taMin${d}`]) : null;
      tempMax = ta[`taMax${d}`] != null ? parseFloat(ta[`taMax${d}`]) : null;
    }

    // 하늘상태가 없으면 skip
    if (!weatherText && tempMin == null && tempMax == null) continue;

    daily.push({
      date: dateStr,
      condition: midWeatherToCondition(weatherText),
      temp_min: tempMin ?? 0,
      temp_max: tempMax ?? 0,
      precipitation_prob: precipProb,
      wind_speed: 0, // 중기예보에는 풍속 없음
    });
  }

  return daily;
}

/**
 * 중기예보 하늘상태 텍스트 → 8종 condition
 * "맑음", "구름많음", "구름많고 비", "흐림", "흐리고 비", "흐리고 눈" 등
 */
function midWeatherToCondition(text) {
  if (!text) return CONDITIONS.CLOUDY;
  const t = text.trim();

  if (t.includes('비/눈') || t.includes('눈/비')) return CONDITIONS.SLEET;
  if (t.includes('눈')) return CONDITIONS.SNOW;
  if (t.includes('소나기') && t.includes('흐')) return CONDITIONS.HEAVY_RAIN;
  if (t.includes('비')) return CONDITIONS.RAIN;

  if (t === '맑음') return CONDITIONS.CLEAR;
  if (t.includes('구름많') && !t.includes('비') && !t.includes('눈')) return CONDITIONS.PARTLY_CLOUDY;
  if (t.includes('흐림') || t.includes('흐리')) return CONDITIONS.CLOUDY;

  return CONDITIONS.PARTLY_CLOUDY;
}

/**
 * 중기예보 발표 시각(tmFc) 결정
 * 발표: 06시, 18시 (1일 2회)
 * API 제공: 06:00 이후, 18:00 이후
 */
function getMidBaseTmFc() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();

  let baseHour = 6;
  let baseDate = kst;

  if (hours >= 18) {
    baseHour = 18;
  } else if (hours >= 6) {
    baseHour = 6;
  } else {
    // 06시 전이면 전날 18시
    baseHour = 18;
    baseDate = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
  }

  const y = baseDate.getUTCFullYear();
  const m = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getUTCDate()).padStart(2, '0');

  return `${y}${m}${d}${String(baseHour).padStart(2, '0')}00`;
}

/**
 * 위경도 → 중기육상예보 예보구역코드 (regId)
 * 서울/인천/경기: 11B00000, 강원: 11D00000 등
 */
function latLonToLandRegId(lat, lon) {
  // 주요 도시/지역 기준 매핑
  if (lat >= 37.0 && lat < 38.5 && lon >= 126.0 && lon < 127.5) return '11B00000'; // 서울/인천/경기
  if (lat >= 37.0 && lat < 38.5 && lon >= 127.5) return '11D10000'; // 강원 영서
  if (lat >= 37.0 && lat < 38.5 && lon >= 128.5) return '11D20000'; // 강원 영동
  if (lat >= 36.0 && lat < 37.0 && lon < 127.0) return '11C20000'; // 충남
  if (lat >= 36.0 && lat < 37.0 && lon >= 127.0) return '11C10000'; // 충북
  if (lat >= 35.0 && lat < 36.0 && lon < 127.0) return '11F20000'; // 전남
  if (lat >= 35.0 && lat < 36.0 && lon >= 127.0 && lon < 129.0) return '11H10000'; // 경남 (대구/경북 포함)
  if (lat >= 35.0 && lat < 36.0 && lon >= 129.0) return '11H20000'; // 경남
  if (lat >= 36.0 && lat < 37.0 && lon >= 128.0) return '11H10000'; // 대구/경북
  if (lat >= 35.5 && lat < 36.0 && lon < 127.0) return '11F10000'; // 전북
  if (lat < 34.0) return '11G00000'; // 제주
  return '11B00000'; // 기본: 서울
}

/**
 * 위경도 → 중기기온 예보구역코드 (regId)
 * 서울: 11B10101, 인천: 11B20201, 수원: 11B20601 등
 */
function latLonToTaRegId(lat, lon) {
  // 주요 도시 중심 기반 (가장 가까운 관측소)
  if (lat >= 37.4 && lat < 37.7 && lon >= 126.8 && lon < 127.2) return '11B10101'; // 서울
  if (lat >= 37.3 && lat < 37.5 && lon >= 126.5 && lon < 126.8) return '11B20201'; // 인천
  if (lat >= 37.1 && lat < 37.4 && lon >= 126.8 && lon < 127.2) return '11B20601'; // 수원
  if (lat >= 37.7 && lat < 38.0 && lon >= 126.5 && lon < 127.5) return '11B20305'; // 의정부/파주
  if (lat >= 37.0 && lat < 37.5 && lon >= 127.5 && lon < 129.0) return '11D10301'; // 춘천
  if (lat >= 37.0 && lat < 38.0 && lon >= 129.0) return '11D20501'; // 강릉
  if (lat >= 36.0 && lat < 37.0 && lon < 127.0) return '11C20401'; // 대전
  if (lat >= 36.0 && lat < 37.0 && lon >= 127.0 && lon < 128.0) return '11C10301'; // 청주
  if (lat >= 35.5 && lat < 36.0 && lon < 127.0) return '11F10201'; // 전주
  if (lat >= 34.5 && lat < 35.5 && lon < 127.0) return '11F20501'; // 광주
  if (lat >= 35.5 && lat < 36.5 && lon >= 128.0) return '11H10701'; // 대구
  if (lat >= 35.0 && lat < 35.5 && lon >= 128.5) return '11H20201'; // 부산
  if (lat >= 35.0 && lat < 35.5 && lon >= 128.0 && lon < 128.5) return '11H20301'; // 울산(창원)
  if (lat < 34.0) return '11G00201'; // 제주
  return '11B10101'; // 기본: 서울
}

// ═══════════════════════════════════════
// 공통 유틸리티
// ═══════════════════════════════════════

function kmaToCondition(sky, pty) {
  const p = parseInt(pty || 0);
  const s = parseInt(sky || 1);
  if (p === 1 || p === 4 || p === 5) return CONDITIONS.RAIN;
  if (p === 2 || p === 6) return CONDITIONS.SLEET;
  if (p === 3 || p === 7) return CONDITIONS.SNOW;
  if (s === 1) return CONDITIONS.CLEAR;
  if (s === 3) return CONDITIONS.PARTLY_CLOUDY;
  if (s === 4) return CONDITIONS.CLOUDY;
  return CONDITIONS.PARTLY_CLOUDY;
}

function latLonToGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0;
  const SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0;
  const XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

function getBaseDateTime() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const baseTimes = [23, 20, 17, 14, 11, 8, 5, 2];
  let baseHour = 2;
  for (const bt of baseTimes) {
    const availableMinute = bt * 60 + 10;
    const currentMinute = hours * 60 + kst.getUTCMinutes();
    if (currentMinute >= availableMinute) { baseHour = bt; break; }
  }
  let baseDate = kst;
  if (baseHour === 23 && hours < 23) {
    baseDate = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
  }
  const y = baseDate.getUTCFullYear();
  const m = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getUTCDate()).padStart(2, '0');
  return { baseDate: `${y}${m}${d}`, baseTime: String(baseHour).padStart(2, '0') + '00' };
}

function modeOfArray(arr) {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CLOUDY';
}
