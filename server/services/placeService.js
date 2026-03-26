/**
 * SerpAPI Local Places Service — 근처 맛집 추천
 * Google Maps Local Results API를 통해 위치 기반 맛집 정보 수집
 * 30분 캐시로 API 호출 최소화
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json';
const PLACE_CACHE_TTL = 30 * 60 * 1000; // 30분

let placeCache = { data: null, timestamp: 0, key: null };

/**
 * SerpAPI Google Maps에서 근처 맛집 데이터 가져오기
 * @param {number} lat - 위도
 * @param {number} lon - 경도
 * @param {string} query - 검색어 (기본: '맛집')
 * @returns {Promise<{places: Array, cached: boolean, timestamp: string}>}
 */
export async function fetchNearbyRestaurants(lat = null, lon = null, query = '맛집') {
  const cacheKey = `places_${lat ? lat.toFixed(2) : 'any'}_${lon ? lon.toFixed(2) : 'any'}_${query}`;
  const now = Date.now();

  // 캐시 확인
  if (placeCache.data && placeCache.key === cacheKey && (now - placeCache.timestamp) < PLACE_CACHE_TTL) {
    console.log('  🍔 맛집 캐시 히트');
    return { ...placeCache.data, cached: true };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('  ⚠️ SERPAPI_KEY 미설정 — 맛집 비활성');
    return { places: [], cached: false, timestamp: new Date().toISOString(), error: 'SERPAPI_KEY not configured' };
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_maps',
      q: `${query}`,
      hl: 'ko',
      type: 'search',
    });

    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
        params.append('ll', `@${lat},${lon},15z`);
    } else {
        console.log(`  🍔 [placeService] No valid GPS coordinates, searching by query: ${query}`);
    }

    console.log(`  🍔 SerpAPI 맛집 요청: ${query} (${lat}, ${lon})`);
    const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SerpAPI ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const localResults = data.local_results || [];

    const places = localResults.slice(0, 5).map(place => ({
      title: place.title || '',
      address: place.address || '',
      rating: place.rating || null,
      reviews: place.reviews || 0,
      type: place.type || '',
      thumbnail: place.thumbnail || null,
      gps_coordinates: place.gps_coordinates || null,
      price: place.price || '',
      hours: place.hours || '',
      phone: place.phone || '',
      website: place.website || '',
      place_id: place.place_id || '',
    }));

    const result = {
      places,
      query,
      location: { lat, lon },
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // 캐시 저장
    placeCache = { data: result, key: cacheKey, timestamp: now };
    console.log(`  🍔 맛집 ${places.length}곳 수집 완료`);

    return result;
  } catch (err) {
    console.error('  ❌ SerpAPI 맛집 오류:', err.message);
    if (placeCache.data && placeCache.key === cacheKey) {
      return { ...placeCache.data, cached: true, stale: true };
    }
    return { places: [], cached: false, timestamp: new Date().toISOString(), error: err.message };
  }
}
