/**
 * 기상청 (KMA) Adapter — REAL API
 * https://data.go.kr — 단기예보 조회서비스
 * Free: 10,000 calls/day
 */
import { httpsGetJson } from './httpUtil.js';
import { CONDITIONS } from '../conditions.js';

const API_KEY = process.env.KMA_API_KEY;
const BASE = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

export async function fetchKMA(lat, lon) {
  const start = Date.now();
  if (!API_KEY || API_KEY === 'your_key_here') {
    return { name: '기상청', status: 'skipped', responseTime: 0, error: 'API key not configured', data: null };
  }

  try {
    // 위경도 → 기상청 격자 좌표 변환
    const { nx, ny } = latLonToGrid(lat, lon);
    const { baseDate, baseTime } = getBaseDateTime();

    // 기상청은 Decoding 키를 그대로 URL에 삽입 (encodeURIComponent 사용하면 401)
    const params = `serviceKey=${API_KEY}&numOfRows=300&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

    const json = await httpsGetJson(`${BASE}/getVilageFcst?${params}`);

    const items = json.response?.body?.items?.item;
    if (!items || items.length === 0) {
      throw new Error('No forecast data returned');
    }

    return {
      name: '기상청',
      status: 'ok',
      responseTime: Date.now() - start,
      data: normalize(items),
    };
  } catch (err) {
    console.error(`[KMA] ❌ ${err.message}`);
    return { name: '기상청', status: 'error', responseTime: Date.now() - start, error: err.message, data: null };
  }
}

function normalize(items) {
  // Group by fcstDate + fcstTime
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

  // Current: first slot
  const firstSlot = slots[sortedKeys[0]] || {};
  const current = {
    condition: kmaToCondition(firstSlot.SKY, firstSlot.PTY),
    temp: parseFloat(firstSlot.TMP || firstSlot.T1H || 0),
    feels_like: null,
    humidity: parseInt(firstSlot.REH || 0),
    wind_speed: parseFloat(firstSlot.WSD || 0) * 3.6, // m/s → km/h
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

  // Daily: aggregate by date
  const dayMap = {};
  sortedKeys.forEach(key => {
    const s = slots[key];
    const date = `${s._date.slice(0,4)}-${s._date.slice(4,6)}-${s._date.slice(6,8)}`;
    if (!dayMap[date]) {
      dayMap[date] = { temps: [], conditions: [], precips: [], winds: [] };
    }
    const temp = parseFloat(s.TMP || s.T1H || 0);
    if (temp !== 0 || s.TMP) dayMap[date].temps.push(temp);
    dayMap[date].conditions.push(kmaToCondition(s.SKY, s.PTY));
    dayMap[date].precips.push(parseInt(s.POP || 0));
    dayMap[date].winds.push(parseFloat(s.WSD || 0) * 3.6);
  });

  const daily = Object.entries(dayMap).slice(0, 7).map(([date, data]) => ({
    date,
    condition: modeOfArray(data.conditions),
    temp_min: data.temps.length > 0 ? Math.min(...data.temps) : 0,
    temp_max: data.temps.length > 0 ? Math.max(...data.temps) : 0,
    precipitation_prob: Math.max(...data.precips),
    wind_speed: Math.max(...data.winds),
  }));

  return { current, hourly, daily };
}

/**
 * 기상청 하늘상태(SKY) + 강수형태(PTY) → 8종 condition
 * SKY: 1=맑음, 3=구름많음, 4=흐림
 * PTY: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기, 5=빗방울, 6=빗방울눈날림, 7=눈날림
 */
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

/**
 * 위경도 → 기상청 격자 좌표 변환 (Lambert Conformal Conic)
 */
function latLonToGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0;
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

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

/**
 * 기상청 API base_date, base_time 결정
 * 단기예보 발표시각: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
 */
function getBaseDateTime() {
  const now = new Date();
  // KST
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const baseTimes = [23, 20, 17, 14, 11, 8, 5, 2];
  let baseHour = 2;

  for (const bt of baseTimes) {
    // API 제공 시간: base_time + 10분 (가이드 기준: 02:10, 05:10 ...)
    const availableMinute = bt * 60 + 10;
    const currentMinute = hours * 60 + kst.getUTCMinutes();
    if (currentMinute >= availableMinute) {
      baseHour = bt;
      break;
    }
  }

  let baseDate = kst;
  if (baseHour === 23 && hours < 23) {
    baseDate = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
  }

  const y = baseDate.getUTCFullYear();
  const m = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getUTCDate()).padStart(2, '0');

  return {
    baseDate: `${y}${m}${d}`,
    baseTime: String(baseHour).padStart(2, '0') + '00',
  };
}

function modeOfArray(arr) {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CLOUDY';
}
