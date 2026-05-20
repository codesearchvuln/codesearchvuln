#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose --project-directory "$SOURCE_ROOT" -f "$SOURCE_ROOT/docker-compose.yml")
DRY_RUN=false
DOWN_ARGS=(down)

usage() {
  cat <<'USAGE'
Usage: ./stop-local-services.sh [options] [-- extra docker-compose-down args]

Stop the public sourcecode branch full Docker Compose deployment. This script
always uses the single root `docker-compose.yml` from the generated sourcecode tree.

Options:
  --dry-run          Print commands without executing them.
  --remove-orphans   Append --remove-orphans to docker compose down.
  --volumes          Append --volumes to docker compose down.
  --rmi <type>       Append --rmi <type> to docker compose down.
  --timeout <sec>    Append --timeout <sec> to docker compose down.
  -h, --help         Show this help.
USAGE
}

fail() {
  echo "[sourcecode-stop] ERROR: $*" >&2
  exit 1
}

log_info() {
  echo "[sourcecode-stop] $*"
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

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    --remove-orphans|--volumes)
      DOWN_ARGS+=("$1")
      ;;
    --rmi|--timeout)
      option="$1"
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
    default|remote|hybrid|mixed|mix|full|all|local|--mode)
      fail "sourcecode branch supports only the full single docker compose route; remove mode argument '$1'"
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
  shift
done

if ! docker compose version >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "docker compose not detected; dry-run will still print the planned command"
  else
    fail "docker compose is required for the sourcecode branch full deployment"
  fi
fi

log_info "SOURCE_ROOT=$SOURCE_ROOT"
log_info "Compose file: $SOURCE_ROOT/docker-compose.yml"
log_info "Stopping full sourcecode stack"
run_cmd "${COMPOSE[@]}" "${DOWN_ARGS[@]}"
log_info "Sourcecode full compose stop plan finished."
