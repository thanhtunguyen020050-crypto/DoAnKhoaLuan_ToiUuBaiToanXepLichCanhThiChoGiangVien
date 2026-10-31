"""Cấu hình tập trung của ứng dụng FastAPI."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")
_DEVELOPMENT_AUTH_SECRET = "huit-gacthi-secret-key-2026-very-secure-random-bytes-512"


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
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    production = app_env in {"production", "prod"}
    default_origins = "" if production else "http://127.0.0.1:5173,http://localhost:5173"
    origins_value = os.getenv("CORS_ORIGINS", default_origins)
    origins = tuple(
        origin.strip()
        for origin in origins_value.split(",")
        if origin.strip()
    )
    if production and (not origins or "*" in origins):
        raise RuntimeError("Production requires explicit CORS_ORIGINS; wildcard origins are not allowed.")

    auth_secret_key = os.getenv("AUTH_SECRET_KEY", "").strip()
    if production and (len(auth_secret_key) < 32 or auth_secret_key == _DEVELOPMENT_AUTH_SECRET):
        raise RuntimeError("Production requires a unique AUTH_SECRET_KEY of at least 32 characters.")
    if not auth_secret_key:
        auth_secret_key = _DEVELOPMENT_AUTH_SECRET

    sql_server = os.getenv("SQL_SERVER", "").strip()
    sql_database = os.getenv("SQL_DATABASE", "").strip()
    if production and (not sql_server or not sql_database):
        raise RuntimeError("Production requires explicit SQL_SERVER and SQL_DATABASE settings.")

    trusted_connection = _as_bool(os.getenv("SQL_TRUSTED_CONNECTION"), not production)
    sql_user = os.getenv("SQL_USER", "")
    sql_password = os.getenv("SQL_PASSWORD", "")
    if production and not trusted_connection and (not sql_user or not sql_password):
        raise RuntimeError("Set SQL_USER and SQL_PASSWORD when SQL_TRUSTED_CONNECTION is disabled.")

    return Settings(
        app_title=os.getenv("API_TITLE", "API Hệ thống xếp lịch gác thi"),
        app_version=os.getenv("API_VERSION", "2.0"),
        api_host=os.getenv("API_HOST", "0.0.0.0" if production else "127.0.0.1"),
        api_port=int(os.getenv("PORT", os.getenv("API_PORT", "8000"))),
        cors_origins=origins or ("*",),
        sql_server=sql_server or r"LAPTOP-I45QUNGD",
        sql_database=sql_database or "DB_XepLichCoiThi_Final",
        sql_driver=os.getenv("SQL_DRIVER", "ODBC Driver 17 for SQL Server"),
        sql_trusted_connection=trusted_connection,
        sql_user=sql_user,
        sql_password=sql_password,
        auth_secret_key=auth_secret_key,
        auth_token_ttl_seconds=int(os.getenv("AUTH_TOKEN_TTL_SECONDS", str(7 * 24 * 3600))),
    )


settings = get_settings()
