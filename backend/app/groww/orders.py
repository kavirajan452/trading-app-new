from dataclasses import dataclass
from typing import Any
from app.groww.client import GrowwClient


@dataclass
class Order:
    order_id: str
    symbol: str
    exchange: str
    transaction_type: str
    order_type: str
    quantity: int
    price: float
    status: str


class OrdersClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def place_order(self, payload: dict[str, Any]) -> Order:
        """
        Place a new order.
        POST /v1/orders
        """
        data = await self.client.post("/v1/orders", data=payload)
        return self._parse_order(data)

    async def list_orders(self) -> list[Order]:
        """
        List all orders.
        GET /v1/orders
        """
        data = await self.client.get("/v1/orders")
        orders_raw = data if isinstance(data, list) else data.get("orders", [])
        return [self._parse_order(o) for o in orders_raw]

    async def get_order(self, order_id: str) -> Order:
        """
        Get a specific order.
        GET /v1/orders/{order_id}
        """
        data = await self.client.get(f"/v1/orders/{order_id}")
        return self._parse_order(data)

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """
        Cancel an order.
        DELETE /v1/orders/{order_id}
        """
        return await self.client.delete(f"/v1/orders/{order_id}")

    def _parse_order(self, data: dict[str, Any]) -> Order:
        return Order(
            order_id=str(data.get("orderId", data.get("order_id", ""))),
            symbol=data.get("symbol", data.get("tradingSymbol", "")),
            exchange=data.get("exchange", ""),
            transaction_type=data.get("transactionType", data.get("transaction_type", "")),
            order_type=data.get("orderType", data.get("order_type", "")),
            quantity=int(data.get("quantity", 0)),
            price=float(data.get("price", 0)),
            status=data.get("status", ""),
        )
