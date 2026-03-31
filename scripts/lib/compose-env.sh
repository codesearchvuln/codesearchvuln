#!/usr/bin/env bash

compose_env_log_info() {
  if declare -F log_info >/dev/null 2>&1; then
    log_info "$@"
    return
  fi
  echo "[INFO] $*"
}

compose_env_log_warn() {
  if declare -F log_warn >/dev/null 2>&1; then
    log_warn "$@"
    return
  fi
  echo "[WARN] $*" >&2
}

compose_env_log_error() {
  if declare -F log_error >/dev/null 2>&1; then
    log_error "$@"
    return
  fi
  echo "[ERROR] $*" >&2
}

ensure_backend_docker_env_file() {
  local repo_root="${1:-${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
  local env_dir="${repo_root}/docker/env/backend"
  local env_file="${env_dir}/.env"
  local example_file="${env_dir}/env.example"

  mkdir -p "${env_dir}"

  if [ -f "${env_file}" ]; then
    return 0
  fi

  if [ ! -f "${example_file}" ]; then
    compose_env_log_error "missing ${example_file}; cannot bootstrap docker/env/backend/.env"
    return 1
  fi

  cp "${example_file}" "${env_file}"
  compose_env_log_info "自动生成 backend Docker 环境文件: docker/env/backend/.env"
  compose_env_log_warn "已从 docker/env/backend/env.example 复制默认配置；如需真实模型密钥，请编辑 docker/env/backend/.env。"
}
