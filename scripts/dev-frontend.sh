#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] docker compose plugin not found"
  exit 1
fi

echo "[INFO] starting backend dependencies..."
docker compose up -d db redis backend frontend

echo "[INFO] frontend dev ready: http://localhost:3000"
echo "[INFO] backend api docs: http://localhost:8000/docs"
