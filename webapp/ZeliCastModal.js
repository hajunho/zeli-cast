/**
 * ZeliCastModal — 합의 기반 날씨 예보 모달
 * 5개 기상 API 합의 결과를 zeliai 스타일로 표시
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ZeliCast.css';

const API_BASE = '/api/cast';
const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.9780, name: '서울특별시', detail: '중구' };
const SOURCES = ['Open-Meteo', 'OpenWeatherMap', 'WeatherAPI', '기상청', 'Tomorrow.io'];
const GEO_TIMEOUT = 8000; // 모바일에서 GPS 잡는데 넉넉하게

// 날씨 condition → FontAwesome 아이콘 (이모지 대신 — 서버 UTF-8 인코딩 문제 해결)
const CONDITION_FA = {
  CLEAR:         { icon: 'fas fa-sun',             color: '#fbbf24' },
  PARTLY_CLOUDY: { icon: 'fas fa-cloud-sun',       color: '#94a3b8' },
  CLOUDY:        { icon: 'fas fa-cloud',           color: '#9ca3af' },
  RAIN:          { icon: 'fas fa-cloud-rain',      color: '#60a5fa' },
  HEAVY_RAIN:    { icon: 'fas fa-cloud-showers-heavy', color: '#3b82f6' },
  SNOW:          { icon: 'fas fa-snowflake',       color: '#e2e8f0' },
  SLEET:         { icon: 'fas fa-cloud-meatball',  color: '#93c5fd' },
  FOG:           { icon: 'fas fa-smog',            color: '#6b7280' },
};

function ConditionIcon({ condition, size = '1em' }) {
  const fa = CONDITION_FA[condition] || CONDITION_FA.CLOUDY;
  return <i className={fa.icon} style={{ fontSize: size, color: fa.color }} />;
}

function getConfidenceLevel(confidence) {
  if (confidence >= 5) return '5';
  if (confidence >= 4) return '4';
  if (confidence >= 3) return '3';
  if (confidence >= 2) return '2';
  return '1';
}

/**
 * 🌍 GPS 위치 획득 (웹 + 모바일 공통)
 * - 성공: { lat, lon } 반환
 * - 실패/거부/미지원: null 반환 (서울 fallback)
 */
function getUserGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[ZeliCast] Geolocation API 미지원');
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => { console.warn('[ZeliCast] GPS 거부/오류:', err.message); resolve(null); },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT, maximumAge: 60000 }
    );
  });
}

/**
 * 🗺️ 역지오코딩 (좌표 → 도시 이름)
 * OpenStreetMap Nominatim (무료, 키 불필요, 모바일 호환)
 */
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'ZeliCast/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const name = addr.city || addr.town || addr.county || addr.state || data.display_name?.split(',')[0] || '';
    const detail = addr.suburb || addr.neighbourhood || addr.district || addr.borough || '';
    return { name, detail };
  } catch { return null; }
}

export default function ZeliCastModal({ isOpen, onClose }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [gpsStatus, setGpsStatus] = useState('pending'); // pending | granted | denied
  const [loadedSources, setLoadedSources] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchWeather = useCallback(async (loc) => {
    setLoading(true);
    setError(null);
    setLoadedSources([]);
    setWeather(null);

    const sourceLoadAnimation = async () => {
      for (let i = 0; i < SOURCES.length; i++) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
        setLoadedSources(prev => [...prev, SOURCES[i]]);
      }
    };

    try {
      const [, data] = await Promise.all([
        sourceLoadAnimation(),
        fetch(`${API_BASE}/weather?lat=${loc.lat}&lon=${loc.lon}`).then(r => {
          if (!r.ok) throw new Error('서버 응답 오류');
          return r.json();
        }),
      ]);
      setWeather(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 모달 열릴 때: GPS → 역지오코딩 → 날씨 fetch
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      setGpsStatus('pending');
      const gps = await getUserGPS();

      if (cancelled) return;

      if (gps) {
        setGpsStatus('granted');
        const loc = { ...DEFAULT_LOCATION, lat: gps.lat, lon: gps.lon };

        // 역지오코딩 (논블로킹 — 날씨 fetch와 병렬)
        reverseGeocode(gps.lat, gps.lon).then((geo) => {
          if (!cancelled && geo?.name) {
            setLocation(prev => ({ ...prev, name: geo.name, detail: geo.detail || '' }));
          }
        });

        setLocation(loc);
        fetchWeather(loc);
      } else {
        setGpsStatus('denied');
        setLocation(DEFAULT_LOCATION);
        fetchWeather(DEFAULT_LOCATION);
      }
    })();

    return () => {
      cancelled = true;
      setWeather(null);
      setLoading(true);
      setError(null);
      setLoadedSources([]);
      setSelectedDay(null);
    };
  }, [isOpen, fetchWeather]);

  if (!isOpen) return null;

  const handleRefresh = () => fetchWeather(location);

  return (
    <div className="zelicast-overlay" onClick={onClose}>
      <div className="zelicast-modal" onClick={e => e.stopPropagation()}>
        <div className="zc-close-btn">
          <button onClick={onClose}>✕</button>
        </div>

        <div className="zc-content">
          <ZCHeader />

          {loading && <LoadingState loadedSources={loadedSources} />}
          {error && <ErrorState message={error} onRetry={handleRefresh} />}

          {!loading && !error && weather && (
            <>
              <LocationBar location={location} gpsStatus={gpsStatus} />
              <div className="zc-fade-in">
                <WeatherHero current={weather.current} />
              </div>
              <div className="zc-fade-in zc-fade-in-delay-1">
                <StatsRow current={weather.current} />
              </div>
              <div className="zc-fade-in zc-fade-in-delay-2">
                <HourlyForecast hourly={weather.hourly} />
              </div>
              <div className="zc-fade-in zc-fade-in-delay-3">
                <DailyForecast daily={weather.daily} onSelectDay={setSelectedDay} />
              </div>
              <div className="zc-fade-in zc-fade-in-delay-4">
                <SourceVotes votes={weather.current?.votes || []} title="현재 날씨 투표 현황" />
              </div>
              <ZCFooter weather={weather} />
            </>
          )}
        </div>

        {selectedDay && (
          <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
        )}
      </div>
    </div>
  );
}

