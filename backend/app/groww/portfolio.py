from dataclasses import dataclass
from typing import Any
from app.groww.client import GrowwClient


@dataclass
class Holding:
    symbol: str
    exchange: str
    quantity: int
    average_price: float
    current_price: float
    pnl: float


@dataclass
class Position:
    symbol: str
    exchange: str
    quantity: int
    buy_price: float
    current_price: float
    pnl: float
    product: str


class PortfolioClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def get_holdings(self) -> list[Holding]:
        """
        Fetch portfolio holdings.
        GET /v1/portfolio/holdings
        """
        data = await self.client.get("/v1/portfolio/holdings")
        holdings_raw = data if isinstance(data, list) else data.get("holdings", [])
        return [self._parse_holding(h) for h in holdings_raw]

    async def get_positions(self) -> list[Position]:
        """
        Fetch open positions.
        GET /v1/portfolio/positions
        """
        data = await self.client.get("/v1/portfolio/positions")
        positions_raw = data if isinstance(data, list) else data.get("positions", [])
        return [self._parse_position(p) for p in positions_raw]

    def _parse_holding(self, data: dict[str, Any]) -> Holding:
        return Holding(
            symbol=data.get("symbol", data.get("tradingSymbol", "")),
            exchange=data.get("exchange", ""),
            quantity=int(data.get("quantity", 0)),
            average_price=float(data.get("averagePrice", data.get("average_price", 0))),
            current_price=float(data.get("currentPrice", data.get("ltp", 0))),
            pnl=float(data.get("pnl", 0)),
        )

    def _parse_position(self, data: dict[str, Any]) -> Position:
        return Position(
            symbol=data.get("symbol", data.get("tradingSymbol", "")),
            exchange=data.get("exchange", ""),
            quantity=int(data.get("quantity", 0)),
            buy_price=float(data.get("buyPrice", data.get("average_price", 0))),
            current_price=float(data.get("currentPrice", data.get("ltp", 0))),
            pnl=float(data.get("pnl", 0)),
            product=data.get("product", ""),
        )
