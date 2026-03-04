from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/tradingdb"
    REDIS_URL: str = "redis://localhost:6379"
    GROWW_API_KEY: str = ""
    GROWW_ACCESS_TOKEN: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "gpt-oss-20b"
    MARKET_DATA_POLL_INTERVAL: int = 3
    SCANNER_INTERVAL: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
