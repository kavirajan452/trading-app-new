from dataclasses import dataclass
from app.groww.client import GrowwClient


@dataclass
class Instrument:
    symbol: str
    name: str
    exchange: str
    segment: str
    isin: str
    trading_symbol: str


class InstrumentsClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def get_instruments(self, exchange: str = "NSE") -> list[Instrument]:
        """
        Fetch list of instruments for an exchange.
        GET /v1/instruments?exchange={exchange}
        """
        data = await self.client.get("/v1/instruments", params={"exchange": exchange})
        instruments_raw = data if isinstance(data, list) else data.get("instruments", [])
        return [
            Instrument(
                symbol=item.get("symbol", ""),
                name=item.get("name", ""),
                exchange=item.get("exchange", exchange),
                segment=item.get("segment", ""),
                isin=item.get("isin", ""),
                trading_symbol=item.get("trading_symbol", item.get("tradingSymbol", "")),
            )
            for item in instruments_raw
        ]
