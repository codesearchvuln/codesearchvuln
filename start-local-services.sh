#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$REPO_ROOT/scripts/lib/compose-env.sh"

MODE="default"
DRY_RUN=false
DO_PULL=true
DO_BUILD=true
DO_UP=true
CHECK_NEXUS_DIST=true
NO_PREFLIGHT=false
EXTRA_UP_ARGS=()

SUPPORT_PULL_SERVICES=(
  db
  redis
  scan-workspace-init
  backend-uploads-init
)

LOCAL_BUILD_SERVICES=(
  backend
  frontend
)

usage() {
  cat <<'USAGE'
Usage: ./start-local-services.sh [mode] [options] [-- extra compose-up args]

Start the local Docker service stack through compose files stored under docker/.
By default it builds local backend/frontend images before startup.

Modes:
  default            Use hybrid compose overlay; build backend/frontend locally before startup.
  hybrid             Use base + docker/docker-compose.hybrid.yml; build backend/frontend locally.
  full               Use base + docker/docker-compose.full.yml; full local integration profile.

Options:
  --mode <mode>      Same as positional mode: default, hybrid, full.
  --dry-run          Print commands without executing them.
  --pull-only        Pull required images, then exit without build/up.
  --build-only       Build local backend/frontend images, then exit without up.
  --no-pull          Skip image pull phase.
  --no-build         Skip local build phase.
  --no-up            Prepare only; do not start services.
  --no-preflight     Set RUNNER_PREFLIGHT_ENABLED=false and RUNNER_PREFLIGHT_STRICT=false for this run.
  --skip-nexus-check Do not require nexus-web/dist and nexus-itemDetail/dist.
  -h, --help         Show this help.

Examples:
  ./start-local-services.sh
  ./start-local-services.sh default
  ./start-local-services.sh hybrid
  ./start-local-services.sh full --dry-run
  ./start-local-services.sh full --build-only
  ./start-local-services.sh --no-preflight
  ./start-local-services.sh hybrid -- --force-recreate

Stop services with:
  ./stop-local-services.sh
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
      --pull-only)
        DO_PULL=true
        DO_BUILD=false
        DO_UP=false
        ;;
      --build-only)
        DO_PULL=false
        DO_BUILD=true
        DO_UP=false
        ;;
      --no-pull)
        DO_PULL=false
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
      --skip-nexus-check)
        CHECK_NEXUS_DIST=false
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
      *)
        fail "unknown argument: $1"
        ;;
    esac
    shift
  done
}

apply_mode_defaults() {
  case "$MODE" in
    default)
      ;;
    hybrid|full)
      ;;
  esac
}

assert_no_runner_scanner_services() {
  local service
  for service in "$@"; do
    case "$service" in
      *runner*|*scanner*|sandbox*|flow-parser*)
        fail "refusing runner/scanner service in local image plan: $service"
        ;;
    esac
  done
}

assert_nexus_dist() {
  local nexus_web="$REPO_ROOT/nexus-web/dist"
  local nexus_item="$REPO_ROOT/nexus-itemDetail/dist"
  if [[ ! -d "$nexus_web" || ! -d "$nexus_item" ]]; then
    fail "missing Nexus static bundles; run frontend artifact build first or pass --skip-nexus-check"
  fi
  log_info "Verified Nexus static bundles are available:"
  log_info "  nexus-web/dist -> /app/public/nexus"
  log_info "  nexus-itemDetail/dist -> /app/public/nexus-item-detail"
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
    default|hybrid)
      COMPOSE+=(-f "$REPO_ROOT/docker/docker-compose.hybrid.yml")
      ;;
    full)
      COMPOSE+=(-f "$REPO_ROOT/docker/docker-compose.full.yml")
      ;;
  esac
}

pull_services_for_mode() {
  PULL_SERVICES=("${SUPPORT_PULL_SERVICES[@]}")
}

parse_args "$@"
apply_mode_defaults
assert_no_runner_scanner_services "${SUPPORT_PULL_SERVICES[@]}" "${LOCAL_BUILD_SERVICES[@]}"

export DOCKERHUB_LIBRARY_MIRROR="${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}"
export DOCKER_CLI_IMAGE="${DOCKER_CLI_IMAGE:-docker:cli}"
export COMPOSE_BAKE="${COMPOSE_BAKE:-false}"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
if [[ "$NO_PREFLIGHT" == "true" ]]; then
  export RUNNER_PREFLIGHT_ENABLED=false
  export RUNNER_PREFLIGHT_STRICT=false
else
  export RUNNER_PREFLIGHT_ENABLED=true
  export RUNNER_PREFLIGHT_STRICT=true
fi

if ! detect_compose_cmd_auto; then
  if [[ "$DRY_RUN" == "true" ]]; then
    COMPOSE_BIN=(docker compose)
    log_warn "compose tool not detected; dry-run uses fallback command: docker compose"
  else
    exit 1
  fi
fi

compose_files_for_mode
pull_services_for_mode

log_info "Mode: $MODE"
log_info "REPO_ROOT=$REPO_ROOT"
log_info "Compose files: ${COMPOSE[*]}"
log_info "DOCKERHUB_LIBRARY_MIRROR=$DOCKERHUB_LIBRARY_MIRROR"
log_info "DOCKER_CLI_IMAGE=$DOCKER_CLI_IMAGE"
log_info "COMPOSE_BAKE=$COMPOSE_BAKE"
log_info "COMPOSE_PARALLEL_LIMIT=$COMPOSE_PARALLEL_LIMIT"
log_info "RUNNER_PREFLIGHT_ENABLED=$RUNNER_PREFLIGHT_ENABLED"
log_info "RUNNER_PREFLIGHT_STRICT=$RUNNER_PREFLIGHT_STRICT"
if [[ "$RUNNER_PREFLIGHT_ENABLED" == "false" ]]; then
  log_info "Remote runner/scanner/sandbox image preflight: disabled by --no-preflight"
else
  log_info "Remote runner/scanner/sandbox image preflight: enabled; backend may pull configured preflight images"
fi

if [[ "$CHECK_NEXUS_DIST" == "true" ]]; then
  assert_nexus_dist
fi

if [[ "$DRY_RUN" != "true" ]]; then
  load_container_socket_env
  load_container_socket_gid_env
  ensure_backend_docker_env_file "$REPO_ROOT"
fi

if [[ "$DO_PULL" == "true" ]]; then
  log_info "Pulling required images: ${PULL_SERVICES[*]}"
  run_cmd "${COMPOSE[@]}" pull "${PULL_SERVICES[@]}"
else
  log_info "Skipping image pull."
fi

if [[ "$DO_BUILD" == "true" ]]; then
  log_info "Building local application images: ${LOCAL_BUILD_SERVICES[*]}"
  run_cmd "${COMPOSE[@]}" build "${LOCAL_BUILD_SERVICES[@]}"
else
  log_info "Skipping local application image build."
fi

if [[ "$DO_UP" == "true" ]]; then
  log_info "Starting services."
  run_cmd "${COMPOSE[@]}" up -d "${EXTRA_UP_ARGS[@]}"
else
  log_info "Skipping service startup."
fi

log_info "Local service start plan finished."
