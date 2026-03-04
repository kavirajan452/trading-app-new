from dataclasses import dataclass
from typing import Any
from app.groww.client import GrowwClient


@dataclass
class UserProfile:
    client_id: str
    name: str
    email: str
    mobile: str
    pan: str
    is_active: bool


class UserClient:
    def __init__(self, client: GrowwClient):
        self.client = client

    async def get_profile(self) -> UserProfile:
        """
        Fetch authenticated user's profile.
        GET /v1/user/profile
        """
        data = await self.client.get("/v1/user/profile")
        return self._parse(data)

    def _parse(self, data: dict[str, Any]) -> UserProfile:
        return UserProfile(
            client_id=data.get("clientId", data.get("client_id", "")),
            name=data.get("name", data.get("clientName", data.get("client_name", ""))),
            email=data.get("email", ""),
            mobile=data.get("mobile", data.get("phone", "")),
            pan=data.get("pan", data.get("PAN", "")),
            is_active=bool(data.get("isActive", data.get("is_active", True))),
        )
