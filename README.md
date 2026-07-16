# 🌤 ZeliCast

**A consensus-based weather forecast app.** ZeliCast asks up to 5 independent weather APIs the same question and shows you the *majority vote* — because one forecast can be wrong, but five rarely agree on the same mistake. The same small server also provides news headlines, stock snapshots, and nearby-restaurant search.

Built with React + Vite on the front and a tiny Express server on the back. **No database, no accounts — clone and run.**

## 🚀 Run it locally

### What you need

Just **[Node.js](https://nodejs.org)** (free LTS version). Check with `node --version`.

### Windows — one command

Paste this into PowerShell — it gets the source and starts the app (works even without git installed):

```powershell
irm https://raw.githubusercontent.com/hajunho/zeliai_cast/master/get.ps1 | iex
```

Or the classic way:

```powershell
git clone https://github.com/hajunho/zeliai_cast.git
cd zeliai_cast
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

### macOS / Linux

```bash
git clone https://github.com/hajunho/zeliai_cast.git
cd zeliai_cast
chmod +x run.sh && ./run.sh
```

Then open **http://localhost:5172** (the backend runs on port 5171).

### 🔑 API keys — it just works

**All 5 weather sources work immediately after cloning.** The repo ships with **shared demo keys** in [`server/.env.demo`](server/.env.demo) — the maintainer's own free-tier keys, shared so you can try the full consensus experience without signing up for anything.

> **📢 Notice about the shared demo keys**
>
> - They are free-tier keys with **shared quotas** (e.g. 기상청 KMA: 10,000 calls/day for *everyone combined*). Please use them for a quick try-out only.
> - They may be **rotated or revoked at any time**. If a source suddenly shows as skipped, this is why — switch to your own keys.
> - `SERPAPI_KEY` (news/stocks/places) is **not** shared: its free tier is ~100 searches/month and a public key would be exhausted within hours. Grab your own at [serpapi.com](https://serpapi.com).

For regular use, get your own free keys (each takes ~2 minutes) — copy the example file and fill it in; your `server/.env` always overrides the demo keys:

```bash
cp server/.env.example server/.env   # then edit server/.env
```

| Key | Enables | Get a free key at |
|---|---|---|
| `KMA_API_KEY` | 기상청 (Korea Meteorological Administration) | [data.go.kr](https://data.go.kr) |
| `OWM_API_KEY` | OpenWeatherMap | [openweathermap.org](https://openweathermap.org/api) |
| `TOMORROW_API_KEY` | Tomorrow.io | [tomorrow.io](https://www.tomorrow.io/weather-api/) |
| `WEATHERAPI_KEY` | WeatherAPI | [weatherapi.com](https://www.weatherapi.com) |
| `SERPAPI_KEY` | News, stocks, nearby restaurants | [serpapi.com](https://serpapi.com) |

`server/.env` is gitignored — your keys never leave your machine.

## 🧠 How the consensus works

1. `server/services/aggregator.js` queries all configured sources **in parallel** — a slow or failing source never blocks the others.
2. `server/services/consensus.js` runs **majority voting** across the returned forecasts and reports the agreement level.
3. The frontend shows the consensus forecast on a map of Korea (`src/KoreaMap.jsx`) with per-source details one click away.

### API endpoints

| Endpoint | What it returns |
|---|---|
| `GET /api/cast/weather?lat=&lon=` | Consensus forecast for a location |
| `GET /api/cast/weather/sources?lat=&lon=` | Raw per-source forecasts (for comparison) |
| `GET /api/cast/news` | News headlines |
| `GET /api/cast/news/article?url=` | Readable article extract |
| `GET /api/cast/stock?symbol=` | Stock snapshot |
| `GET /api/cast/places?lat=&lon=` | Nearby restaurants |

## 📁 Project layout

```
├── src/               # React frontend (Vite, port 5172)
│   └── KoreaMap.jsx   # interactive map view
├── server/            # Express backend (port 5171)
│   └── services/
│       ├── adapters/  # one file per weather source
│       ├── aggregator.js
│       └── consensus.js
├── webapp/            # ZeliCast UI variant embedded in the ZeliAI web app
├── run.ps1            # Windows one-file launcher
└── run.sh             # macOS/Linux launcher
```

Adding a weather source is one file: drop an adapter into `server/services/adapters/` that returns the common forecast shape, and register it in `aggregator.js`.

> 🇰🇷 UI text is in Korean (the app was built for a Korean audience). i18n contributions are very welcome!

## 🤝 Contributing

Issues and PRs are welcome — new weather source adapters, UI polish, i18n, anything. If something doesn't run on your machine, [open an issue](../../issues) and we'll figure it out together.

## 📄 License

Apache-2.0
