import { useState, useEffect } from 'react'
import './App.css'
import KoreaMapModal from './KoreaMap'

const API_BASE = '/api';

// Default location: Seoul
const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.9780, name: '서울특별시', detail: '중구' };

const SOURCES = ['Open-Meteo', 'OpenWeatherMap', 'WeatherAPI', '기상청', 'Tomorrow.io'];

function App() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [loadedSources, setLoadedSources] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const fetchWeather = async (loc) => {
    setLoading(true);
    setError(null);
    setLoadedSources([]);
    setWeather(null);

    // Simulate sequential source loading for UX
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

  const handleRegionSelect = (region) => {
    setLocation(region);
    setShowMap(false);
    fetchWeather(region);
  };

  useEffect(() => {
    fetchWeather(location);
  }, []);

  const handleRefresh = () => fetchWeather(location);

  const mapModal = showMap && (
    <KoreaMapModal
      onSelectRegion={handleRegionSelect}
      currentLocationName={location.name}
      onClose={() => setShowMap(false)}
    />
  );

  if (loading) {
    return (
      <div className="app">
        <div className="app-container">
          <Header />
          <LocationBar location={location} onClick={() => setShowMap(true)} />
          <LoadingState loadedSources={loadedSources} />
          {mapModal}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="app-container">
          <Header />
          <LocationBar location={location} onClick={() => setShowMap(true)} />
          <ErrorState message={error} onRetry={handleRefresh} />
          {mapModal}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-container">
        <Header />
        <LocationBar location={location} onClick={() => setShowMap(true)} />

        <div className="fade-in">
          <WeatherHero current={weather.current} />
        </div>

        <div className="fade-in fade-in-delay-1">
          <StatsRow current={weather.current} />
        </div>

        <div className="fade-in fade-in-delay-2">
          <HourlyForecast hourly={weather.hourly} />
        </div>

        <div className="fade-in fade-in-delay-3">
          <DailyForecast
            daily={weather.daily}
            onSelectDay={setSelectedDay}
          />
        </div>

        <div className="fade-in fade-in-delay-4">
          <SourceVotes
            votes={weather.current?.votes || []}
            title="현재 날씨 투표 현황"
          />
        </div>

        <Footer weather={weather} />

        {selectedDay && (
          <DayDetailModal
            day={selectedDay}
            onClose={() => setSelectedDay(null)}
          />
        )}

        {mapModal}
      </div>
    </div>
  );
}

/* ═══════ Header ═══════ */
function Header() {
  return (
    <header className="header">
      <div className="header-brand">
        <div>
          <div className="header-logo">🌤️ ZeliCast</div>
          <div className="header-tagline">5개가 보고, 3개가 동의한 날씨</div>
        </div>
      </div>
    </header>
  );
}

/* ═══════ Location Bar ═══════ */
function LocationBar({ location, onClick }) {
  return (
    <div className="location-bar" id="location-bar" onClick={onClick}>
      <span className="location-icon">📍</span>
      <div className="location-text">
        <div className="location-name">{location.name}</div>
        <div className="location-detail">{location.detail}</div>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▼</span>
    </div>
  );
}

/* ═══════ Weather Hero ═══════ */
function WeatherHero({ current }) {
  if (!current) return null;

  const confidenceColor = current.confidence >= 4 ? 'var(--confidence-5)' :
    current.confidence >= 3 ? 'var(--confidence-3)' : 'var(--confidence-1)';

  return (
    <div className="weather-hero" id="weather-hero">
      <div className="weather-hero-icon">{current.condition_icon}</div>
      <div className="weather-hero-temp">
        {Math.round(current.temp)}<span className="unit">°</span>
      </div>
      <div className="weather-hero-condition">{current.condition_label}</div>
      {current.feels_like != null && (
        <div className="weather-hero-feels">
          체감 {Math.round(current.feels_like)}°
        </div>
      )}
      <div className="confidence-badge">
        <span className="confidence-label">합의 신뢰도</span>
        <div className="confidence-dots">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={`confidence-dot ${i <= current.confidence ? 'active' : ''}`}
              data-level={getConfidenceLevel(current.confidence, current.confidence_total)}
            />
          ))}
        </div>
        <span className="confidence-score" style={{ color: confidenceColor }}>
          {current.confidence}/{current.confidence_total}
        </span>
      </div>
    </div>
  );
}

/* ═══════ Stats Row ═══════ */
function StatsRow({ current }) {
  if (!current) return null;
  return (
    <div className="stats-row" id="stats-row">
      <div className="stat-card">
        <div className="stat-icon">💧</div>
        <div className="stat-value">{current.humidity}%</div>
        <div className="stat-label">습도</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">💨</div>
        <div className="stat-value">{current.wind_speed}</div>
        <div className="stat-label">풍속 km/h</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">🌧️</div>
        <div className="stat-value">{current.precipitation_prob ?? '—'}%</div>
        <div className="stat-label">강수확률</div>
      </div>
    </div>
  );
}

