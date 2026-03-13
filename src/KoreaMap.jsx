import { useState } from 'react';
import SouthKorea from '@svg-maps/south-korea';

// 한국어 이름 + 좌표 매핑
const REGION_META = {
  seoul:              { ko: '서울특별시',       sub: '중구',   lat: 37.5665, lon: 126.9780 },
  busan:              { ko: '부산광역시',       sub: '중구',   lat: 35.1796, lon: 129.0756 },
  daegu:              { ko: '대구광역시',       sub: '중구',   lat: 35.8714, lon: 128.6014 },
  incheon:            { ko: '인천광역시',       sub: '남동구', lat: 37.4563, lon: 126.7052 },
  gwangju:            { ko: '광주광역시',       sub: '서구',   lat: 35.1595, lon: 126.8526 },
  daejeon:            { ko: '대전광역시',       sub: '서구',   lat: 36.3504, lon: 127.3845 },
  ulsan:              { ko: '울산광역시',       sub: '남구',   lat: 35.5384, lon: 129.3114 },
  sejong:             { ko: '세종특별자치시',    sub: '세종시', lat: 36.4800, lon: 127.0000 },
  gyeonggi:           { ko: '경기도',           sub: '수원시', lat: 37.4138, lon: 127.5183 },
  gangwon:            { ko: '강원특별자치도',    sub: '춘천시', lat: 37.8228, lon: 128.1555 },
  'north-chungcheong':{ ko: '충청북도',         sub: '청주시', lat: 36.6357, lon: 127.4917 },
  'south-chungcheong':{ ko: '충청남도',         sub: '홍성군', lat: 36.5184, lon: 126.8000 },
  'north-jeolla':     { ko: '전라북도',         sub: '전주시', lat: 35.8242, lon: 127.1480 },
  'south-jeolla':     { ko: '전라남도',         sub: '무안군', lat: 34.8161, lon: 126.4629 },
  'north-gyeongsang': { ko: '경상북도',         sub: '안동시', lat: 36.5760, lon: 128.5056 },
  'south-gyeongsang': { ko: '경상남도',         sub: '창원시', lat: 35.2372, lon: 128.6811 },
  jeju:               { ko: '제주특별자치도',    sub: '제주시', lat: 33.4996, lon: 126.5312 },
};

const QUICK_LIST = ['seoul','busan','daegu','incheon','gwangju','daejeon','ulsan'];

export default function KoreaMapModal({ onSelectRegion, currentLocationName, onClose }) {
  const [hovered, setHovered] = useState(null);
  const hoveredMeta = hovered ? REGION_META[hovered] : null;

  const handleSelect = (id) => {
    const meta = REGION_META[id];
    if (!meta) return;
    onSelectRegion({ name: meta.ko, sub: meta.sub, lat: meta.lat, lon: meta.lon });
  };

  return (
    <div className="map-overlay" onClick={onClose}>
      <div className="map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-handle" />
        <h2 className="map-title">📍 지역 선택</h2>
        
        <div className="map-tooltip-bar">
          {hoveredMeta ? hoveredMeta.ko : '지도에서 지역을 선택하세요'}
        </div>

        <div className="map-svg-wrap">
          <svg
            viewBox={SouthKorea.viewBox}
            className="korea-svg"
            aria-label={SouthKorea.label}
          >
            {SouthKorea.locations.map(loc => {
              const meta = REGION_META[loc.id];
              const isSelected = meta && meta.ko === currentLocationName;
              return (
                <path
                  key={loc.id}
                  d={loc.path}
                  className={`province-path${isSelected ? ' selected' : ''}${hovered === loc.id ? ' hovered' : ''}`}
                  onMouseEnter={() => setHovered(loc.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleSelect(loc.id)}
                />
              );
            })}
          </svg>
        </div>

        <div className="map-quick-select">
          {QUICK_LIST.map(id => {
            const meta = REGION_META[id];
            return (
              <button
                key={id}
                className={`map-chip${meta.ko === currentLocationName ? ' active' : ''}`}
                onClick={() => handleSelect(id)}
              >
                {meta.ko.replace(/광역시|특별시/, '')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
