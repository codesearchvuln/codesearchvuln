#!/bin/sh
set -eu

echo "Starting VulHunter backend dev container..."

APP_ROOT="/app"
VENV_DIR="${APP_ROOT}/.venv"
SEED_VENV_DIR="/opt/backend-venv"
STAMP_FILE="${VENV_DIR}/.vulhunter-dev-lock.sha256"

ensure_seed_venv() {
    if [ -x "${VENV_DIR}/bin/python" ] && "${VENV_DIR}/bin/python" -V >/dev/null 2>&1; then
        return 0
    fi

    echo "Restoring seeded virtualenv into ${VENV_DIR}..."
    mkdir -p "${VENV_DIR}"
    find "${VENV_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "${SEED_VENV_DIR}/." "${VENV_DIR}/"
}

compute_lock_hash() {
    if [ ! -f "${APP_ROOT}/pyproject.toml" ] || [ ! -f "${APP_ROOT}/uv.lock" ]; then
        return 1
    fi

    sha256sum "${APP_ROOT}/pyproject.toml" "${APP_ROOT}/uv.lock" | sha256sum | awk '{print $1}'
}

sync_python_env_if_needed() {
    ensure_seed_venv

    export VIRTUAL_ENV="${VENV_DIR}"
    export PATH="${VENV_DIR}/bin:${PATH}"

    current_hash=""
    previous_hash=""
    if current_hash="$(compute_lock_hash 2>/dev/null)"; then
        previous_hash="$(cat "${STAMP_FILE}" 2>/dev/null || true)"
    fi

    if [ -n "${current_hash}" ] && [ "${current_hash}" = "${previous_hash}" ]; then
        echo "Python lockfile unchanged, skip uv sync"
        return 0
    fi

    echo "Syncing backend dependencies with uv..."
    mkdir -p /root/.cache/uv
    uv sync --frozen --no-dev

    if [ -n "${current_hash}" ]; then
        printf '%s\n' "${current_hash}" > "${STAMP_FILE}"
    fi
}

wait_for_db() {
    echo "Waiting for PostgreSQL..."
    max_retries=30
    retry_count=0

    while [ "${retry_count}" -lt "${max_retries}" ]; do
        if "${VENV_DIR}/bin/python" -c "
import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_db():
    engine = create_async_engine(os.environ.get('DATABASE_URL', ''))
    try:
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        return True
    except Exception:
        return False
    finally:
        await engine.dispose()

raise SystemExit(0 if asyncio.run(check_db()) else 1)
" 2>/dev/null; then
            echo "Database connection ready"
            return 0
        fi

        retry_count=$((retry_count + 1))
        echo "Retry ${retry_count}/${max_retries}..."
        sleep 2
    done

    echo "Failed to connect to database"
    exit 1
}

run_optional_resets() {
    if [ "${RESET_STATIC_SCAN_TABLES_ON_DEPLOY:-false}" = "true" ] || [ "${RESET_STATIC_SCAN_TABLES_ON_DEPLOY:-0}" = "1" ]; then
        echo "Resetting static scan tables..."
        "${VENV_DIR}/bin/python" "${APP_ROOT}/scripts/reset_static_scan_tables.py"
    fi
}

sync_python_env_if_needed
wait_for_db

echo "Running database migrations..."
"${VENV_DIR}/bin/alembic" upgrade head

run_optional_resets

echo "Starting uvicorn with reload..."
exec "${VENV_DIR}/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port 8000
