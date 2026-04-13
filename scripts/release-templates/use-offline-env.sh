#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OFFLINE_ENV_FILE="${OFFLINE_ENV_FILE:-$ROOT_DIR/docker/env/backend/offline-images.env}"

if [[ ! -f "$OFFLINE_ENV_FILE" ]]; then
  echo "[offline-env] missing offline env file: $OFFLINE_ENV_FILE" >&2
  echo "[offline-env] copy docker/env/backend/offline-images.env.example to docker/env/backend/offline-images.env first." >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  set -- docker compose up -d
fi

set -a
# shellcheck disable=SC1090
source "$OFFLINE_ENV_FILE"
set +a

exec "$@"
