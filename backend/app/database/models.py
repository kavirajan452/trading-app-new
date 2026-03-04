from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Enum as SAEnum,
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


class Stock(Base):
    __tablename__ = "stocks"

    symbol = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    exchange = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Tick(Base):
    __tablename__ = "ticks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String, ForeignKey("stocks.symbol"), nullable=False, index=True)
    price = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)


class Candle(Base):
    __tablename__ = "candles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String, ForeignKey("stocks.symbol"), nullable=False, index=True)
    timeframe = Column(String, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String, ForeignKey("stocks.symbol"), nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    rule_score = Column(Float, nullable=False)
    priority = Column(String, nullable=False)
    features = Column(JSON, nullable=True)


class PredictionStatus(str, enum.Enum):
    PENDING = "PENDING"
    EVALUATED = "EVALUATED"
    EXPIRED = "EXPIRED"


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String, ForeignKey("stocks.symbol"), nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    entry_price = Column(Float, nullable=False)
    rule_score = Column(Float, nullable=False)
    ai_score = Column(Float, nullable=True)
    ai_reason = Column(String, nullable=True)
    features = Column(JSON, nullable=True)
    status = Column(SAEnum(PredictionStatus), default=PredictionStatus.PENDING, nullable=False)
    outcomes = relationship("PredictionOutcome", back_populates="prediction")


class OutcomeResult(str, enum.Enum):
    WIN = "WIN"
    LOSS = "LOSS"
    NEUTRAL = "NEUTRAL"


class PredictionOutcome(Base):
    __tablename__ = "prediction_outcomes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False, index=True)
    evaluated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    timeframe = Column(String, nullable=False)
    exit_price = Column(Float, nullable=False)
    mfe = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    result = Column(SAEnum(OutcomeResult), nullable=False)
    prediction = relationship("Prediction", back_populates="outcomes")
