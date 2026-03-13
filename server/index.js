import express from 'express';
import cors from 'cors';
import { fetchAllForecasts } from './services/aggregator.js';
import { getConsensus } from './services/consensus.js';
import { getCached, setCache } from './services/cache.js';

const app = express();
const PORT = 5171;

app.use(cors());
app.use(express.json());

// 📋 요청 로그
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`→ ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`← ${res.statusCode} ${req.url} (${Date.now() - start}ms)`);
  });
  next();
});

/**
 * GET /api/weather?lat=37.5665&lon=126.9780
 * Main endpoint - returns consensus-based forecast
 */
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const cacheKey = `weather_${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`  📦 캐시 히트: ${cacheKey}`);
      return res.json({ ...cached, cached: true });
    }

    console.log(`  🌍 날씨 수집 시작: lat=${lat}, lon=${lon}`);
    const forecasts = await fetchAllForecasts(parseFloat(lat), parseFloat(lon));

    // 소스별 상태 로그
    forecasts.forEach(f => {
      const icon = f.status === 'ok' ? '✅' : '❌';
      console.log(`  ${icon} ${f.name}: ${f.status} (${f.responseTime}ms)${f.error ? ' — ' + f.error : ''}`);
    });

    const consensus = getConsensus(forecasts);

    const result = {
      location: { lat: parseFloat(lat), lon: parseFloat(lon) },
      timestamp: new Date().toISOString(),
      current: consensus.current,
      hourly: consensus.hourly,
      daily: consensus.daily,
      sources: consensus.sources,
      cached: false,
    };

    setCache(cacheKey, result);
    console.log(`  🌡️ 결과: ${consensus.current?.temp}° ${consensus.current?.condition} (신뢰도 ${consensus.current?.confidence}/5)`);
    res.json(result);
  } catch (err) {
    console.error('❌ Weather API Error:', err);
    res.status(500).json({ error: 'Failed to fetch weather data', details: err.message });
  }
});

/**
 * GET /api/weather/sources?lat=37.5665&lon=126.9780
 * Debug endpoint - returns raw data from all 5 sources
 */
app.get('/api/weather/sources', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const forecasts = await fetchAllForecasts(parseFloat(lat), parseFloat(lon));
    res.json(forecasts);
  } catch (err) {
    console.error('Sources API Error:', err);
    res.status(500).json({ error: 'Failed to fetch sources', details: err.message });
  }
});

// IPv6 환경에서 ::1 vs 127.0.0.1 충돌 방지를 위해 0.0.0.0으로 바인딩
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌤️  ZeliCast server running on http://localhost:${PORT}`);
});

