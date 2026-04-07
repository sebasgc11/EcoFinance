from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={
        "charset": "utf8mb4",
        "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
