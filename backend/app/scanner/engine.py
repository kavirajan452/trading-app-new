import math
import statistics
from dataclasses import dataclass
from typing import Any
from app.services.candle_builder import Candle


@dataclass
class ScanResult:
    symbol: str
    total_score: float
    priority: str
    breakdown: dict[str, float]


def _ema(values: list[float], period: int) -> list[float]:
    """Calculate Exponential Moving Average."""
    if len(values) < period:
        return []
    k = 2 / (period + 1)
    ema_values: list[float] = [sum(values[:period]) / period]
    for price in values[period:]:
        ema_values.append(price * k + ema_values[-1] * (1 - k))
    return ema_values


class ScannerEngine:
    def volume_expansion_score(self, candles: list[Candle]) -> float:
        """Score 0-20: current volume > average volume * 1.5."""
        if len(candles) < 2:
            return 0.0
        avg_volume = statistics.mean(c.volume for c in candles[:-1])
        if avg_volume == 0:
            return 0.0
        ratio = candles[-1].volume / avg_volume
        if ratio >= 1.5:
            return min(20.0, 10.0 + (ratio - 1.5) * 10)
        return max(0.0, ratio * 10 - 5)

    def vwap_distance_score(self, candles: list[Candle], ltp: float) -> float:
        """Score 0-20: distance from VWAP as percentage."""
        total_volume = sum(c.volume for c in candles)
        if total_volume == 0:
            return 0.0
        vwap = sum(((c.high + c.low + c.close) / 3) * c.volume for c in candles) / total_volume
        if vwap == 0:
            return 0.0
        distance_pct = abs((ltp - vwap) / vwap) * 100
        # Reward proximity to VWAP (within 0.5%) with high score
        if distance_pct <= 0.5:
            return 20.0
        if distance_pct <= 1.0:
            return 15.0
        if distance_pct <= 2.0:
            return 10.0
        return max(0.0, 10.0 - distance_pct)

    def ema_alignment_score(self, candles: list[Candle]) -> float:
        """Score 0-20: EMA9 > EMA20 > EMA50 (bullish alignment)."""
        closes = [c.close for c in candles]
        ema9 = _ema(closes, 9)
        ema20 = _ema(closes, 20)
        ema50 = _ema(closes, 50)
        if not ema9 or not ema20 or not ema50:
            return 0.0
        if ema9[-1] > ema20[-1] > ema50[-1]:
            return 20.0
        if ema9[-1] > ema20[-1]:
            return 12.0
        if ema9[-1] > ema50[-1]:
            return 6.0
        return 0.0

    def price_proximity_score(self, day_high: float, day_low: float, ltp: float) -> float:
        """Score 0-20: proximity to day high (bullish breakout potential)."""
        day_range = day_high - day_low
        if day_range == 0:
            return 0.0
        proximity_to_high = (ltp - day_low) / day_range
        return round(proximity_to_high * 20, 2)

    def volatility_compression_score(self, candles: list[Candle]) -> float:
        """Score 0-20: narrow range candles before expansion indicate compression."""
        if len(candles) < 5:
            return 0.0
        recent = candles[-5:]
        ranges = [(c.high - c.low) for c in recent]
        avg_range = statistics.mean(ranges)
        all_ranges = [(c.high - c.low) for c in candles]
        overall_avg = statistics.mean(all_ranges)
        if overall_avg == 0:
            return 0.0
        compression_ratio = avg_range / overall_avg
        if compression_ratio <= 0.5:
            return 20.0
        if compression_ratio <= 0.7:
            return 14.0
        if compression_ratio <= 0.9:
            return 8.0
        return 0.0

    def scan_symbol(
        self,
        symbol: str,
        candles: list[Candle],
        ltp: float,
        day_high: float,
        day_low: float,
    ) -> ScanResult:
        """
        Run all scoring rules and return a ScanResult with total score 0-100 and priority.

        Priority: HIGH >= 75 | MEDIUM >= 60 | LOW < 60
        """
        breakdown: dict[str, float] = {
            "volume_expansion": self.volume_expansion_score(candles),
            "vwap_distance": self.vwap_distance_score(candles, ltp),
            "ema_alignment": self.ema_alignment_score(candles),
            "price_proximity": self.price_proximity_score(day_high, day_low, ltp),
            "volatility_compression": self.volatility_compression_score(candles),
        }
        total_score = min(100.0, sum(breakdown.values()))

        if total_score >= 75:
            priority = "HIGH"
        elif total_score >= 60:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        return ScanResult(
            symbol=symbol,
            total_score=round(total_score, 2),
            priority=priority,
            breakdown=breakdown,
        )
