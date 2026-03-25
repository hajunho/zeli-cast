/**
 * SerpAPI Stock Service — 코스피/코스닥 + 환율 실시간 데이터
 * Google Finance API를 통해 한국 주식 시장 데이터 수집
 * 5분 캐시로 API 호출 최소화
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json';
const STOCK_CACHE_TTL = 5 * 60 * 1000; // 5분

let stockCache = { data: null, timestamp: 0, key: null };

/**
 * SerpAPI Google Finance에서 코스피 + 환율 데이터 가져오기
 */
export async function fetchStockData() {
  const cacheKey = 'kospi_exchange';
  const now = Date.now();

  // 캐시 확인
  if (stockCache.data && stockCache.key === cacheKey && (now - stockCache.timestamp) < STOCK_CACHE_TTL) {
    console.log('  📈 주식 캐시 히트');
    return { ...stockCache.data, cached: true };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('  ⚠️ SERPAPI_KEY 미설정 — 주식 비활성');
    return { lines: [], cached: false, error: 'SERPAPI_KEY not configured' };
  }

  try {
    // 코스피 + 환율 동시 검색
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_finance',
      q: 'KRX:KOSPI',
      hl: 'ko',
    });

    console.log('  📈 SerpAPI Google Finance 코스피 요청...');
    const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

    if (!res.ok) {
      // Google Finance 엔진 실패 시 일반 검색으로 fallback
      console.log('  📈 Google Finance 실패, 일반 검색으로 fallback...');
      return await fetchStockFallback(apiKey, now, cacheKey);
    }

    const data = await res.json();
    
    const lines = [];

    // summary에서 코스피 데이터 추출
    if (data.summary) {
      const price = data.summary.price || '';
      const change = data.summary.price_change || '';
      const changePct = data.summary.price_change_percentage || '';
      const currency = data.summary.currency || '';
      
      if (price) {
        const arrow = parseFloat(String(change).replace(/[^0-9.-]/g, '')) >= 0 ? '▲' : '▼';
        const absChange = String(change).replace('-', '');
        const absPct = String(changePct).replace('-', '');
        lines.push(`코스피 ${price} (${arrow}${absChange}p, ${absPct})`);
      }
    }

    // market_trends에서 추가 데이터 (코스닥, 환율)
    if (data.market_trends) {
      for (const trend of data.market_trends) {
        if (trend.results) {
          for (const item of trend.results) {
            const name = item.stock || item.name || '';
            const lowerName = name.toLowerCase();
            if (lowerName.includes('usd') && lowerName.includes('krw') || name.includes('달러')) {
              const price = item.price || '';
              const change = item.price_change || item.extracted_price || '';
              if (price) {
                const numChange = parseFloat(String(change).replace(/[^0-9.-]/g, '')) || 0;
                const arrow = numChange >= 0 ? '▲' : '▼';
                const absChange = Math.abs(numChange);
                lines.push(`원·달러 환율 ${price}(${arrow}${absChange}원) 마감`);
              }
            }
          }
        }
      }
    }

    // 데이터가 부족하면 fallback
    if (lines.length === 0) {
      return await fetchStockFallback(apiKey, now, cacheKey);
    }

    const result = {
      lines,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    stockCache = { data: result, key: cacheKey, timestamp: now };
    console.log(`  📈 코스피 데이터 수집 완료: ${lines.length}줄`);
    return result;

  } catch (err) {
    console.error('  ❌ SerpAPI 주식 오류:', err.message);
    return await fetchStockFallback(apiKey, now, cacheKey);
  }
}

/**
 * Fallback: 일반 Google 검색으로 코스피 + 환율 데이터 수집
 */
async function fetchStockFallback(apiKey, now, cacheKey) {
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google',
      q: '코스피 지수 오늘 환율',
      gl: 'kr',
      hl: 'ko',
    });

    console.log('  📈 Fallback: 일반 검색으로 코스피 요청...');
    const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}`);

    const data = await res.json();
    const lines = [];

    // answer_box에서 데이터 추출
    if (data.answer_box) {
      const ab = data.answer_box;
      if (ab.answer || ab.result) {
        lines.push(`코스피 ${ab.answer || ab.result}`);
      }
    }

    // knowledge_graph에서 데이터 추출
    if (data.knowledge_graph) {
      const kg = data.knowledge_graph;
      if (kg.stock_price) {
        const change = kg.stock_change || '';
        const pct = kg.stock_change_percentage || '';
        if (change) {
          const arrow = change.startsWith('-') ? '▼' : '▲';
          const absChange = change.replace('-', '');
          lines.push(`코스피 ${kg.stock_price} (${arrow}${absChange}p, ${pct})`);
        } else {
          lines.push(`코스피 ${kg.stock_price}`);
        }
      }
    }

    // organic_results에서 스니펫 파싱
    if (lines.length === 0 && data.organic_results) {
      for (const result of data.organic_results.slice(0, 5)) {
        const snippet = result.snippet || '';
        // 코스피 숫자 패턴 찾기
        const kospiMatch = snippet.match(/코스피[^\d]*([\d,]+\.?\d*)/);
        if (kospiMatch) {
          lines.push(`코스피 ${kospiMatch[1]}`);
          break;
        }
      }
    }

    // 환율 정보 추가 시도
    if (data.organic_results) {
      for (const result of data.organic_results.slice(0, 5)) {
        const snippet = result.snippet || '';
        const fxMatch = snippet.match(/환율[^\d]*([\d,]+\.?\d*)/);
        if (fxMatch) {
          lines.push(`원·달러 환율 ${fxMatch[1]}`);
          break;
        }
      }
    }

    if (lines.length === 0) {
      lines.push('시장 데이터를 가져오는 중...');
    }

    const resultData = {
      lines,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    stockCache = { data: resultData, key: cacheKey, timestamp: now };
    console.log(`  📈 Fallback 코스피 수집 완료: ${lines.length}줄`);
    return resultData;

  } catch (err) {
    console.error('  ❌ Fallback 주식 오류:', err.message);
    if (stockCache.data) {
      return { ...stockCache.data, cached: true, stale: true };
    }
    return { lines: ['시장 데이터를 가져올 수 없습니다'], cached: false, error: err.message };
  }
}
