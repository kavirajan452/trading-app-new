from datetime import datetime, timezone, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import Stock, Signal, Prediction, PredictionOutcome, OutcomeResult
from app.groww.client import GrowwClient
from app.groww.live_data import LiveDataClient
from app.groww.historical_data import HistoricalDataClient
from app.groww.exceptions import GrowwAPIException

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class StockIn(BaseModel):
    symbol: str
    name: str
    exchange: str = "NSE"


class StockOut(BaseModel):
    symbol: str
    name: str
    exchange: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SignalOut(BaseModel):
    id: int
    stock_symbol: str
    timestamp: datetime
    rule_score: float
    priority: str
    features: dict[str, Any] | None

    class Config:
        from_attributes = True


class PredictionOut(BaseModel):
    id: int
    stock_symbol: str
    timestamp: datetime
    entry_price: float
    rule_score: float
    ai_score: float | None
    ai_reason: str | None
    status: str

    class Config:
        from_attributes = True


# ── Dependency ───────────────────────────────────────────────────────────────

def get_groww_client() -> GrowwClient:
    return GrowwClient()


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
