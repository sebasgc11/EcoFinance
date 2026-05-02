import logging
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings

logger = logging.getLogger(__name__)


def _create_engine(database_url: str):
    if database_url == settings.memory_sqlite_url:
        return create_engine(
            database_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    if database_url.startswith("sqlite"):
        sqlite_path = Path(settings.SQLITE_PATH).resolve()
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        return create_engine(
            database_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False},
        )

    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={
            "charset": "utf8mb4",
            "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        },
    )


engine = _create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
active_database_url = settings.database_url


def get_engine():
    return engine


def ensure_database_connection():
    global engine, active_database_url

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return
    except OperationalError:
        if not settings.DB_FALLBACK_TO_SQLITE or active_database_url.startswith("sqlite"):
            raise

    sqlite_url = settings.sqlite_url
    logger.warning(
        "No se pudo conectar a %s. Se usara SQLite en %s",
        settings.database_url,
        sqlite_url,
    )
    try:
        fallback_engine = _create_engine(sqlite_url)
        with fallback_engine.begin() as connection:
            connection.execute(text("SELECT 1"))
            connection.execute(
                text("CREATE TABLE IF NOT EXISTS __healthcheck (id INTEGER)")
            )
            connection.execute(text("DROP TABLE __healthcheck"))
    except OperationalError:
        memory_sqlite_url = settings.memory_sqlite_url
        logger.warning(
            "SQLite en disco no esta disponible. Se usara SQLite en memoria compartida."
        )
        fallback_engine = _create_engine(memory_sqlite_url)
        with fallback_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        sqlite_url = memory_sqlite_url

    engine = fallback_engine
    SessionLocal.configure(bind=engine)
    active_database_url = sqlite_url

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
