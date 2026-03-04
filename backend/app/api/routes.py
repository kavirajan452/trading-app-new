import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.orm import Session
import redis as redis_lib
from app.database.session import get_db
from app.database.models import Stock, Signal, Prediction, PredictionOutcome, OutcomeResult, Tick
from app.groww.client import GrowwClient
from app.groww.live_data import LiveDataClient
from app.groww.historical_data import HistoricalDataClient
from app.groww.user import UserClient
from app.groww.exceptions import GrowwAPIException, GrowwAuthException
from app.config.settings import settings

logger = logging.getLogger(__name__)
_start_time = time.time()

router = APIRouter()

# Simple in-process cache for the derived access token (avoids a token request
# on every API call when key+secret auth is used).
_cached_token: str = ""
_token_fetched_at: datetime | None = None
_TOKEN_TTL = timedelta(hours=20)  # refresh well before typical 24-hour expiry


# ── Pydantic schemas ────────────────────────────────────────────────────────

class StockIn(BaseModel):
    symbol: str
    name: str
    exchange: str = "NSE"


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    symbol: str
    name: str
    exchange: str
    is_active: bool
    created_at: datetime


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_symbol: str
    timestamp: datetime
    rule_score: float
    priority: str
    features: dict[str, Any] | None


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_symbol: str
    timestamp: datetime
    entry_price: float
    rule_score: float
    ai_score: float | None
    ai_reason: str | None
    status: str


# ── Dependency ───────────────────────────────────────────────────────────────

def get_groww_client() -> GrowwClient:
    global _cached_token, _token_fetched_at
    token = settings.GROWW_ACCESS_TOKEN
    if not token and settings.GROWW_API_KEY and settings.GROWW_API_SECRET:
        now = datetime.now(timezone.utc)
        if not _cached_token or _token_fetched_at is None or now - _token_fetched_at >= _TOKEN_TTL:
            _cached_token = GrowwClient.get_access_token(
                api_key=settings.GROWW_API_KEY,
                secret=settings.GROWW_API_SECRET,
            )
            _token_fetched_at = now
        token = _cached_token
    return GrowwClient(access_token=token)


# ── Stocks ───────────────────────────────────────────────────────────────────

@router.get("/stocks", response_model=list[StockOut])
def list_stocks(db: Session = Depends(get_db)):
    return db.query(Stock).filter(Stock.is_active.is_(True)).all()


