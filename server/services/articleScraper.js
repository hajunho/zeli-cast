/**
 * Article Scraper Service — 뉴스 기사 본문 스크래핑
 * URL에서 HTML을 가져와 기사 본문 텍스트를 추출
 * 10분 캐시로 반복 요청 최소화
 */

const ARTICLE_CACHE_TTL = 10 * 60 * 1000; // 10분
const articleCache = new Map();

/**
 * HTML에서 불필요한 요소를 제거하고 본문 텍스트를 추출
 */
function extractArticleText(html) {
  // 1. script, style, nav, footer, header, aside 제거
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 2. article 또는 메인 콘텐츠 영역 추출 시도
  let articleContent = null;
  
  // article 태그 찾기
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    articleContent = articleMatch[1];
  }
  
  // article이 없으면 main 콘텐츠 클래스 찾기
  if (!articleContent) {
    const contentPatterns = [
      /<div[^>]*id="[^"]*(?:dic_area|articleBody|article_body|articeBody|news_body|newsEndContents)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*(?:article_view|article_body|news_bm|news_cnt|article[_-]?(?:body|content|text)|news[_-]?(?:body|content|text)|story[_-]?(?:body|content|text)|post[_-]?(?:body|content|text)|entry[_-]?(?:body|content|text)|content[_-]?(?:body|article|text))[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*(?:article[_-]?(?:body|content|text)|news[_-]?(?:body|content|text)|story[_-]?(?:body|content|text)|content[_-]?(?:body|article))[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*(?:article|content|story|post)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    ];
    
    for (const pattern of contentPatterns) {
      const match = cleaned.match(pattern);
      if (match && match[1] && match[1].length > 200) {
        articleContent = match[1];
        break;
      }
    }
  }

  const textSource = articleContent || cleaned;

  // 3. 이미지 URL 추출 (본문에서)
  const images = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(textSource)) !== null) {
    const src = imgMatch[1];
    if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('ads') &&
        !src.includes('pixel') && !src.includes('tracking') && !src.includes('banner') &&
        !src.includes('1x1') && !src.endsWith('.gif') && src.length > 10) {
      images.push(src);
    }
  }

  // 4. HTML을 단락으로 변환
  let text = textSource
    // <br> → 줄바꿈
    .replace(/<br\s*\/?>/gi, '\n')
    // <p>, <div>, <h1~6> → 단락 구분
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // 나머지 HTML 태그 제거
    .replace(/<[^>]+>/g, '')
    // HTML 엔티티 디코딩
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // 공백 정리
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // 5. 유의미한 단락만 필터링 (너무 짧은 줄 제거)
  const paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 10) // 최소 10자 이상 (가 • 가... 도 포함되도록)
    .filter(p => {
      const lower = p.toLowerCase();
      // 💡 UI 요소: 가 • 가 • 가 (폰트 조절 버튼) 정규식으로 제거
      if (/가\s*[·•\.\s]+\s*가\s*[·•\.\s]+\s*가/g.test(p)) return false;
      // 광고/저작권/UI 요소/기사 하단 쓰레기 텍스트 필터링
      return !lower.includes('copyright') &&
             !lower.includes('all rights reserved') &&
             !lower.includes('무단전재') &&
             !lower.includes('재배포 금지') &&
             !lower.includes('구독하기') &&
             !lower.includes('로그인') &&
             !lower.includes('댓글') &&
             !lower.includes('좋아요') &&
             !lower.includes('공유하기') &&
             !lower.includes('기자 이메일') &&
             !lower.includes('카카오톡') &&
             !lower.includes('페이스북') &&
             !lower.includes('음성재생') &&
             !lower.includes('데이터 요금') &&
             !lower.includes('번역beta') &&
             !lower.includes('translated by') &&
             !lower.includes('now in translation') &&
             !lower.includes('기사 읽어주기 서비스') &&
             !lower.includes('video 태그를 지원하지 않습니다') &&
             !lower.includes('오디오 태그를 지원하지 않습니다') &&
             !lower.includes('자동요약') &&
             !lower.startsWith('ad') &&
             !lower.startsWith('관련기사') &&
             !lower.startsWith('인기기사');
    });

  return {
    content: paragraphs.join('\n\n'),
    paragraphs,
    images: images.slice(0, 5), // 최대 5개 이미지
    wordCount: paragraphs.join(' ').split(/\s+/).length,
  };
}

/**
 * 뉴스 기사 URL에서 본문 텍스트를 스크래핑
 * @param {string} url — 기사 URL
 * @returns {Promise<{content, paragraphs, images, wordCount, cached}>}
 */
export async function scrapeArticle(url) {
  if (!url) {
    return { content: '', paragraphs: [], images: [], wordCount: 0, error: 'URL is required' };
  }

  // 캐시 확인
  const cached = articleCache.get(url);
  if (cached && (Date.now() - cached.timestamp) < ARTICLE_CACHE_TTL) {
    console.log('  📄 기사 캐시 히트');
    return { ...cached.data, cached: true };
  }

  try {
    console.log(`  📄 기사 스크래핑: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000), // 15초 타임아웃
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const result = extractArticleText(html);

    if (result.content.length < 50) {
      return {
        ...result,
        cached: false,
        partial: true,
        message: '기사 본문을 완전하게 추출하지 못했습니다. 원문을 확인해주세요.',
      };
    }

    // 캐시 저장
    articleCache.set(url, { data: result, timestamp: Date.now() });
    console.log(`  📄 기사 스크래핑 완료: ${result.paragraphs.length}단락, ${result.wordCount}단어`);

    return { ...result, cached: false };
  } catch (err) {
    console.error('  ❌ 기사 스크래핑 오류:', err.message);
    return {
      content: '',
      paragraphs: [],
      images: [],
      wordCount: 0,
      cached: false,
      error: err.message,
    };
  }
}
