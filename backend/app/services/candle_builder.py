from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

Timeframe = Literal["1m", "5m"]

TIMEFRAME_SECONDS: dict[str, int] = {
    "1m": 60,
    "5m": 300,
}


@dataclass
class TickData:
    price: float
    volume: float
    timestamp: datetime


@dataclass
class Candle:
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: datetime


class CandleBuilder:
    def build_candles(self, ticks: list[TickData], timeframe: Timeframe) -> list[Candle]:
        """
        Convert a list of ticks into OHLCV candles for the given timeframe.

        Ticks are grouped into fixed-width time buckets determined by *timeframe*.
        The bucket timestamp is the floor of the tick's UTC epoch divided by
        the bucket size in seconds.
        """
        bucket_seconds = TIMEFRAME_SECONDS.get(timeframe)
        if bucket_seconds is None:
            raise ValueError(f"Unsupported timeframe: {timeframe}. Use one of {list(TIMEFRAME_SECONDS)}")

        buckets: dict[datetime, list[TickData]] = {}
        for tick in ticks:
            ts = tick.timestamp
            if ts.tzinfo is not None:
                epoch = int(ts.timestamp())
            else:
                epoch = int(ts.replace(tzinfo=timezone.utc).timestamp())
            bucket_epoch = (epoch // bucket_seconds) * bucket_seconds
            bucket_ts = datetime.fromtimestamp(bucket_epoch, tz=timezone.utc)
            buckets.setdefault(bucket_ts, []).append(tick)

        candles: list[Candle] = []
        for bucket_ts in sorted(buckets):
            group = buckets[bucket_ts]
            prices = [t.price for t in group]
            candles.append(
                Candle(
                    open=prices[0],
                    high=max(prices),
                    low=min(prices),
                    close=prices[-1],
                    volume=sum(t.volume for t in group),
                    timestamp=bucket_ts,
                )
            )
        return candles
