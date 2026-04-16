#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/docker/env/backend/.env}"
BACKEND_ENV_EXAMPLE="${BACKEND_ENV_EXAMPLE:-$ROOT_DIR/docker/env/backend/env.example}"
COMPOSE_ENV_HELPER="${COMPOSE_ENV_HELPER:-$ROOT_DIR/scripts/lib/compose-env.sh}"
STARTUP_BANNER_HELPER="${STARTUP_BANNER_HELPER:-$ROOT_DIR/scripts/lib/startup-banner.sh}"

log_info() {
  echo "[online-up] $*"
}

log_warn() {
  echo "[online-up] $*" >&2
}

die() {
  echo "[online-up] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash ./scripts/online-up.sh
EOF
}

ensure_file_from_example() {
  local target="$1"
  local example="$2"
  local label="$3"
  local followup="$4"

  if [[ -f "$target" ]]; then
    return 0
  fi
  [[ -f "$example" ]] || die "missing ${label} example file: $example"
  mkdir -p "$(dirname "$target")"
  cp "$example" "$target"
  log_warn "${label} auto-generated from template: ${target#$ROOT_DIR/}"
  log_warn "$followup"
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

ensure_compose_ready() {
  docker compose version >/dev/null 2>&1 || die "docker compose not found or unavailable"
}

compose() {
  (
    cd "$ROOT_DIR"
    docker compose "$@"
  )
}

collect_compose_logs() {
  compose logs db redis scan-workspace-init backend-uploads-init db-bootstrap backend frontend --tail=100 2>&1 || true
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  require_command docker
  require_command python3
  [[ -f "$COMPOSE_ENV_HELPER" ]] || die "missing compose env helper: $COMPOSE_ENV_HELPER"
  [[ -f "$STARTUP_BANNER_HELPER" ]] || die "missing startup banner helper: $STARTUP_BANNER_HELPER"

  ensure_file_from_example \
    "$BACKEND_ENV_FILE" \
    "$BACKEND_ENV_EXAMPLE" \
    "backend env file" \
    "Review at least LLM_API_KEY, LLM_PROVIDER, and LLM_MODEL before relying on this deployment."

  ensure_compose_ready

  # shellcheck disable=SC1090
  source "$COMPOSE_ENV_HELPER"
  # shellcheck disable=SC1090
  source "$STARTUP_BANNER_HELPER"
  load_container_socket_env
  load_container_socket_gid_env

  [[ -n "${DOCKER_SOCKET_PATH:-}" ]] && log_info "detected Docker socket path: ${DOCKER_SOCKET_PATH}"
  [[ -n "${DOCKER_SOCKET_GID:-}" ]] && log_info "detected Docker socket gid: ${DOCKER_SOCKET_GID}"

  log_info "starting docker compose up -d"
  compose up -d

  if ! wait_for_local_frontend_root_ready "${ONLINE_UP_MAX_ATTEMPTS:-60}" "${ONLINE_UP_RETRY_DELAY_SECONDS:-5}"; then
    log_warn "online startup readiness probe failed"
    compose ps || true
    logs_output="$(collect_compose_logs)"
    printf '%s\n' "$logs_output" >&2
    die "release services failed readiness checks"
  fi

  print_release_ready_banner
}

main "$@"
