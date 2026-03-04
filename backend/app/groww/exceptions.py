class GrowwAPIException(Exception):
    """Base exception for Groww API errors."""

    def __init__(self, status_code: int, error_code: str, message: str):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        super().__init__(f"[{status_code}] {error_code}: {message}")


class GrowwAuthException(GrowwAPIException):
    """Raised on authentication / authorization failures (HTTP 401/403)."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(status_code=401, error_code="AUTH_ERROR", message=message)


class GrowwRateLimitException(GrowwAPIException):
    """Raised when the Groww API rate limit is exceeded (HTTP 429)."""

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(status_code=429, error_code="RATE_LIMIT", message=message)


class GrowwInstrumentNotFoundException(GrowwAPIException):
    """Raised when a requested instrument is not found (HTTP 404)."""

    def __init__(self, symbol: str = ""):
        message = f"Instrument not found: {symbol}" if symbol else "Instrument not found"
        super().__init__(status_code=404, error_code="INSTRUMENT_NOT_FOUND", message=message)
