/**
 * ZeliCastModal — 합의 기반 날씨 예보 모달
 * 5개 기상 API 합의 결과를 zeliai 스타일로 표시
 */
import React, { useState, useEffect } from 'react';
import './ZeliCast.css';

const API_BASE = '/api/cast';
const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.9780, name: '서울특별시', detail: '중구' };
const SOURCES = ['Open-Meteo', 'OpenWeatherMap', 'WeatherAPI', '기상청', 'Tomorrow.io'];

function getConfidenceLevel(confidence) {
  if (confidence >= 5) return '5';
  if (confidence >= 4) return '4';
  if (confidence >= 3) return '3';
  if (confidence >= 2) return '2';
  return '1';
}

export default function ZeliCastModal({ isOpen, onClose }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location] = useState(DEFAULT_LOCATION);
  const [loadedSources, setLoadedSources] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchWeather = async (loc) => {
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchWeather(location);
    }
    return () => {
      setWeather(null);
      setLoading(true);
      setError(null);
      setLoadedSources([]);
      setSelectedDay(null);
    };
  }, [isOpen]);

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
              <LocationBar location={location} />
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

function LocationBar({ location }) {
  return (
    <div className="zc-location-bar">
      <span className="zc-location-icon"><i className="fas fa-map-marker-alt" /></span>
      <div className="zc-location-text">
        <div className="zc-location-name">{location.name}</div>
        <div className="zc-location-detail">{location.detail}</div>
      </div>
      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>▼</span>
    </div>
  );
}

function WeatherHero({ current }) {
  if (!current) return null;

  const scoreColor = current.confidence >= 4 ? '#22c55e' :
    current.confidence >= 3 ? '#f59e0b' : '#ef4444';

  return (
    <div className="zc-hero">
      <div className="zc-hero-icon">{current.condition_icon}</div>
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
  if (!hourly || hourly.length === 0) return null;
  return (
    <div className="zc-section">
      <div className="zc-section-header">
        <span className="zc-section-title"><i className="far fa-clock" style={{ marginRight: '6px' }} />시간별 예보</span>
        <span className="zc-section-subtitle">24시간</span>
      </div>
      <div className="zc-hourly-scroll">
        {hourly.slice(0, 24).map((h, i) => (
          <div key={h.time} className={`zc-hourly-card ${i === 0 ? 'zc-now' : ''}`}>
            <div className="zc-hourly-time">{i === 0 ? '지금' : `${h.hour}시`}</div>
            <div className="zc-hourly-icon">{h.condition_icon}</div>
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
        <span className="zc-section-subtitle">7일</span>
      </div>
      <div className="zc-daily-list">
        {daily.map((d, i) => {
          const barLeft = ((d.temp_min - globalMin) / tempRange) * 100;
          const barWidth = ((d.temp_max - d.temp_min) / tempRange) * 100;
          return (
            <div key={d.date} className="zc-daily-row" onClick={() => onSelectDay(d)}>
              <div className="zc-daily-day">{i === 0 ? '오늘' : d.day_of_week}</div>
              <div className="zc-daily-icon">{d.condition_icon}</div>
              <div className="zc-daily-temp-bar">
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
              <div className="zc-daily-confidence">
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
  return (
    <div className="zc-section">
      <div className="zc-section-header">
        <span className="zc-section-title"><i className="fas fa-vote-yea" style={{ marginRight: '6px' }} />{title}</span>
      </div>
      <div className="zc-votes-panel">
        {votes.map((v, i) => (
          <div key={i} className="zc-vote-row">
            <div className={`zc-vote-status ${v.agreed ? 'zc-agreed' : 'zc-dissent'}`}>
              {v.agreed ? <i className="fas fa-check" /> : <i className="fas fa-times" />}
            </div>
            <div className="zc-vote-source">{v.name}</div>
            <div className="zc-vote-condition">
              <span>{v.condition_icon}</span>
              <span>{v.condition_label}</span>
            </div>
            <span className={`zc-vote-tag ${v.agreed ? 'zc-majority' : 'zc-minority'}`}>
              {v.agreed ? '합의' : '소수'}
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
  return (
    <div className="zc-day-modal-overlay" onClick={onClose}>
      <div className="zc-day-modal-content" onClick={e => e.stopPropagation()}>
        <div className="zc-day-modal-handle" />
        <div className="zc-day-modal-title">
          {day.date} ({day.day_of_week}) 상세
        </div>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '3rem' }}>{day.condition_icon}</div>
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