/* ═══════ Sub-Components ═══════ */

function ZCHeader() {
  return (
    <div className="zc-header">
      <div className="zc-header-logo"><i className="fas fa-cloud-sun" style={{ marginRight: '6px' }} />ZeliCast</div>
      <div className="zc-header-tagline">ZeliAI, forecast sLM</div>
    </div>
  );
}

function LocationBar({ location, gpsStatus }) {
  return (
    <div className="zc-location-bar">
      <span className="zc-location-icon"><i className="fas fa-map-marker-alt" /></span>
      <div className="zc-location-text">
        <div className="zc-location-name">{location.name}</div>
        <div className="zc-location-detail">
          {location.detail}
          {gpsStatus === 'granted' && (
            <span style={{ marginLeft: '6px', color: '#22c55e', fontSize: '0.7rem' }}>
              <i className="fas fa-crosshairs" style={{ marginRight: '3px' }} />GPS
            </span>
          )}
          {gpsStatus === 'denied' && (
            <span style={{ marginLeft: '6px', color: '#6b7280', fontSize: '0.65rem' }}>기본 위치</span>
          )}
        </div>
      </div>
    </div>
  );
}

function WeatherHero({ current }) {
  if (!current) return null;

  const scoreColor = current.confidence >= 4 ? '#22c55e' :
    current.confidence >= 3 ? '#f59e0b' : '#ef4444';

  return (
    <div className="zc-hero">
      <div className="zc-hero-icon"><ConditionIcon condition={current.condition} size="4.5rem" /></div>
      <div className="zc-hero-temp">
        {Math.round(current.temp)}<span className="zc-unit">°</span>
      </div>
      <div className="zc-hero-condition">{current.condition_label}</div>
      {current.feels_like != null && (
        <div className="zc-hero-feels">체감 {Math.round(current.feels_like)}°</div>
      )}
      <ConfidenceBadge confidence={current.confidence} total={current.confidence_total} scoreColor={scoreColor} />
    </div>
  );
}

function ConfidenceBadge({ confidence, total, scoreColor, style }) {
  const level = getConfidenceLevel(confidence);
  return (
    <div className="zc-confidence-badge" style={style}>
      <span className="zc-confidence-label">합의 신뢰도</span>
      <div className="zc-confidence-dots">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`zc-confidence-dot ${i <= confidence ? `zc-active zc-level-${level}` : ''}`}
          />
        ))}
      </div>
      <span className="zc-confidence-score" style={{ color: scoreColor || '#f1f5f9' }}>
        {confidence}/{total}
      </span>
    </div>
  );
}

