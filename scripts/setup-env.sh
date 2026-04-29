#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV_FILE="${REPO_ROOT}/.env"

FORCE=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
  esac
done

log_info()  { echo "[setup-env] $*"; }
log_warn()  { echo "[setup-env] WARN: $*" >&2; }
log_error() { echo "[setup-env] ERROR: $*" >&2; }

detect_docker_socket() {
  local candidates=(
    "/var/run/docker.sock"
    "/run/docker.sock"
  )
  local s
  for s in "${candidates[@]}"; do
    if [ -S "$s" ]; then
      printf '%s' "$s"
      return 0
    fi
  done
  return 1
}

detect_podman_socket() {
  if command -v podman > /dev/null 2>&1; then
    local podman_sock
    podman_sock="$(podman info --format '{{.Host.RemoteSocket.Path}}' 2>/dev/null || true)"
    if [ -n "$podman_sock" ] && [ -S "$podman_sock" ]; then
      printf '%s' "$podman_sock"
      return 0
    fi
  fi

  if [ -n "${DOCKER_HOST:-}" ]; then
    local sock_from_env="${DOCKER_HOST#unix://}"
    if [ "$sock_from_env" != "$DOCKER_HOST" ] && [ -S "$sock_from_env" ]; then
      printf '%s' "$sock_from_env"
      return 0
    fi
  fi

  local uid
  uid="$(id -u)"
  local candidates=(
    "/run/podman/podman.sock"              # rootful Linux
    "/var/run/podman/podman.sock"          # 部分发行版
    "/run/user/${uid}/podman/podman.sock"  # rootless Linux
  )
  if [ "$(uname -s)" = "Darwin" ]; then
    local xdg_data="${XDG_RUNTIME_DIR:-${HOME}/.local/share}"
    candidates+=(
      "${xdg_data}/containers/podman/machine/qemu/podman.sock"
      "${xdg_data}/containers/podman/machine/podman.sock"
    )
  fi

  local s
  for s in "${candidates[@]}"; do
    if [ -S "$s" ]; then
      printf '%s' "$s"
      return 0
    fi
  done
  return 1
}

is_real_docker() {
  local docker_cmd="${1:-docker}"
  local server_info
  server_info="$("$docker_cmd" info --format '{{.Server.ServerVersion}}' 2>/dev/null || true)"
  local engine_type
  engine_type="$("$docker_cmd" info --format '{{.OperatingSystem}}' 2>/dev/null || true)"

  if printf '%s' "$engine_type" | grep -qi 'podman'; then
    return 1
  fi
  return 0
}

upsert_env_key() {
  local key="$1"
  local value="$2"

  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] would write: ${key}=${value}"
    return
  fi

  if [ ! -f "$ROOT_ENV_FILE" ]; then
    touch "$ROOT_ENV_FILE"
    log_info "created ${ROOT_ENV_FILE}"
  fi

  if grep -qE "^${key}=" "$ROOT_ENV_FILE" 2>/dev/null; then
    if [ "$FORCE" -eq 1 ]; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$ROOT_ENV_FILE"
      log_info "updated  ${key}=${value}  (${ROOT_ENV_FILE})"
    else
      local existing_val
      existing_val="$(grep -E "^${key}=" "$ROOT_ENV_FILE" | head -1 | cut -d= -f2-)"
      log_info "skip: ${key} already set to '${existing_val}' (use --force to override)"
    fi
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ROOT_ENV_FILE"
    log_info "wrote    ${key}=${value}  (${ROOT_ENV_FILE})"
  fi
}

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

log_info "detecting container runtime..."

RUNTIME=""        # docker | podman | unknown
SOCKET_PATH=""    # 要写入 .env 的 socket 路径

docker_sock="$(detect_docker_socket || true)"
if [ -n "$docker_sock" ]; then
  if command -v docker > /dev/null 2>&1 && is_real_docker docker; then
    RUNTIME="docker"
    SOCKET_PATH="$docker_sock"
    log_info "detected: Docker daemon, socket=${SOCKET_PATH}"
  fi
fi

if [ -z "$RUNTIME" ]; then
  podman_sock="$(detect_podman_socket || true)"
  if [ -n "$podman_sock" ]; then
    RUNTIME="podman"
    SOCKET_PATH="$podman_sock"
    log_info "detected: Podman, socket=${SOCKET_PATH}"
  fi
fi

if [ -z "$RUNTIME" ]; then
  if command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
    RUNTIME="docker"
    SOCKET_PATH="/var/run/docker.sock"
    log_info "detected: Docker (via docker info), assuming socket=${SOCKET_PATH}"
  elif command -v podman > /dev/null 2>&1; then
    RUNTIME="podman"
    log_warn "Podman socket not found. Run: systemctl --user enable --now podman.socket"
    if [ "$(id -u)" = "0" ]; then
      SOCKET_PATH="/run/podman/podman.sock"
    else
      SOCKET_PATH="/run/user/$(id -u)/podman/podman.sock"
    fi
    log_warn "using expected socket path: ${SOCKET_PATH} (may not exist yet)"
  fi
fi

if [ -z "$RUNTIME" ]; then
  log_error "neither Docker nor Podman detected. Install one of them first."
  exit 1
fi

if [ "$RUNTIME" = "podman" ]; then
  upsert_env_key "DOCKER_SOCKET_PATH" "$SOCKET_PATH"
else
  if grep -qE "^DOCKER_SOCKET_PATH=" "$ROOT_ENV_FILE" 2>/dev/null; then
    log_info "Docker runtime: DOCKER_SOCKET_PATH already set, keeping as-is"
  else
    log_info "Docker runtime: DOCKER_SOCKET_PATH not needed (default /var/run/docker.sock works)"
  fi
fi

if [ -S "$SOCKET_PATH" ]; then
  socket_gid="$(stat_group_id "$SOCKET_PATH" || true)"
  if [ -n "${socket_gid:-}" ]; then
    upsert_env_key "DOCKER_SOCKET_GID" "$socket_gid"
  else
    log_warn "could not detect group id for socket: ${SOCKET_PATH}"
  fi
fi

_podman_major=0
if command -v podman >/dev/null 2>&1; then
  _podman_major="$(podman -v 2>/dev/null | awk '{print $NF}' | cut -d. -f1)"
  _podman_major="${_podman_major:-0}"
fi

echo ""
echo "─────────────────────────────────────────────────────────────"
echo " Runtime : ${RUNTIME}"
echo " Socket  : ${SOCKET_PATH}"
echo " Env file: ${ROOT_ENV_FILE}"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo " 现在可以直接使用以下任一命令（效果相同）："
echo ""
echo "   docker compose -f docker-compose.yml -f docker-compose.full.yml up --build"
if [ "$_podman_major" -ge 4 ] 2>/dev/null; then
  echo "   podman compose -f docker-compose.yml -f docker-compose.full.yml up --build"
elif command -v podman-compose >/dev/null 2>&1; then
  echo "   podman-compose -f docker-compose.yml -f docker-compose.full.yml up --build"
elif [ "$_podman_major" -ge 1 ] 2>/dev/null; then
  echo ""
  echo " 注意: 检测到 Podman ${_podman_major}.x。podman compose -f 需要 Podman 4.x+"
  echo "   请升级 Podman 到 4.x+，或安装 podman-compose: pip install podman-compose"
fi
echo ""
echo "─────────────────────────────────────────────────────────────"
