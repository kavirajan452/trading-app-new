from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from app.config.settings import settings
from app.database.models import Base

_engine: Engine | None = None
_SessionLocal = None


def _ensure_engine() -> Engine:
    """Lazily create the SQLAlchemy engine and session factory on first use."""
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def init_db() -> None:
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=_ensure_engine())


def get_db():
    """Dependency that provides a database session."""
    _ensure_engine()
    db: Session = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
