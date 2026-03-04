from typing import Any
import httpx
from app.config.settings import settings
from app.groww.exceptions import GrowwAPIException, GrowwAuthException, GrowwRateLimitException


class GrowwClient:
    BASE_URL = "https://api.groww.in"
    _TOKEN_PATH = "/v1/api/login/trading/access_token"

    def __init__(self, access_token: str | None = None):
        self.access_token = access_token or settings.GROWW_ACCESS_TOKEN
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=10.0,
        )

    @classmethod
    def get_access_token(cls, api_key: str, secret: str) -> str:
        """Exchange an API key and secret for a short-lived access token."""
        with httpx.Client(base_url=cls.BASE_URL, timeout=10.0) as client:
            response = client.post(
                cls._TOKEN_PATH,
                json={"api_key": api_key, "secret": secret},
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
        if response.status_code == 401:
            try:
                body = response.json()
                message = body.get("message", "Invalid API key or secret")
            except Exception:
                message = "Invalid API key or secret"
            raise GrowwAuthException(message)
        if response.status_code >= 400:
            try:
                body = response.json()
                error_code = body.get("errorCode", "UNKNOWN")
                message = body.get("message", response.text)
            except Exception:
                error_code = "UNKNOWN"
                message = response.text
            raise GrowwAPIException(
                status_code=response.status_code,
                error_code=error_code,
                message=message,
            )
        return response.json()["access_token"]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        response = await self._client.get(path, headers=self._headers(), params=params)
        return self._handle_response(response)

    async def post(self, path: str, data: dict[str, Any] | None = None) -> Any:
        response = await self._client.post(path, headers=self._headers(), json=data)
        return self._handle_response(response)

    async def delete(self, path: str) -> Any:
        response = await self._client.delete(path, headers=self._headers())
        return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> Any:
        if response.status_code == 401:
            raise GrowwAuthException("Unauthorized: Invalid or expired access token")
        if response.status_code == 429:
            raise GrowwRateLimitException("Rate limit exceeded")
        if response.status_code >= 400:
            try:
                body = response.json()
                error_code = body.get("errorCode", "UNKNOWN")
                message = body.get("message", response.text)
            except Exception:
                error_code = "UNKNOWN"
                message = response.text
            raise GrowwAPIException(
                status_code=response.status_code,
                error_code=error_code,
                message=message,
            )
        return response.json()

    async def aclose(self) -> None:
        await self._client.aclose()
