#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$REPO_ROOT/scripts/lib/compose-env.sh"

MODE="full"
DRY_RUN=false
DOWN_ARGS=(down)

usage() {
  cat <<'USAGE'
Usage: ./stop-local-services.sh [mode] [options] [-- extra compose-down args]

Stop the local Docker service stack. The default mode is full because all start
modes share the same Compose project name and the full overlay covers the local
development volumes.

Modes:
  default            Use docker/docker-compose.yml only.
  hybrid             Use base + docker/docker-compose.hybrid.yml.
  full               Use base + docker/docker-compose.full.yml. Default.

Options:
  --mode <mode>      Same as positional mode: default, hybrid, full.
  --dry-run          Print commands without executing them.
  --remove-orphans   Append --remove-orphans to docker compose down.
  --volumes          Append --volumes to docker compose down.
  --rmi <type>       Append --rmi <type> to docker compose down.
  --timeout <sec>    Append --timeout <sec> to docker compose down.
  -h, --help         Show this help.

Examples:
  ./stop-local-services.sh
  ./stop-local-services.sh hybrid --remove-orphans
  ./stop-local-services.sh full --dry-run
USAGE
}

fail() {
  echo "[ERROR] $*" >&2
  exit 1
}

log_info() {
  echo "[INFO] $*"
}

log_warn() {
  echo "[WARN] $*" >&2
}

normalize_mode() {
  case "$1" in
    default|remote)
      printf 'default'
      ;;
    hybrid|mixed|mix)
      printf 'hybrid'
      ;;
    full|all|local)
      printf 'full'
      ;;
    *)
      fail "unsupported mode: $1 (expected default, hybrid, or full)"
      ;;
  esac
}

parse_args() {
  local seen_mode=false
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      default|remote|hybrid|mixed|mix|full|all|local)
        if [[ "$seen_mode" == "true" ]]; then
          fail "mode specified more than once"
        fi
        MODE="$(normalize_mode "$1")"
        seen_mode=true
        ;;
      --mode)
        shift
        [[ "$#" -gt 0 ]] || fail "--mode requires a value"
        if [[ "$seen_mode" == "true" ]]; then
          fail "mode specified more than once"
        fi
        MODE="$(normalize_mode "$1")"
        seen_mode=true
        ;;
      --dry-run)
        DRY_RUN=true
        ;;
      --remove-orphans|--volumes)
        DOWN_ARGS+=("$1")
        ;;
      --rmi|--timeout)
        local option="$1"
        shift
        [[ "$#" -gt 0 ]] || fail "$option requires a value"
        DOWN_ARGS+=("$option" "$1")
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --)
        shift
        DOWN_ARGS+=("$@")
        break
        ;;
      *)
        fail "unknown argument: $1"
        ;;
    esac
    shift
  done
}

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[DRY-RUN]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

compose_files_for_mode() {
  COMPOSE=(
    "${COMPOSE_BIN[@]}"
    --project-directory "$REPO_ROOT"
    -f "$REPO_ROOT/docker/docker-compose.yml"
  )

  case "$MODE" in
    hybrid)
      COMPOSE+=(-f "$REPO_ROOT/docker/docker-compose.hybrid.yml")
      ;;
    full)
      COMPOSE+=(-f "$REPO_ROOT/docker/docker-compose.full.yml")
      ;;
  esac
}

parse_args "$@"

if ! detect_compose_cmd_auto; then
  if [[ "$DRY_RUN" == "true" ]]; then
    COMPOSE_BIN=(docker compose)
    log_warn "compose tool not detected; dry-run uses fallback command: docker compose"
  else
    exit 1
  fi
fi

compose_files_for_mode

log_info "Mode: $MODE"
log_info "REPO_ROOT=$REPO_ROOT"
log_info "Compose files: ${COMPOSE[*]}"
log_info "Stopping services."
run_cmd "${COMPOSE[@]}" "${DOWN_ARGS[@]}"
log_info "Local service stop plan finished."
