import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database.models import Tick, Stock
from app.groww.client import GrowwClient
from app.groww.live_data import LiveDataClient
from app.config.settings import settings

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, db: Session, groww_client: GrowwClient):
        self.db = db
        self.groww_client = groww_client
        self.live_data = LiveDataClient(groww_client)
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start polling loop every MARKET_DATA_POLL_INTERVAL seconds."""
        self._running = True
        logger.info("MarketDataService started")
        while self._running:
            try:
                symbols = self._get_active_symbols()
                if symbols:
                    await self.poll_quotes(symbols)
            except Exception as exc:
                logger.error("Error polling quotes: %s", exc)
            await asyncio.sleep(settings.MARKET_DATA_POLL_INTERVAL)

    async def poll_quotes(self, symbols: list[str]) -> None:
        """Fetch live quotes for all symbols and persist ticks."""
        quotes = await self.live_data.get_quotes(symbols)
        for quote in quotes:
            await self.store_tick(
                symbol=quote.symbol,
                price=quote.ltp,
                volume=quote.volume,
                timestamp=datetime.now(timezone.utc),
            )

    async def store_tick(
        self,
        symbol: str,
        price: float,
        volume: float,
        timestamp: datetime,
    ) -> None:
        """Persist a single tick to the database."""
        tick = Tick(
            stock_symbol=symbol,
            price=price,
            volume=volume,
            timestamp=timestamp,
        )
        self.db.add(tick)
        try:
            self.db.commit()
        except Exception as exc:
            self.db.rollback()
            logger.error("Failed to store tick for %s: %s", symbol, exc)

    async def stop(self) -> None:
        """Stop the polling loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("MarketDataService stopped")

    def _get_active_symbols(self) -> list[str]:
        rows = self.db.query(Stock.symbol).filter(Stock.is_active.is_(True)).all()
        return [r.symbol for r in rows]
