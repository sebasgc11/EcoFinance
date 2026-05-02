import os
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_NAME: str = os.getenv("DB_NAME", "ecofinance")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    SQLITE_PATH: str = os.getenv(
        "SQLITE_PATH", str(BASE_DIR / ".data" / "ecofinance.sqlite3")
    )
    DB_FALLBACK_TO_SQLITE: bool = (
        os.getenv("DB_FALLBACK_TO_SQLITE", "true").lower() == "true"
    )
    APP_SECRET: str = os.getenv("APP_SECRET", "ecofinance-secret-key")
    ACCESS_TOKEN_EXPIRE_SECONDS: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "86400")
    )
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@ecofinance.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin123ñ!")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Administrador General")
    GOOGLE_WEB_CLIENT_ID: str = os.getenv("GOOGLE_WEB_CLIENT_ID", "")
    GOOGLE_IOS_CLIENT_ID: str = os.getenv("GOOGLE_IOS_CLIENT_ID", "")
    GOOGLE_ANDROID_CLIENT_ID: str = os.getenv("GOOGLE_ANDROID_CLIENT_ID", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    PASSWORD_RESET_EXPIRE_MINUTES: int = int(
        os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "10")
    )

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        encoded_password = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+pymysql://{self.DB_USER}:{encoded_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def sqlite_url(self) -> str:
        return Path(self.SQLITE_PATH).resolve().as_uri().replace("file:", "sqlite:")

    @property
    def memory_sqlite_url(self) -> str:
        return "sqlite://"

settings = Settings()