function StatsRow({ current }) {
  if (!current) return null;
  return (
    <div className="zc-stats-row">
      <div className="zc-stat-card">
        <div className="zc-stat-icon"><i className="fas fa-tint" /></div>
        <div className="zc-stat-value">{current.humidity}%</div>
        <div className="zc-stat-label">습도</div>
      </div>
      <div className="zc-stat-card">
        <div className="zc-stat-icon"><i className="fas fa-wind" /></div>
        <div className="zc-stat-value">{current.wind_speed}</div>
        <div className="zc-stat-label">풍속 km/h</div>
      </div>
      <div className="zc-stat-card">
        <div className="zc-stat-icon"><i className="fas fa-cloud-showers-heavy" /></div>
        <div className="zc-stat-value">{current.precipitation_prob ?? '—'}%</div>
        <div className="zc-stat-label">강수확률</div>
      </div>
    </div>
  );
}

function HourlyForecast({ hourly }) {
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  if (!hourly || hourly.length === 0) return null;

  // 현재 KST 시각 기준으로 이미 지난 시간대 필터링 (프론트엔드 이중 안전장치)
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  const currentHourKey = kstNow.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  const filtered = hourly.filter(h => h.time >= currentHourKey);
  const displayHourly = filtered.length > 0 ? filtered.slice(0, 24) : hourly.slice(0, 24);

  // 드래그 스크롤 핸들러 (데스크탑 지원)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragState.current.startX = e.pageX - scrollRef.current.offsetLeft;
    dragState.current.scrollLeft = scrollRef.current.scrollLeft;
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5;
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="zc-section">
      <div className="zc-section-header">
        <span className="zc-section-title"><i className="far fa-clock" style={{ marginRight: '6px' }} />시간별 예보</span>
        <span className="zc-section-subtitle">24시간</span>
      </div>
      <div
        className="zc-hourly-scroll"
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {displayHourly.map((h, i) => (
          <div key={h.time} className={`zc-hourly-card ${i === 0 ? 'zc-now' : ''}`}>
            <div className="zc-hourly-time">{i === 0 ? '지금' : `${h.hour}시`}</div>
            <div className="zc-hourly-icon"><ConditionIcon condition={h.condition} size="1.5rem" /></div>
            <div className="zc-hourly-temp">{Math.round(h.temp)}°</div>
            {h.precipitation_prob > 0 && (
              <div className="zc-hourly-precip"><i className="fas fa-tint" style={{ marginRight: '2px' }} />{h.precipitation_prob}%</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyForecast({ daily, onSelectDay }) {
  if (!daily || daily.length === 0) return null;
  const allMins = daily.map(d => d.temp_min);
  const allMaxs = daily.map(d => d.temp_max);
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const tempRange = globalMax - globalMin || 1;

  return (
    <div className="zc-section">
      <div className="zc-section-header">
        <span className="zc-section-title"><i className="far fa-calendar-alt" style={{ marginRight: '6px' }} />주간 예보</span>
        <span className="zc-section-subtitle">{daily.length}일</span>
      </div>
      <div className="zc-daily-list">
        {daily.map((d, i) => {
          const barLeft = ((d.temp_min - globalMin) / tempRange) * 100;
          const barWidth = ((d.temp_max - d.temp_min) / tempRange) * 100;
          return (
            <div key={d.date} className="zc-daily-row" onClick={() => onSelectDay(d)}>
              <div className="zc-daily-day">{d.day_of_week}</div>
              <div className="zc-daily-icon"><ConditionIcon condition={d.condition} size="1.3rem" /></div>
              <div
                className="zc-daily-temp-bar zc-tooltip-wrap"
                data-tooltip={`최저 ${Math.round(d.temp_min)}° / 최고 ${Math.round(d.temp_max)}° (일교차 ${Math.round(d.temp_max - d.temp_min)}°)`}
                title={`최저 ${Math.round(d.temp_min)}° / 최고 ${Math.round(d.temp_max)}° (일교차 ${Math.round(d.temp_max - d.temp_min)}°)`}
              >
                <span className="zc-daily-temp-min">{Math.round(d.temp_min)}°</span>
                <div className="zc-daily-bar-track">
                  <div
                    className="zc-daily-bar-fill"
                    style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 8)}%` }}
                  />
                </div>
                <span className="zc-daily-temp-max">{Math.round(d.temp_max)}°</span>
              </div>
              <div className="zc-daily-precip">
                {d.precipitation_prob > 0 ? <><i className="fas fa-tint" style={{ marginRight: '2px' }} />{d.precipitation_prob}%</> : ''}
              </div>
              <div
                className="zc-daily-confidence zc-tooltip-wrap"
                data-tooltip={`합의 신뢰도 ${d.confidence}/5`}
                title={`합의 신뢰도 ${d.confidence}/5`}
              >
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className={`zc-daily-confidence-dot ${j <= d.confidence ? 'zc-active' : ''}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceVotes({ votes, title }) {
  if (!votes || votes.length === 0) return null;
  const dataCount = votes.filter(v => !v.noData).length;
  const totalCount = votes.length;
  return (
    <div className="zc-section">
      <div className="zc-section-header">
        <span className="zc-section-title"><i className="fas fa-vote-yea" style={{ marginRight: '6px' }} />{title}</span>
        {dataCount < totalCount && (
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{dataCount}/{totalCount} 소스 응답</span>
        )}
      </div>
      <div className="zc-votes-panel">
        {votes.map((v, i) => (
          <div key={i} className={`zc-vote-row ${v.noData ? 'zc-vote-nodata' : ''}`}>
            <div className={`zc-vote-status ${v.noData ? 'zc-nodata' : v.agreed ? 'zc-agreed' : 'zc-dissent'}`}>
              {v.noData ? <i className="fas fa-minus" /> : v.agreed ? <i className="fas fa-check" /> : <i className="fas fa-times" />}
            </div>
            <div className="zc-vote-source">{v.name}</div>
            <div className="zc-vote-condition">
              {v.noData ? (
                <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.75rem' }}>예보 기간 초과</span>
              ) : (
                <>
                  <span><ConditionIcon condition={v.condition} /></span>
                  <span>{v.condition_label}</span>
                </>
              )}
            </div>
            <span className={`zc-vote-tag ${v.noData ? 'zc-no-vote' : v.agreed ? 'zc-majority' : 'zc-minority'}`}>
              {v.noData ? '—' : v.agreed ? '합의' : '소수'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayDetailModal({ day, onClose }) {
  const scoreColor = day.confidence >= 4 ? '#22c55e' :
    day.confidence >= 3 ? '#f59e0b' : '#ef4444';
  const noDataCount = day.votes ? day.votes.filter(v => v.noData).length : 0;
  return (
    <div className="zc-day-modal-overlay" onClick={onClose}>
      <div className="zc-day-modal-content" onClick={e => e.stopPropagation()}>
        <div className="zc-day-modal-handle" />
        <div className="zc-day-modal-title">
          {day.date} ({day.day_of_week}) 상세
        </div>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '3rem' }}><ConditionIcon condition={day.condition} size="3rem" /></div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '8px', color: '#f1f5f9' }}>
            {day.condition_label}
          </div>
          <div style={{ color: '#9ca3af', marginTop: '4px' }}>
            {Math.round(day.temp_min)}° / {Math.round(day.temp_max)}°
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConfidenceBadge confidence={day.confidence} total={day.confidence_total} scoreColor={scoreColor} />
        </div>
        {noDataCount > 0 && (
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9ca3af', marginTop: '8px', padding: '0 16px' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '4px' }} />
            {noDataCount}개 소스는 이 날짜의 예보를 제공하지 않습니다 (무료 티어 예보 기간 초과)
          </div>
        )}
        {day.votes && (
          <div style={{ marginTop: '20px' }}>
            <SourceVotes votes={day.votes} title="API별 예보" />
          </div>
        )}
        <button className="zc-btn zc-btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: '16px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

function LoadingState({ loadedSources }) {
  return (
    <div className="zc-loading-container">
      <div className="zc-loading-spinner" />
      <div className="zc-loading-text">
        5개 기상 API에서<br />예보를 수집하고 있습니다...
      </div>
      <div className="zc-loading-sources">
        {SOURCES.map(s => (
          <div key={s} className={`zc-loading-source ${loadedSources.includes(s) ? 'zc-done' : ''}`}>
            <div className="zc-loading-source-dot" />
            <span>{s}</span>
            <span style={{ marginLeft: 'auto' }}>
              {loadedSources.includes(s) ? <i className="fas fa-check" /> : '...'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="zc-error-container">
      <div className="zc-error-icon"><i className="fas fa-exclamation-triangle" /></div>
      <div className="zc-error-title">날씨 데이터를 가져올 수 없습니다</div>
      <div className="zc-error-message">{message}</div>
      <button className="zc-btn zc-btn-primary" onClick={onRetry}>다시 시도</button>
    </div>
  );
}


function ZCFooter({ weather }) {
  return (
    <div className="zc-footer">
      <div>
        {weather?.cached && <><i className="fas fa-box" style={{ marginRight: '4px' }} />캐시된 데이터 · </>}
        마지막 갱신: {new Date(weather?.timestamp).toLocaleTimeString('ko-KR')}
      </div>
      <div style={{ marginTop: '4px' }}>
        ZeliCast — 합의 기반 날씨 예보 · {new Date().getFullYear()}
      </div>
    </div>
  );
}
