/**
 * SerpAPI News Service — 한국 뉴스 속보 수집
 * Google News API를 통해 최신 헤드라인 뉴스를 가져옴
 * 15분 캐시로 API 호출 최소화
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json';
const NEWS_CACHE_TTL = 15 * 60 * 1000; // 15분

let newsCache = { data: null, timestamp: 0 };

/**
 * SerpAPI Google News에서 한국 뉴스 헤드라인 가져오기
 * @param {string|null} query — 검색어 (null이면 헤드라인 뉴스)
 * @returns {Promise<{articles: Array, cached: boolean, timestamp: string}>}
 */
export async function fetchNews(query = null) {
  const cacheKey = query || '__headlines__';
  const now = Date.now();

  // 캐시 확인
  if (newsCache.data && newsCache.key === cacheKey && (now - newsCache.timestamp) < NEWS_CACHE_TTL) {
    console.log('  📰 뉴스 캐시 히트');
    return { articles: newsCache.data, cached: true, timestamp: new Date(newsCache.timestamp).toISOString() };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('  ⚠️ SERPAPI_KEY 미설정 — 뉴스 비활성');
    return { articles: [], cached: false, timestamp: new Date().toISOString(), error: 'SERPAPI_KEY not configured' };
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_news',
      gl: 'kr',
      hl: 'ko',
    });

    if (query) {
      params.set('q', query);
    }

    console.log(`  📰 SerpAPI 뉴스 요청: ${query || '헤드라인'}`);
    const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SerpAPI ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // news_results에서 기사 추출
    // Google News 헤드라인은 stories[] 묶음으로 올 수 있음 → 개별 기사로 풀어냄
    const rawArticles = data.news_results || [];
    const flattened = [];

    for (const item of rawArticles) {
      if (item.link && item.title) {
        // 직접 링크가 있는 일반 기사
        flattened.push({
          title: item.title,
          link: item.link,
          source: item.source?.name || item.source || '',
          date: item.date || '',
          snippet: item.snippet || '',
          thumbnail: item.thumbnail || null,
        });
      }
      // stories 묶음 안의 개별 기사들도 추출
      if (item.stories && Array.isArray(item.stories)) {
        for (const sub of item.stories) {
          if (sub.title && sub.link) {
            flattened.push({
              title: sub.title,
              link: sub.link,
              source: sub.source?.name || sub.source || '',
              date: sub.date || item.date || '',
              snippet: sub.snippet || '',
              thumbnail: sub.thumbnail || item.thumbnail || null,
            });
          }
        }
      }
    }

    const articles = flattened.slice(0, 15);

    // 캐시 저장
    newsCache = { data: articles, key: cacheKey, timestamp: now };
    console.log(`  📰 뉴스 ${articles.length}건 수집 완료`);

    return { articles, cached: false, timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('  ❌ SerpAPI 뉴스 오류:', err.message);
    // 이전 캐시가 있으면 stale 데이터라도 반환
    if (newsCache.data && newsCache.key === cacheKey) {
      return { articles: newsCache.data, cached: true, stale: true, timestamp: new Date(newsCache.timestamp).toISOString() };
    }
    return { articles: [], cached: false, timestamp: new Date().toISOString(), error: err.message };
  }
}