@router.post("/stocks", response_model=StockOut, status_code=201)
def add_stock(stock_in: StockIn, db: Session = Depends(get_db)):
    existing = db.get(Stock, stock_in.symbol)
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing
    stock = Stock(
        symbol=stock_in.symbol,
        name=stock_in.name,
        exchange=stock_in.exchange,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return stock


# ── Signals ──────────────────────────────────────────────────────────────────

@router.get("/signals", response_model=list[SignalOut])
def get_signals(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(Signal)
        .order_by(Signal.timestamp.desc())
        .limit(limit)
        .all()
    )


# ── Predictions ──────────────────────────────────────────────────────────────

@router.get("/predictions", response_model=list[PredictionOut])
def get_predictions(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(Prediction)
        .order_by(Prediction.timestamp.desc())
        .limit(limit)
        .all()
    )


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    outcomes = db.query(PredictionOutcome).all()
    total = len(outcomes)
    if total == 0:
        return {"win_rate": 0, "loss_rate": 0, "neutral_rate": 0, "total": 0}

    wins = sum(1 for o in outcomes if o.result == OutcomeResult.WIN)
    losses = sum(1 for o in outcomes if o.result == OutcomeResult.LOSS)
    neutrals = total - wins - losses

    # AI correlation: compare ai_score vs actual outcome
    predictions_with_ai = (
        db.query(Prediction)
        .filter(Prediction.ai_score.isnot(None))
        .all()
    )
    ai_correct = 0
    ai_total = 0
    for pred in predictions_with_ai:
        pred_outcomes = [o for o in pred.outcomes if o.timeframe == "5"]
        if pred_outcomes:
            ai_total += 1
            o = pred_outcomes[0]
            if pred.ai_score >= 60 and o.result == OutcomeResult.WIN:
                ai_correct += 1
            elif pred.ai_score < 60 and o.result != OutcomeResult.WIN:
                ai_correct += 1

    return {
        "total": total,
        "win_rate": round(wins / total * 100, 2),
        "loss_rate": round(losses / total * 100, 2),
        "neutral_rate": round(neutrals / total * 100, 2),
        "ai_correlation": round(ai_correct / ai_total * 100, 2) if ai_total else None,
    }


# ── Live quote ────────────────────────────────────────────────────────────────

@router.get("/live/{symbol}")
async def get_live_quote(
    symbol: str,
    client: GrowwClient = Depends(get_groww_client),
):
    live = LiveDataClient(client)
    try:
        quote = await live.get_quote(symbol)
        return quote.__dict__
    except GrowwAPIException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── Historical candles ────────────────────────────────────────────────────────

@router.get("/historical/{symbol}")
async def get_historical(
    symbol: str,
    timeframe: str = "1d",
    start: str | None = None,
    end: str | None = None,
    client: GrowwClient = Depends(get_groww_client),
):
    hist = HistoricalDataClient(client)
    end_dt = datetime.now(timezone.utc) if end is None else datetime.fromisoformat(end)
    
    start_dt = (end_dt - timedelta(days=30)) if start is None else datetime.fromisoformat(start)
    try:
        candles = await hist.get_ohlcv(symbol, timeframe, start_dt, end_dt)
        return [c.__dict__ for c in candles]
    except GrowwAPIException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── System status ─────────────────────────────────────────────────────────────

@router.get("/status")
async def get_system_status(db: Session = Depends(get_db)):
    """Return connection status for all system components with debug details."""
    # Database
    db_status = "connected"
    db_error: str | None = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)
        logger.error("DB health check failed: %s", exc)

    # Redis
    redis_status = "unknown"
    redis_error: str | None = None
    try:
        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        try:
            r.ping()
            redis_status = "connected"
        finally:
            r.close()
    except Exception as exc:
        redis_status = "error"
        redis_error = str(exc)
        logger.warning("Redis health check failed: %s", exc)

    # Groww API auth
    auth_status = "not_required"
    auth_error: str | None = None
    if settings.GROWW_ACCESS_TOKEN or (settings.GROWW_API_KEY and settings.GROWW_API_SECRET):
        try:
            client = get_groww_client()
            user_client = UserClient(client)
            await user_client.get_profile()
            auth_status = "connected"
        except GrowwAuthException as exc:
            auth_status = "error"
            auth_error = f"[{exc.error_code}] {exc.message}"
            logger.error("Groww auth check failed: %s", exc)
        except GrowwAPIException as exc:
            auth_status = "error"
            auth_error = f"[{exc.error_code}] HTTP {exc.status_code}: {exc.message}"
            logger.error("Groww API check failed: %s", exc)
        except Exception as exc:
            auth_status = "error"
            auth_error = str(exc)
            logger.error("Groww connection error: %s", exc)

    # Market data – check recency of latest tick
    market_data_status = "unknown"
    market_data_error: str | None = None
    last_fetch: str | None = None
    try:
        latest_tick = db.query(Tick).order_by(Tick.timestamp.desc()).first()
        if latest_tick:
            ts = latest_tick.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - ts).total_seconds()
            last_fetch = ts.isoformat()
            market_data_status = "live" if age < 60 else "stale"
    except Exception as exc:
        market_data_status = "error"
        market_data_error = str(exc)
        logger.error("Market data status check failed: %s", exc)

    # AI (Groq)
    ai_status = "configured" if settings.GROQ_API_KEY else "unchecked"

    uptime_seconds = int(time.time() - _start_time)

    return {
        "database": {"status": db_status, "error": db_error},
        "redis": {"status": redis_status, "error": redis_error},
        "auth": {"status": auth_status, "error": auth_error},
        "market_data": {"status": market_data_status, "error": market_data_error},
        "ai": {"status": ai_status, "error": None},
        "last_fetch": last_fetch,
        "uptime_seconds": uptime_seconds,
    }


# ── Groww user profile ────────────────────────────────────────────────────────

@router.get("/user")
async def get_user_profile(client: GrowwClient = Depends(get_groww_client)):
    """Fetch authenticated Groww user details."""
    user_client = UserClient(client)
    try:
        profile = await user_client.get_profile()
        return profile.__dict__
    except GrowwAPIException as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error_code": exc.error_code, "message": exc.message},
        ) from exc
