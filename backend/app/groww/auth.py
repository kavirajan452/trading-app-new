from app.config.settings import settings


def get_auth_headers(access_token: str | None = None) -> dict[str, str]:
    """Return authorization headers for Groww API requests."""
    token = access_token or settings.GROWW_ACCESS_TOKEN
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
