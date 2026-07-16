import './env.js';
import express from 'express';
import cors from 'cors';
import { fetchAllForecasts } from './services/aggregator.js';
import { getConsensus } from './services/consensus.js';
import { getCached, setCache } from './services/cache.js';
import { fetchNews } from './services/newsService.js';
import { scrapeArticle } from './services/articleScraper.js';
import { fetchStockData } from './services/stockService.js';
import { fetchNearbyRestaurants } from './services/placeService.js';

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
 * GET /api/cast/weather?lat=37.5665&lon=126.9780
 * Main endpoint - returns consensus-based forecast
 */
app.get('/api/cast/weather', async (req, res) => {
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
 * GET /api/cast/weather/sources?lat=37.5665&lon=126.9780
 * Debug endpoint - returns raw data from all 5 sources
 */
app.get('/api/cast/weather/sources', async (req, res) => {
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

/**
 * GET /api/cast/news?q=검색어
 * Returns breaking news from SerpAPI Google News
 * No query = Korean headline news
 */
app.get('/api/cast/news', async (req, res) => {
  try {
    const { q } = req.query;
    console.log(`  📰 뉴스 요청: ${q || '헤드라인'}`);
    const result = await fetchNews(q || null);
    res.json(result);
  } catch (err) {
    console.error('❌ News API Error:', err);
    res.status(500).json({ error: 'Failed to fetch news', details: err.message });
  }
});

/**
 * GET /api/cast/news/article?url=<encoded_url>
 * Scrapes full article text from a news URL
 */
app.get('/api/cast/news/article', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }
    console.log(`  📄 기사 본문 요청: ${url.substring(0, 60)}...`);
    const result = await scrapeArticle(url);
    res.json(result);
  } catch (err) {
    console.error('❌ Article Scrape Error:', err);
    res.status(500).json({ error: 'Failed to scrape article', details: err.message });
  }
});

/**
 * GET /api/cast/stock
 * Returns KOSPI/KOSDAQ real-time data from SerpAPI
 */
app.get('/api/cast/stock', async (req, res) => {
  try {
    console.log('  📈 코스피 데이터 요청');
    const result = await fetchStockData();
    res.json(result);
  } catch (err) {
    console.error('❌ Stock API Error:', err);
    res.status(500).json({ error: 'Failed to fetch stock data', details: err.message });
  }
});

/**
 * GET /api/cast/places?lat=37.5113&lon=127.0980&q=맛집
 * Returns nearby restaurant data from SerpAPI Google Maps
 */
app.get('/api/cast/places', async (req, res) => {
  try {
    const { lat, lon, q } = req.query;
    // lat/lon이 없거나 무효한 경우 null 전달하여 전역 검색 허용 (프롬프트 내 지명 인식용)
    const latitude = (lat && !isNaN(parseFloat(lat))) ? parseFloat(lat) : null;
    const longitude = (lon && !isNaN(parseFloat(lon))) ? parseFloat(lon) : null;
    const query = q || '맛집';
    console.log(`  🍔 맛집 요청: ${query} (lat=${latitude}, lon=${longitude})`);
    const result = await fetchNearbyRestaurants(latitude, longitude, query);
    res.json(result);
  } catch (err) {
    console.error('❌ Places API Error:', err);
    res.status(500).json({ error: 'Failed to fetch places', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌤️  ZeliCast server running on http://localhost:${PORT}`);
});
