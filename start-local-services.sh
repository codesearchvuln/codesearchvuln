#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$REPO_ROOT/scripts/lib/compose-env.sh"

MODE="default"
DRY_RUN=false
DO_PULL=true
DO_BUILD=true
DO_UP=true
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

build_backend_image() {
  local -a cmd=(
    docker build
    -t vulhunter/backend-local:latest
    -f "$REPO_ROOT/docker/backend.Dockerfile"
    --target runtime-plain
    --build-arg "DOCKERHUB_LIBRARY_MIRROR=$DOCKERHUB_LIBRARY_MIRROR"
    --build-arg "UV_IMAGE=${UV_IMAGE:-m.daocloud.io/ghcr.io/astral-sh/uv:latest}"
    --build-arg "DOCKER_CLI_IMAGE=${DOCKER_CLI_IMAGE:-${DOCKERHUB_LIBRARY_MIRROR}/docker:cli}"
    --build-arg "BACKEND_APT_MIRROR_PRIMARY=${BACKEND_APT_MIRROR_PRIMARY:-mirrors.aliyun.com}"
    --build-arg "BACKEND_APT_SECURITY_PRIMARY=${BACKEND_APT_SECURITY_PRIMARY:-mirrors.aliyun.com}"
    --build-arg "BACKEND_APT_MIRROR_FALLBACK=${BACKEND_APT_MIRROR_FALLBACK:-deb.debian.org}"
    --build-arg "BACKEND_APT_SECURITY_FALLBACK=${BACKEND_APT_SECURITY_FALLBACK:-security.debian.org}"
    --build-arg "BACKEND_PYPI_INDEX_PRIMARY=$BACKEND_PYPI_INDEX_PRIMARY"
    --build-arg "BACKEND_PYPI_INDEX_FALLBACK=$BACKEND_PYPI_INDEX_FALLBACK"
    --build-arg "BACKEND_PYPI_INDEX_CANDIDATES=$BACKEND_PYPI_INDEX_CANDIDATES"
    --build-arg "BACKEND_UV_HTTP_TIMEOUT_SECONDS=$BACKEND_UV_HTTP_TIMEOUT_SECONDS"
    --build-arg "BACKEND_UV_STEP_TIMEOUT_SECONDS=$BACKEND_UV_STEP_TIMEOUT_SECONDS"
    --build-arg "BACKEND_UV_ATTEMPTS_PER_INDEX=$BACKEND_UV_ATTEMPTS_PER_INDEX"
    --build-arg "BACKEND_UV_CONCURRENT_DOWNLOADS=$BACKEND_UV_CONCURRENT_DOWNLOADS"
    --build-arg "BACKEND_UV_CONCURRENT_INSTALLS=$BACKEND_UV_CONCURRENT_INSTALLS"
    --build-arg "BACKEND_INSTALL_CJK_FONTS=${BACKEND_INSTALL_CJK_FONTS:-1}"
    "$REPO_ROOT"
  )
  run_cmd "${cmd[@]}"
}

build_frontend_image() {
  local -a cmd=(
    docker build
    -t vulhunter/frontend-local:latest
    -f "$REPO_ROOT/docker/frontend.Dockerfile"
    --target dev
    --build-arg "DOCKERHUB_LIBRARY_MIRROR=$DOCKERHUB_LIBRARY_MIRROR"
    --build-arg "FRONTEND_NPM_REGISTRY=${FRONTEND_NPM_REGISTRY:-https://registry.npmmirror.com}"
    --build-arg "FRONTEND_NPM_REGISTRY_FALLBACK=${FRONTEND_NPM_REGISTRY_FALLBACK:-https://registry.npmjs.org}"
    --build-arg "PNPM_VERSION=${PNPM_VERSION:-9.15.4}"
    --build-arg "BUILD_WEAK_NETWORK=${BUILD_WEAK_NETWORK:-false}"
    --build-arg "BUILD_ARCH=${BUILD_ARCH:-}"
    "$REPO_ROOT/frontend"
  )
  run_cmd "${cmd[@]}"
}

