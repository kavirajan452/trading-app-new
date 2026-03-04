# Trading Analytics Platform — Architecture Overview

## High-Level Design

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 14)                     │
│  /dashboard  /analytics  /stocks/[symbol]                        │
│  REST calls → http://localhost:8000   WebSocket → ws://…/ws      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼─────────────────────────────────────┐
│                       Backend (FastAPI)                           │
│                                                                   │
│  /health   /ws   /api/*                                          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ MarketData   │  │   Scanner    │  │   AI Scorer (Groq)   │   │
│  │ Service      │  │   Engine     │  │   groq_scorer.py     │   │
│  │ (poll 3 s)   │  │ (0-100 score)│  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐   │
│  │                   PostgreSQL (SQLAlchemy ORM)              │   │
│  │  stocks | ticks | candles | signals | predictions |       │   │
│  │  prediction_outcomes                                       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │               Groww API Client (httpx)                   │    │
│  │  live_data | historical_data | instruments | orders |    │    │
│  │  portfolio                                               │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### Backend (`backend/`)

| Module | Responsibility |
|--------|---------------|
| `main.py` | FastAPI app, CORS, `/health`, `/ws` WebSocket endpoint |
| `app/api/routes.py` | All REST endpoints (`/api/stocks`, `/api/signals`, `/api/predictions`, `/api/analytics`, `/api/live/{symbol}`, `/api/historical/{symbol}`) |
| `app/config/settings.py` | Pydantic `BaseSettings` — reads `.env` file |
| `app/database/models.py` | SQLAlchemy ORM models: `Stock`, `Tick`, `Candle`, `Signal`, `Prediction`, `PredictionOutcome` |
| `app/database/session.py` | DB engine, session factory, `get_db` dependency |
| `app/groww/client.py` | Async `httpx` client with auth headers and error handling |
| `app/groww/live_data.py` | `GET /v1/live/quotes` — live LTP, volume, change |
| `app/groww/historical_data.py` | `GET /v1/historical/ohlc` — OHLCV candles |
| `app/groww/instruments.py` | `GET /v1/instruments` — instrument master |
| `app/groww/orders.py` | Order lifecycle: place, list, get, cancel |
| `app/groww/portfolio.py` | Holdings and positions |
| `app/groww/exceptions.py` | Typed exceptions: `GrowwAPIException`, `GrowwAuthException`, `GrowwRateLimitException`, `GrowwInstrumentNotFoundException` |
| `app/market_data/service.py` | Polls active symbols every 3 s, stores ticks to DB |
| `app/services/candle_builder.py` | Aggregates ticks into 1 m / 5 m OHLCV candles |
| `app/scanner/engine.py` | 5-rule scoring engine (0-100): volume expansion, VWAP distance, EMA alignment, price proximity, volatility compression |
| `app/ai/groq_scorer.py` | Sends signal features to Groq Chat API, returns `{score, confidence, reason}` |
| `app/predictions/engine.py` | Persists predictions, retrieves pending ones |
| `app/services/outcome_evaluator.py` | Evaluates predictions at 5 m / 15 m / 30 m / EOD; WIN > +0.5 %, LOSS < −0.5 % |

### Frontend (`frontend/dashboard/`)

| File | Responsibility |
|------|---------------|
| `pages/index.tsx` | Redirects to `/dashboard` |
| `pages/dashboard.tsx` | Live signals table + HIGH-priority signal cards; auto-refreshes every 10 s; real-time via WebSocket |
| `pages/analytics.tsx` | Win/loss/neutral rates, AI correlation bar, prediction history table |
| `pages/stocks/[symbol].tsx` | Per-symbol page: live price, OHLCV table, signal cards |
| `components/SignalCard.tsx` | Signal card with priority colour coding and feature breakdown |
| `components/PriceDisplay.tsx` | LTP with change / change% formatted in INR |
| `components/ScoreBar.tsx` | Colour-coded horizontal progress bar (green ≥ 75, yellow ≥ 60, red < 60) |
| `services/api.ts` | Type-safe `fetch()` wrappers for every backend endpoint |
| `services/websocket.ts` | Auto-reconnecting WebSocket client with message subscription |

## Data Flow

```
Groww API
   │
   ▼  (every 3 s)
MarketDataService.poll_quotes()
   │  store_tick()
   ▼
ticks table
   │
   ▼  CandleBuilder.build_candles()
candles table
   │
   ▼  ScannerEngine.scan_symbol()
signals table  ──────────────────────────────► WebSocket /ws broadcast
   │
   ▼  GroqScorer.analyze_signal()
predictions table
   │
   ▼  OutcomeEvaluator.evaluate_prediction()  (at 5m/15m/30m/EOD)
prediction_outcomes table
```

## Running Locally

### Prerequisites
- Python 3.12+, PostgreSQL, Redis
- Node.js 20+

### Backend
```bash
cd backend
pip install -r ../requirements.txt
cp ../.env.example ../.env   # fill in credentials
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend/dashboard
npm install
npm run dev   # http://localhost:3000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/tradingdb` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `GROWW_API_KEY` | — | Groww API key |
| `GROWW_ACCESS_TOKEN` | — | Groww OAuth access token |
| `GROQ_API_KEY` | — | Groq API key for AI scoring |
| `GROQ_MODEL` | `gpt-oss-20b` | Groq model name |
| `MARKET_DATA_POLL_INTERVAL` | `3` | Seconds between quote polls |
| `SCANNER_INTERVAL` | `60` | Seconds between scanner runs |
