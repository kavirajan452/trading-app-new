from dataclasses import dataclass
from app.groww.client import GrowwClient
from app.groww.exceptions import GrowwInstrumentNotFoundException


@dataclass
class Quote:
    symbol: str
    ltp: float
    open: float
    high: float
    low: float
    close: float
    volume: float
    change: float
    change_percent: float


class LiveDataClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def get_quote(self, symbol: str) -> Quote:
        """
        Fetch live quote for a symbol.
        GET /v1/live/quotes?search_id={symbol}
        """
        try:
            data = await self.client.get("/v1/live/quotes", params={"search_id": symbol})
        except Exception as exc:
            if hasattr(exc, "status_code") and exc.status_code == 404:  # type: ignore[union-attr]
                raise GrowwInstrumentNotFoundException(symbol) from exc
            raise

        # Normalise response fields (Groww may return camelCase or snake_case)
        return Quote(
            symbol=data.get("symbol", symbol),
            ltp=float(data.get("ltp", data.get("lastTradedPrice", 0))),
            open=float(data.get("open", 0)),
            high=float(data.get("high", 0)),
            low=float(data.get("low", 0)),
            close=float(data.get("close", data.get("previousClose", 0))),
            volume=float(data.get("volume", 0)),
            change=float(data.get("change", data.get("netChange", 0))),
            change_percent=float(
                data.get("changePercent", data.get("percentChange", 0))
            ),
        )

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        """Fetch live quotes for multiple symbols sequentially."""
        quotes: list[Quote] = []
        for symbol in symbols:
            try:
                quote = await self.get_quote(symbol)
                quotes.append(quote)
            except Exception:
                pass
        return quotes
