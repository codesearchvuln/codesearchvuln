#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose --project-directory "$SOURCE_ROOT" -f "$SOURCE_ROOT/docker-compose.yml")
DRY_RUN=false
RUN_SETUP=true
DO_PULL=false
DO_BUILD=true
DO_UP=true
NO_PREFLIGHT=false
EXTRA_UP_ARGS=()

usage() {
  cat <<'USAGE'
Usage: ./start-local-services.sh [options] [-- extra docker-compose-up args]

Start the public sourcecode branch with its full Docker Compose deployment.
This script is intentionally sourcecode-only: it always uses the single root
`docker-compose.yml` and always targets the full local build path.

Options:
  --dry-run          Print commands without executing them.
  --skip-setup       Do not run scripts/setup-env.sh before compose commands.
  --pull             Pull base images before build/up.
  --pull-only        Pull base images, then exit without build/up.
  --build-only       Build local images, then exit without up.
  --no-build         Skip the compose build phase.
  --no-up            Prepare/build only; do not start services.
  --no-preflight     Set RUNNER_PREFLIGHT_ENABLED=false and RUNNER_PREFLIGHT_STRICT=false.
  -h, --help         Show this help.

Examples:
  ./start-local-services.sh
  ./start-local-services.sh --build-only
  ./start-local-services.sh --no-preflight -- --force-recreate
USAGE
}

fail() {
  echo "[sourcecode-start] ERROR: $*" >&2
  exit 1
}

log_info() {
  echo "[sourcecode-start] $*"
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
    --skip-setup)
      RUN_SETUP=false
      ;;
    --pull)
      DO_PULL=true
      ;;
    --pull-only)
      DO_PULL=true
      DO_BUILD=false
      DO_UP=false
      ;;
    --build-only)
      DO_BUILD=true
      DO_UP=false
      ;;
    --no-build)
      DO_BUILD=false
      ;;
    --no-up)
      DO_UP=false
      ;;
    --no-preflight)
      NO_PREFLIGHT=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      EXTRA_UP_ARGS+=("$@")
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

if [[ "$NO_PREFLIGHT" == "true" ]]; then
  export RUNNER_PREFLIGHT_ENABLED=false
  export RUNNER_PREFLIGHT_STRICT=false
else
  export RUNNER_PREFLIGHT_ENABLED="${RUNNER_PREFLIGHT_ENABLED:-true}"
  export RUNNER_PREFLIGHT_STRICT="${RUNNER_PREFLIGHT_STRICT:-true}"
fi

export DOCKERHUB_LIBRARY_MIRROR="${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}"
export COMPOSE_BAKE="${COMPOSE_BAKE:-false}"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

if ! docker compose version >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "docker compose not detected; dry-run will still print the planned command"
  else
    fail "docker compose is required for the sourcecode branch full deployment"
  fi
fi

log_info "SOURCE_ROOT=$SOURCE_ROOT"
log_info "Compose file: $SOURCE_ROOT/docker-compose.yml"
log_info "RUNNER_PREFLIGHT_ENABLED=$RUNNER_PREFLIGHT_ENABLED"
log_info "RUNNER_PREFLIGHT_STRICT=$RUNNER_PREFLIGHT_STRICT"

if [[ "$RUN_SETUP" == "true" ]]; then
  log_info "Preparing sourcecode .env via scripts/setup-env.sh"
  run_cmd bash "$SOURCE_ROOT/scripts/setup-env.sh"
fi

if [[ "$DO_PULL" == "true" ]]; then
  log_info "Pulling base support images"
  run_cmd "${COMPOSE[@]}" pull db redis scan-workspace-init backend-uploads-init adminer
fi

if [[ "$DO_BUILD" == "true" ]]; then
  log_info "Building full sourcecode application images"
  run_cmd "${COMPOSE[@]}" build backend frontend nexus-web
else
  log_info "Skipping build phase"
fi

if [[ "$DO_UP" == "true" ]]; then
  log_info "Starting full sourcecode stack"
  run_cmd "${COMPOSE[@]}" up -d "${EXTRA_UP_ARGS[@]}"
else
  log_info "Skipping service startup"
fi

log_info "Sourcecode full compose start plan finished."
