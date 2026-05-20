from __future__ import annotations

import os


def build_async_database_url_from_env() -> str:
    raw_database_url = str(os.environ.get("DATABASE_URL") or "").strip()
    if raw_database_url:
        return raw_database_url

    postgres_server = str(os.environ.get("POSTGRES_SERVER") or "db").strip() or "db"
    postgres_user = str(os.environ.get("POSTGRES_USER") or "postgres").strip() or "postgres"
    postgres_password = str(os.environ.get("POSTGRES_PASSWORD") or "postgres").strip()
    postgres_db = str(os.environ.get("POSTGRES_DB") or "vulhunter").strip() or "vulhunter"

    return (
        f"postgresql+asyncpg://{postgres_user}:{postgres_password}"
        f"@{postgres_server}/{postgres_db}"
    )
