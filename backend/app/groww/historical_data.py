from dataclasses import dataclass
from datetime import datetime, timezone
from app.groww.client import GrowwClient


@dataclass
class OHLCVCandle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class HistoricalDataClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> list[OHLCVCandle]:
        """
        Fetch historical OHLCV candles.
        GET /v1/historical/ohlc?search_id={symbol}&timeframe={timeframe}&start={start}&end={end}
        """
        params = {
            "search_id": symbol,
            "timeframe": timeframe,
            "start": start.strftime("%Y-%m-%d"),
            "end": end.strftime("%Y-%m-%d"),
        }
        data = await self.client.get("/v1/historical/ohlc", params=params)
        candles_raw = data if isinstance(data, list) else data.get("candles", [])
        candles: list[OHLCVCandle] = []
        for item in candles_raw:
            ts = item.get("timestamp", item.get("date", ""))
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            elif isinstance(ts, (int, float)):
                ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
            candles.append(
                OHLCVCandle(
                    timestamp=ts,
                    open=float(item.get("open", 0)),
                    high=float(item.get("high", 0)),
                    low=float(item.get("low", 0)),
                    close=float(item.get("close", 0)),
                    volume=float(item.get("volume", 0)),
                )
            )
        return candles
