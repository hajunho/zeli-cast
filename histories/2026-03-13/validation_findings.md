# ZeliCast Code Validation Findings

**검증 대상:** `e:\HJH_DEV\killerapp` (ZeliCast 합의 기반 날씨 앱)  
**검증일:** 2026-03-13  
**검증자:** 하준호2, 코드검증팀장, (주)예진  

---

## 요약

| 심각도 | 건수 |
|--|--|
| 🔴 Critical | 3 |
| 🟠 Major | 5 |
| 🟡 Minor | 7 |
| 🔵 Info | 4 |
| **합계** | **19** |

---

## 🔴 Critical (3건)

### C-01. 합의 엔진 — `buildVoteDetail`에서 `majorityVote`를 매 vote마다 재호출
- **파일:** `server/services/consensus.js` L171-178
- **설명:** `buildVoteDetail` 함수 내부에서 `agreed` 속성을 계산할 때 `majorityVote(conditionVotes).winner`를 매 소스마다 다시 호출합니다. 이는 votes 배열 크기 n에 대해 O(n²) 복잡도를 유발합니다.
- **영향:** 현재 n=5이므로 성능 이슈는 미미하나, 로직 자체가 불필요한 재계산 구조이며, 향후 소스 확장 시 성능 저하. 또한, 같은 로직이 `buildCurrentConsensus`, `buildHourlyConsensus`, `buildDailyConsensus`에서 각각 별도로 호출된 후 다시 `buildVoteDetail`에서 재호출됨.
- **권장:** winner를 인자로 전달하거나 외부에서 한 번 계산 후 재사용.

### C-02. `lat`/`lon` 쿼리 파라미터 입력 검증 미비 — NaN 전파 가능
- **파일:** `server/index.js` L19-24
- **설명:** `lat`, `lon`이 존재하는지만 체크하고 `parseFloat` 결과가 `NaN`인지 검증하지 않습니다. `?lat=abc&lon=xyz` 요청 시 `NaN`이 Open-Meteo API 요청에 전파되어 예측 불가능한 오류 발생.
- **영향:** 외부 API에 잘못된 요청 전달, 유효하지 않은 캐시 키 저장.
- **권장:** `isNaN()` 또는 `Number.isFinite()` 추가 검증, 범위 검증(lat: -90~90, lon: -180~180).

### C-03. Open-Meteo API 응답 상태 코드 미검증
- **파일:** `server/services/adapters/openmeteo.js` L23-24
- **설명:** `fetch` 응답의 `res.ok` (HTTP 상태)를 확인하지 않고 바로 `res.json()`을 호출합니다. API가 4xx/5xx 에러를 반환해도 `status: 'ok'`로 처리되어 잘못된 데이터가 합의 엔진에 투입됩니다.
- **영향:** 잘못된 데이터가 정규화 과정에서 undefined 접근으로 런타임 에러 유발 가능.
- **권장:** `if (!res.ok) throw new Error(...)` 추가.

---

## 🟠 Major (5건)

### M-01. `cache.js` — `setInterval` 누수 방지 없음
- **파일:** `server/services/cache.js` L24-31
- **설명:** `setInterval`이 모듈 최상위에서 실행되며, 프로세스 종료 시 `clearInterval`을 호출하지 않습니다. 테스트 환경에서 모듈을 여러 번 임포트하면 타이머 누수 발생 가능.
- **권장:** `clearInterval` 참조를 export하거나, graceful shutdown 핸들러에서 정리.

### M-02. CORS 설정이 모두 허용(`cors()`)
- **파일:** `server/index.js` L10
- **설명:** `cors()` 미들웨어를 기본 옵션으로 사용하여 모든 origin을 허용합니다. 프로덕션 배포 시 보안 취약점.
- **권장:** `cors({ origin: 'http://localhost:5173' })` 또는 환경변수 기반 화이트리스트.

### M-03. useEffect 의존성 경고 — `location` 누락
- **파일:** `src/App.jsx` L50-52
- **설명:** `useEffect`의 의존성 배열이 `[]`로 빈 상태이지만 내부에서 `location` 상태를 사용합니다. React ESLint exhaustive-deps 규칙 위반.
- **영향:** `location`이 변경되어도 자동으로 재요청하지 않음 (현재 위치 변경 기능이 미구현이므로 실질적 문제는 없으나, 향후 위치 검색 기능 추가 시 반드시 수정 필요).
- **권장:** `[location.lat, location.lon]`을 의존성에 추가하거나, `fetchWeather`를 `useCallback`으로 래핑.

