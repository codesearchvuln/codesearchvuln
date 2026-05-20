#!/usr/bin/env bash

set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV_FILE="${SOURCE_ROOT}/.env"
FORCE=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: bash scripts/setup-env.sh [--force] [--dry-run]

Detect the local container runtime socket and write DOCKER_SOCKET_PATH /
DOCKER_SOCKET_GID into the source tree root .env file when needed.
USAGE
      exit 0
      ;;
    *)
      echo "[setup-env] ERROR: unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

log_info() { echo "[setup-env] $*"; }
log_warn() { echo "[setup-env] WARN: $*" >&2; }

stat_group_id() {
  local target="$1"
  if stat -c '%g' "$target" >/dev/null 2>&1; then
    stat -c '%g' "$target"
    return 0
  fi
  if stat -f '%g' "$target" >/dev/null 2>&1; then
    stat -f '%g' "$target"
    return 0
  fi
  return 1
}

upsert_env_key() {
  local key="$1"
  local value="$2"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log_info "[dry-run] would write: ${key}=${value}"
    return 0
  fi

  [[ -f "$ROOT_ENV_FILE" ]] || touch "$ROOT_ENV_FILE"

  if grep -qE "^${key}=" "$ROOT_ENV_FILE" 2>/dev/null; then
    if [[ "$FORCE" -eq 1 ]]; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$ROOT_ENV_FILE"
      log_info "updated  ${key}=${value}"
    else
      local existing_val
      existing_val="$(grep -E "^${key}=" "$ROOT_ENV_FILE" | head -1 | cut -d= -f2-)"
      log_info "skip: ${key} already set to '${existing_val}' (use --force to override)"
    fi
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ROOT_ENV_FILE"
    log_info "wrote    ${key}=${value}"
  fi
}

detect_socket() {
  local uid="$(id -u)"
  local candidates=()

  if [[ -n "${DOCKER_SOCKET_PATH:-}" ]]; then
    candidates+=("$DOCKER_SOCKET_PATH")
  fi
  if [[ -n "${DOCKER_HOST:-}" && "${DOCKER_HOST}" == unix://* ]]; then
    candidates+=("${DOCKER_HOST#unix://}")
  fi
  candidates+=(
    "/var/run/docker.sock"
    "/run/docker.sock"
    "/run/podman/podman.sock"
    "/var/run/podman/podman.sock"
    "/run/user/${uid}/podman/podman.sock"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -S "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  if command -v podman >/dev/null 2>&1; then
    candidate="$(podman info --format '{{.Host.RemoteSocket.Path}}' 2>/dev/null || true)"
    if [[ -n "$candidate" && -S "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  fi

  return 1
}

log_info "detecting container runtime socket..."
SOCKET_PATH="$(detect_socket || true)"

if [[ -n "$SOCKET_PATH" ]]; then
  if [[ "$SOCKET_PATH" != "/var/run/docker.sock" ]]; then
    upsert_env_key "DOCKER_SOCKET_PATH" "$SOCKET_PATH"
  elif grep -qE "^DOCKER_SOCKET_PATH=" "$ROOT_ENV_FILE" 2>/dev/null; then
    log_info "DOCKER_SOCKET_PATH already set, keeping as-is"
  else
    log_info "Docker default socket detected; DOCKER_SOCKET_PATH is optional"
  fi

  socket_gid="$(stat_group_id "$SOCKET_PATH" || true)"
  if [[ -n "${socket_gid:-}" ]]; then
    upsert_env_key "DOCKER_SOCKET_GID" "$socket_gid"
  else
    log_warn "could not detect group id for socket: ${SOCKET_PATH}"
  fi
else
  log_warn "no Docker/Podman socket detected; compose may still work if your runtime provides one later"
fi

cat <<'SUMMARY'

─────────────────────────────────────────────────────────────
Public source tree is ready.
Run the full local source build with:

  docker compose up --build

Stop it with:

  docker compose down
─────────────────────────────────────────────────────────────
SUMMARY
