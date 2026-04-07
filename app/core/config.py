import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_NAME: str = os.getenv("DB_NAME", "ecofinance")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
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

    @property
    def database_url(self) -> str:
        encoded_password = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+pymysql://{self.DB_USER}:{encoded_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

settings = Settings()