### M-04. `conditions.js` — 미사용 export 함수
- **파일:** `server/services/conditions.js` L62-73, L79-90
- **설명:** `owmIdToCondition`과 `textToCondition` 함수가 export되지만 프로젝트 어디에서도 사용되지 않습니다 (mock 어댑터는 condition 문자열을 직접 사용).
- **영향:** 데드 코드. 실제 API 연동 시 사용될 예정이나, 현재 코드에서는 불필요.
- **권장:** 사용 시점까지 보류하되, 코드 내 `// TODO: Used when real API adapters are implemented` 주석 추가 권장.

### M-05. DayDetailModal — body scroll lock 미처리
- **파일:** `src/App.jsx` L332-378
- **설명:** 모달이 열릴 때 배경 body의 스크롤이 잠기지 않습니다. 모바일에서 모달 뒤의 콘텐츠가 함께 스크롤될 수 있음.
- **권장:** `useEffect`에서 `document.body.style.overflow = 'hidden'`을 모달 mount/unmount 시 설정.

---

## 🟡 Minor (7건)

### m-01. WMO 코드 4~44 범위 미처리
- **파일:** `server/services/conditions.js` L43-56
- **설명:** WMO 코드 4~44 구간이 어떤 조건에도 매칭되지 않아 기본값 `CLOUDY`로 반환됩니다. WMO 코드 4~12는 Mist/Haze 계열로 `FOG`에 매핑되어야 합니다.
- **영향:** 낮음. 실제로 Open-Meteo는 이 범위의 코드를 거의 반환하지 않음.

### m-02. `consensus.js` — `failedSources` 변수 미사용
- **파일:** `server/services/consensus.js` L14
- **설명:** `failedSources`가 선언되지만 어디에도 참조되지 않습니다.
- **영향:** 없음 (데드 변수).

### m-03. hourly 강수확률 `|| [0]` 폴백 위치 오류
- **파일:** `server/services/consensus.js` L97
- **설명:** `.filter(v => v != null) || [0]` 는 의도와 다르게 동작합니다. `filter`는 빈 배열`[]`을 반환할 수 있으며, 빈 배열은 truthy이므로 `|| [0]` 폴백은 절대 실행되지 않습니다. 빈 배열이 `median()`에 전달되면 `0`을 반환하므로 실질 문제는 없으나 의도와 불일치.
- **권장:** 명시적으로 `const arr = ...; arr.length === 0 ? 0 : median(arr)` 패턴 사용.

### m-04. `ALL_CONDITIONS` 변수 미사용
- **파일:** `server/services/adapters/mock.js` L14
- **설명:** `const ALL_CONDITIONS = Object.values(CONDITIONS);`가 선언되었으나 사용되지 않음.

### m-05. CSS — `header-actions` 클래스 정의되었으나 JSX에서 미사용
- **파일:** `src/index.css` L168-171
- **설명:** `.header-actions` CSS 규칙이 정의되었으나, `App.jsx`의 `Header` 컴포넌트에서 해당 클래스를 사용하는 요소 없음.

### m-06. `StatsRow` — 풍속 값에 단위 미포함
- **파일:** `src/App.jsx` L201
- **설명:** 풍속 값이 숫자만 표시되고 `km/h`는 label에만 있습니다. 접근성 측면에서 값 자체에 단위를 포함하거나 `aria-label`을 추가하는 것이 좋습니다.

### m-07. `LocationBar` — 클릭 이벤트 핸들러 없음
- **파일:** `src/App.jsx` L140
- **설명:** `cursor: pointer`와 ▼ 아이콘이 있어 클릭 가능한 것처럼 보이지만, 실제 `onClick` 핸들러가 없습니다.

---

## 🔵 Info / 개선제안 (4건)

### I-01. 환경변수로 PORT 관리 권장
- **파일:** `server/index.js` L8
- **설명:** `const PORT = 3001`이 하드코딩됨. `process.env.PORT || 3001` 패턴 권장.

### I-02. `AbortSignal.timeout` Node.js 버전 의존
- **파일:** `server/services/adapters/openmeteo.js` L23
- **설명:** `AbortSignal.timeout()`은 Node.js 17.3+ 에서 지원됩니다. 구 버전에서는 런타임 에러 발생.
- **권장:** `package.json`에 `"engines": { "node": ">=18" }` 명시.

### I-03. React StrictMode 유지 권장
- **파일:** `src/main.jsx` L6-9
- **설명:** 현재 StrictMode가 활성화되어 있습니다 (좋음). 개발 시 이중 렌더링으로 부작용 감지 가능.

### I-04. `package.json` — 프론트엔드와 백엔드 동시 실행 스크립트 부재
- **설명:** 현재 프론트엔드와 백엔드를 별도 터미널에서 실행해야 합니다. `concurrently` 패키지를 활용한 단일 명령어 실행 스크립트 추가 권장.
