import { useState } from 'react';

/* ═══════ 9개 도 (Province polygons) ═══════ */
const PROVINCES = [
  {
    id: 'gyeonggi', name: '경기도', shortName: '경기',
    detail: '수원시', lat: 37.4138, lon: 127.5183,
    path: 'M85,89 L170,85 L238,102 L247,170 L187,183 L128,166 L85,149 L60,132 Z',
    labelX: 148, labelY: 138,
  },
  {
    id: 'gangwon', name: '강원특별자치도', shortName: '강원',
    detail: '춘천시', lat: 37.8228, lon: 128.1555,
    path: 'M238,102 L170,85 L213,43 L298,34 L349,55 L366,111 L374,170 L323,196 L247,170 Z',
    labelX: 290, labelY: 112,
  },
  {
    id: 'chungbuk', name: '충청북도', shortName: '충북',
    detail: '청주시', lat: 36.6357, lon: 127.4917,
    path: 'M247,170 L323,196 L281,255 L255,281 L213,264 L187,183 Z',
    labelX: 248, labelY: 218,
  },
  {
    id: 'chungnam', name: '충청남도', shortName: '충남',
    detail: '홍성군', lat: 36.5184, lon: 126.8000,
    path: 'M187,183 L213,264 L170,272 L128,255 L85,230 L68,187 L85,149 L128,166 Z',
    labelX: 128, labelY: 218,
  },
  {
    id: 'jeonbuk', name: '전라북도', shortName: '전북',
    detail: '전주시', lat: 35.8203, lon: 127.1089,
    path: 'M213,264 L255,281 L213,315 L153,315 L85,289 L85,230 L128,255 L170,272 Z',
    labelX: 158, labelY: 284,
  },
  {
    id: 'jeonnam', name: '전라남도', shortName: '전남',
    detail: '무안군', lat: 34.8679, lon: 126.9910,
    path: 'M153,315 L213,315 L238,357 L196,400 L111,425 L68,383 L85,289 Z',
    labelX: 148, labelY: 368,
  },
  {
    id: 'gyeongbuk', name: '경상북도', shortName: '경북',
    detail: '안동시', lat: 36.4919, lon: 128.8889,
    path: 'M323,196 L374,170 L391,213 L383,264 L349,281 L255,281 L281,255 Z',
    labelX: 332, labelY: 232,
  },
  {
    id: 'gyeongnam', name: '경상남도', shortName: '경남',
    detail: '창원시', lat: 35.4606, lon: 128.2132,
    path: 'M255,281 L349,281 L366,332 L315,357 L238,357 L213,315 Z',
    labelX: 288, labelY: 318,
  },
  {
    id: 'jeju', name: '제주특별자치도', shortName: '제주',
    detail: '제주시', lat: 33.4996, lon: 126.5312,
    path: 'M94,459 L111,485 L153,493 L170,480 L153,459 Z',
    labelX: 132, labelY: 478,
  },
];

/* ═══════ 8개 광역시/특별시 (City markers) ═══════ */
const CITIES = [
  { id: 'seoul',   name: '서울특별시',   shortName: '서울', detail: '중구',   lat: 37.5665, lon: 126.9780, cx: 168, cy: 118 },
  { id: 'incheon', name: '인천광역시',   shortName: '인천', detail: '남동구', lat: 37.4563, lon: 126.7052, cx: 98,  cy: 135 },
  { id: 'sejong',  name: '세종특별자치시', shortName: '세종', detail: '',      lat: 36.4800, lon: 127.0000, cx: 185, cy: 208 },
  { id: 'daejeon', name: '대전광역시',   shortName: '대전', detail: '서구',   lat: 36.3504, lon: 127.3845, cx: 210, cy: 240 },
  { id: 'gwangju', name: '광주광역시',   shortName: '광주', detail: '서구',   lat: 35.1595, lon: 126.8526, cx: 125, cy: 335 },
  { id: 'daegu',   name: '대구광역시',   shortName: '대구', detail: '중구',   lat: 35.8714, lon: 128.6014, cx: 318, cy: 268 },
  { id: 'ulsan',   name: '울산광역시',   shortName: '울산', detail: '중구',   lat: 35.5384, lon: 129.3114, cx: 370, cy: 292 },
  { id: 'busan',   name: '부산광역시',   shortName: '부산', detail: '중구',   lat: 35.1796, lon: 129.0756, cx: 350, cy: 330 },
];

const ALL_REGIONS = [...PROVINCES, ...CITIES];

/* ═══════ 빠른 선택용 주요 도시 목록 ═══════ */
const QUICK_LIST = [
  { name: '서울', id: 'seoul' },
  { name: '인천', id: 'incheon' },
  { name: '대전', id: 'daejeon' },
  { name: '대구', id: 'daegu' },
  { name: '부산', id: 'busan' },
  { name: '광주', id: 'gwangju' },
  { name: '울산', id: 'ulsan' },
  { name: '제주', id: 'jeju' },
];

export default function KoreaMapModal({ onSelectRegion, currentLocationName, onClose }) {
  const [hoveredId, setHoveredId] = useState(null);

  const handleSelect = (region) => {
    onSelectRegion({ name: region.name, detail: region.detail, lat: region.lat, lon: region.lon });
  };

  const hoveredRegion = ALL_REGIONS.find(r => r.id === hoveredId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content korea-map-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">📍 지역 선택</div>

        {/* Tooltip */}
        <div className="map-tooltip-bar">
          {hoveredRegion
            ? <span className="map-tooltip-name">{hoveredRegion.name}</span>
            : <span className="map-tooltip-hint">지도에서 지역을 선택하세요</span>
          }
        </div>

        {/* SVG Map */}
        <div className="korea-map-container">
          <svg
            className="korea-map-svg"
            viewBox="30 15 400 500"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Province polygons */}
            {PROVINCES.map(p => (
              <g key={p.id}>
                <path
                  d={p.path}
                  className={`region-path ${hoveredId === p.id ? 'hovered' : ''} ${currentLocationName === p.name ? 'selected' : ''}`}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(p)}
                />
                <text
                  x={p.labelX} y={p.labelY}
                  className="region-label"
                  pointerEvents="none"
                >
                  {p.shortName}
                </text>
              </g>
            ))}

            {/* City markers */}
            {CITIES.map(c => (
              <g key={c.id}
                className={`city-marker-group ${hoveredId === c.id ? 'hovered' : ''} ${currentLocationName === c.name ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelect(c)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={c.cx} cy={c.cy} r="10" className="city-marker-bg" />
                <circle cx={c.cx} cy={c.cy} r="4" className="city-marker-dot" />
                <text x={c.cx} y={c.cy - 14} className="city-label">
                  {c.shortName}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Quick select chips */}
        <div className="map-quick-select">
          {QUICK_LIST.map(q => {
            const region = ALL_REGIONS.find(r => r.id === q.id);
            if (!region) return null;
            return (
              <button
                key={q.id}
                className={`map-chip ${currentLocationName === region.name ? 'active' : ''}`}
                onClick={() => handleSelect(region)}
              >
                {q.name}
              </button>
            );
          })}
        </div>

        <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: '12px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}
