"""Cấu hình tập trung của ứng dụng FastAPI."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y"}


@dataclass(frozen=True)
class Settings:
    app_title: str
    app_version: str
    api_host: str
    api_port: int
    cors_origins: tuple[str, ...]
    sql_server: str
    sql_database: str
    sql_driver: str
    sql_trusted_connection: bool
    sql_user: str
    sql_password: str
    auth_secret_key: str
    auth_token_ttl_seconds: int


def get_settings() -> Settings:
    origins = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    )
    return Settings(
        app_title=os.getenv("API_TITLE", "API Hệ thống xếp lịch gác thi"),
        app_version=os.getenv("API_VERSION", "2.0"),
        api_host=os.getenv("API_HOST", "127.0.0.1"),
        api_port=int(os.getenv("API_PORT", "8000")),
        cors_origins=origins or ("*",),
        sql_server=os.getenv("SQL_SERVER", r"LAPTOP-I45QUNGD"),
        sql_database=os.getenv("SQL_DATABASE", "DB_XepLichCoiThi_Final"),
        sql_driver=os.getenv("SQL_DRIVER", "ODBC Driver 17 for SQL Server"),
        sql_trusted_connection=_as_bool(os.getenv("SQL_TRUSTED_CONNECTION"), True),
        sql_user=os.getenv("SQL_USER", ""),
        sql_password=os.getenv("SQL_PASSWORD", ""),
        auth_secret_key=os.getenv(
            "AUTH_SECRET_KEY",
            "huit-gacthi-secret-key-2026-very-secure-random-bytes-512",
        ),
        auth_token_ttl_seconds=int(os.getenv("AUTH_TOKEN_TTL_SECONDS", str(7 * 24 * 3600))),
    )


settings = get_settings()