parse_args "$@"
apply_mode_defaults
assert_no_runner_scanner_services "${SUPPORT_PULL_SERVICES[@]}" "${LOCAL_BUILD_SERVICES[@]}"

export DOCKERHUB_LIBRARY_MIRROR="${DOCKERHUB_LIBRARY_MIRROR:-m.daocloud.io/docker.io/library}"
export DOCKER_CLI_IMAGE="${DOCKER_CLI_IMAGE:-${DOCKERHUB_LIBRARY_MIRROR}/docker:cli}"
export BACKEND_PYPI_INDEX_PRIMARY="${BACKEND_PYPI_INDEX_PRIMARY:-https://mirrors.huaweicloud.com/repository/pypi/simple/}"
export BACKEND_PYPI_INDEX_FALLBACK="${BACKEND_PYPI_INDEX_FALLBACK:-https://mirrors.aliyun.com/pypi/simple/}"
export BACKEND_PYPI_INDEX_CANDIDATES="${BACKEND_PYPI_INDEX_CANDIDATES:-https://mirrors.huaweicloud.com/repository/pypi/simple/,https://mirrors.aliyun.com/pypi/simple/,https://mirrors.cloud.tencent.com/pypi/simple/,https://pypi.tuna.tsinghua.edu.cn/simple,https://pypi.mirrors.ustc.edu.cn/simple/,https://mirrors.bfsu.edu.cn/pypi/web/simple/,https://pypi.org/simple}"
export BACKEND_UV_HTTP_TIMEOUT_SECONDS="${BACKEND_UV_HTTP_TIMEOUT_SECONDS:-60}"
export BACKEND_UV_STEP_TIMEOUT_SECONDS="${BACKEND_UV_STEP_TIMEOUT_SECONDS:-600}"
export BACKEND_UV_CONCURRENT_DOWNLOADS="${BACKEND_UV_CONCURRENT_DOWNLOADS:-16}"
export BACKEND_UV_CONCURRENT_INSTALLS="${BACKEND_UV_CONCURRENT_INSTALLS:-8}"
export BACKEND_UV_ATTEMPTS_PER_INDEX="${BACKEND_UV_ATTEMPTS_PER_INDEX:-1}"
export BACKEND_UV_CONCURRENT_DOWNLOADS="${BACKEND_UV_CONCURRENT_DOWNLOADS:-4}"
export BACKEND_UV_CONCURRENT_INSTALLS="${BACKEND_UV_CONCURRENT_INSTALLS:-4}"
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
log_info "BACKEND_PYPI_INDEX_PRIMARY=$BACKEND_PYPI_INDEX_PRIMARY"
log_info "BACKEND_PYPI_INDEX_FALLBACK=$BACKEND_PYPI_INDEX_FALLBACK"
log_info "BACKEND_UV_STEP_TIMEOUT_SECONDS=$BACKEND_UV_STEP_TIMEOUT_SECONDS"
log_info "BACKEND_UV_HTTP_TIMEOUT_SECONDS=$BACKEND_UV_HTTP_TIMEOUT_SECONDS"
log_info "COMPOSE_BAKE=$COMPOSE_BAKE"
log_info "COMPOSE_PARALLEL_LIMIT=$COMPOSE_PARALLEL_LIMIT"
log_info "RUNNER_PREFLIGHT_ENABLED=$RUNNER_PREFLIGHT_ENABLED"
log_info "RUNNER_PREFLIGHT_STRICT=$RUNNER_PREFLIGHT_STRICT"
if [[ "$RUNNER_PREFLIGHT_ENABLED" == "false" ]]; then
  log_info "Remote runner/scanner/sandbox image preflight: disabled by --no-preflight"
else
  log_info "Remote runner/scanner/sandbox image preflight: enabled; backend may pull configured preflight images"
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
  build_backend_image
  build_frontend_image
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