/* ═══════ Hourly Forecast ═══════ */
function HourlyForecast({ hourly }) {
  if (!hourly || hourly.length === 0) return null;

  return (
    <div className="section" id="hourly-section">
      <div className="section-header">
        <span className="section-title">⏱ 시간별 예보</span>
        <span className="section-subtitle">24시간</span>
      </div>
      <div className="hourly-scroll">
        {hourly.slice(0, 24).map((h, i) => (
          <div key={h.time} className={`hourly-card ${i === 0 ? 'now' : ''}`}>
            <div className="hourly-time">{i === 0 ? '지금' : `${h.hour}시`}</div>
            <div className="hourly-icon">{h.condition_icon}</div>
            <div className="hourly-temp">{Math.round(h.temp)}°</div>
            {h.precipitation_prob > 0 && (
              <div className="hourly-precip">💧{h.precipitation_prob}%</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Daily Forecast ═══════ */
function DailyForecast({ daily, onSelectDay }) {
  if (!daily || daily.length === 0) return null;

  // Find temp range for bar visualization
  const allMins = daily.map(d => d.temp_min);
  const allMaxs = daily.map(d => d.temp_max);
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const tempRange = globalMax - globalMin || 1;

  return (
    <div className="section" id="daily-section">
      <div className="section-header">
        <span className="section-title">📅 주간 예보</span>
        <span className="section-subtitle">7일</span>
      </div>
      <div className="daily-list">
        {daily.map((d, i) => {
          const barLeft = ((d.temp_min - globalMin) / tempRange) * 100;
          const barWidth = ((d.temp_max - d.temp_min) / tempRange) * 100;

          return (
            <div
              key={d.date}
              className="daily-row"
              onClick={() => onSelectDay(d)}
              id={`daily-row-${i}`}
            >
              <div className="daily-day">
                {i === 0 ? '오늘' : d.day_of_week}
              </div>
              <div className="daily-icon">{d.condition_icon}</div>
              <div className="daily-temp-bar">
                <span className="daily-temp-min">{Math.round(d.temp_min)}°</span>
                <div className="daily-bar-track">
                  <div
                    className="daily-bar-fill"
                    style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 8)}%` }}
                  />
                </div>
                <span className="daily-temp-max">{Math.round(d.temp_max)}°</span>
              </div>
              <div className="daily-precip">
                {d.precipitation_prob > 0 ? `💧${d.precipitation_prob}%` : ''}
              </div>
              <div className="daily-confidence">
                {[1, 2, 3, 4, 5].map(j => (
                  <div
                    key={j}
                    className={`daily-confidence-dot ${j <= d.confidence ? 'active' : ''}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════ Source Votes ═══════ */
function SourceVotes({ votes, title }) {
  if (!votes || votes.length === 0) return null;

  return (
    <div className="section" id="votes-section">
      <div className="section-header">
        <span className="section-title">🗳️ {title}</span>
      </div>
      <div className="votes-panel">
        {votes.map((v, i) => (
          <div key={i} className="vote-row">
            <div className={`vote-status ${v.agreed ? 'agreed' : 'dissent'}`}>
              {v.agreed ? '✓' : '✗'}
            </div>
            <div className="vote-source">{v.name}</div>
            <div className="vote-condition">
              <span>{v.condition_icon}</span>
              <span>{v.condition_label}</span>
            </div>
            <span className={`vote-tag ${v.agreed ? 'majority' : 'minority'}`}>
              {v.agreed ? '합의' : '소수'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Day Detail Modal ═══════ */
function DayDetailModal({ day, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">
          {day.date} ({day.day_of_week}) 상세
        </div>

        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '3rem' }}>{day.condition_icon}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '8px' }}>
            {day.condition_label}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {Math.round(day.temp_min)}° / {Math.round(day.temp_max)}°
          </div>
        </div>

        <div className="confidence-badge" style={{ justifyContent: 'center', width: '100%' }}>
          <span className="confidence-label">합의 신뢰도</span>
          <div className="confidence-dots">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className={`confidence-dot ${i <= day.confidence ? 'active' : ''}`}
                data-level={getConfidenceLevel(day.confidence, day.confidence_total)}
              />
            ))}
          </div>
          <span className="confidence-score">
            {day.confidence}/{day.confidence_total}
          </span>
        </div>

        {day.votes && (
          <div style={{ marginTop: '20px' }}>
            <SourceVotes votes={day.votes} title="API별 예보" />
          </div>
        )}

        <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: '16px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

/* ═══════ Loading State ═══════ */
function LoadingState({ loadedSources }) {
  return (
    <div className="loading-container" id="loading-state">
      <div className="loading-spinner" />
      <div className="loading-text">
        5개 기상 API에서<br />예보를 수집하고 있습니다...
      </div>
      <div className="loading-sources">
        {SOURCES.map((s, i) => (
          <div
            key={s}
            className={`loading-source ${loadedSources.includes(s) ? 'done' : ''}`}
          >
            <div className="loading-source-dot" />
            <span>{s}</span>
            <span style={{ marginLeft: 'auto' }}>
              {loadedSources.includes(s) ? '✓' : '...'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Error State ═══════ */
function ErrorState({ message, onRetry }) {
  return (
    <div className="error-container" id="error-state">
      <div className="error-icon">⚠️</div>
      <div className="error-title">날씨 데이터를 가져올 수 없습니다</div>
      <div className="error-message">{message}</div>
      <button className="btn btn-primary" onClick={onRetry}>다시 시도</button>
    </div>
  );
}

/* ═══════ Footer ═══════ */
function Footer({ weather }) {
  return (
    <footer className="footer">
      <div>
        {weather?.cached && '📦 캐시된 데이터 · '}
        마지막 갱신: {new Date(weather?.timestamp).toLocaleTimeString('ko-KR')}
      </div>
      <div style={{ marginTop: '4px' }}>
        ZeliCast — 합의 기반 날씨 예보 · {new Date().getFullYear()}
      </div>
    </footer>
  );
}

/* ═══════ Helpers ═══════ */
function getConfidenceLevel(confidence, total) {
  if (confidence >= 5) return '5';
  if (confidence >= 4) return '4';
  if (confidence >= 3) return '3';
  if (confidence >= 2) return '2';
  return '1';
}

export default App
