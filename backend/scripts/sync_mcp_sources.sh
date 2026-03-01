#!/usr/bin/env bash
set -u

bool_true() {
  local v
  v="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$v" == "1" || "$v" == "true" || "$v" == "yes" || "$v" == "on" ]]
}

SYNC_ENABLED="${MCP_SOURCE_SYNC_ENABLED:-true}"
if ! bool_true "$SYNC_ENABLED"; then
  echo "ℹ️  MCP 源码同步已禁用（MCP_SOURCE_SYNC_ENABLED=${SYNC_ENABLED}）"
  exit 0
fi

SOURCE_ROOT="${MCP_SOURCE_ROOT:-/app/data/mcp/sources}"
SYNC_DEPTH="${MCP_SOURCE_SYNC_DEPTH:-1}"
SYNC_STRICT="${MCP_SOURCE_SYNC_STRICT:-false}"
GIT_MIRROR_ENABLED="${GIT_MIRROR_ENABLED:-true}"
GIT_MIRROR_PREFIX="${GIT_MIRROR_PREFIX:-https://ghfast.top}"
GIT_MIRROR_HOSTS="${GIT_MIRROR_HOSTS:-github.com}"
GIT_MIRROR_ALLOW_AUTH_URL="${GIT_MIRROR_ALLOW_AUTH_URL:-false}"

mkdir -p "${SOURCE_ROOT}"

echo "📚 开始同步 MCP 源码到: ${SOURCE_ROOT}"

host_allowed_for_mirror() {
  local host="$1"
  local item
  IFS=',' read -ra _hosts <<< "${GIT_MIRROR_HOSTS}"
  for item in "${_hosts[@]}"; do
    item="$(echo "${item}" | xargs)"
    if [[ -n "${item}" && "${host}" == "${item}" ]]; then
      return 0
    fi
  done
  return 1
}

url_has_auth() {
  local url="$1"
  local without_scheme="${url#*://}"
  local authority="${without_scheme%%/*}"
  [[ "${authority}" == *"@"* ]]
}

build_mirror_url() {
  local url="$1"
  local prefix="${GIT_MIRROR_PREFIX%/}"
  printf "%s/%s" "${prefix}" "${url}"
}

should_use_mirror() {
  local url="$1"
  if ! bool_true "${GIT_MIRROR_ENABLED}"; then
    return 1
  fi
  if [[ "${url}" != http://* && "${url}" != https://* ]]; then
    return 1
  fi
  if ! bool_true "${GIT_MIRROR_ALLOW_AUTH_URL}" && url_has_auth "${url}"; then
    return 1
  fi
  local without_scheme="${url#*://}"
  local authority="${without_scheme%%/*}"
  local host="${authority##*@}"
  host="${host%%:*}"
  host_allowed_for_mirror "${host}"
}

sync_repo() {
  local name="$1"
  local repo_url="$2"
  local branch="$3"
  local target="${SOURCE_ROOT}/${name}"

  if [ -d "${target}/.git" ]; then
    echo "🔄 更新 ${name} (${branch})"
    if should_use_mirror "${repo_url}"; then
      local mirror_url
      local fetch_error
      local fetch_status
      mirror_url="$(build_mirror_url "${repo_url}")"
      fetch_error="$(git -C "${target}" fetch --depth "${SYNC_DEPTH}" "${mirror_url}" "${branch}" 2>&1)"
      fetch_status=$?
      if [[ ${fetch_status} -ne 0 ]]; then
        echo "⚠️  ${name} 镜像 fetch 失败，原因: ${fetch_error}"
        echo "🔁 ${name} 回源 fetch: ${repo_url}"
        if ! git -C "${target}" fetch --depth "${SYNC_DEPTH}" origin "${branch}"; then
          return 1
        fi
        echo "✅ ${name} 回源 fetch 成功"
      fi
    else
      if ! git -C "${target}" fetch --depth "${SYNC_DEPTH}" origin "${branch}"; then
        return 1
      fi
    fi
    if ! git -C "${target}" checkout -q "${branch}"; then
      return 1
    fi
    if ! git -C "${target}" reset --hard "origin/${branch}"; then
      return 1
    fi
  else
    echo "⬇️  拉取 ${name} (${branch})"
    if should_use_mirror "${repo_url}"; then
      local mirror_url
      local clone_error
      local clone_status
      mirror_url="$(build_mirror_url "${repo_url}")"
      clone_error="$(git clone --depth "${SYNC_DEPTH}" --branch "${branch}" "${mirror_url}" "${target}" 2>&1)"
      clone_status=$?
      if [[ ${clone_status} -ne 0 ]]; then
        echo "⚠️  ${name} 镜像 clone 失败，原因: ${clone_error}"
        echo "🔁 ${name} 回源 clone: ${repo_url}"
        if ! git clone --depth "${SYNC_DEPTH}" --branch "${branch}" "${repo_url}" "${target}"; then
          return 1
        fi
        echo "✅ ${name} 回源 clone 成功"
      fi
    else
      if ! git clone --depth "${SYNC_DEPTH}" --branch "${branch}" "${repo_url}" "${target}"; then
        return 1
      fi
    fi
  fi

  local commit_sha
  commit_sha="$(git -C "${target}" rev-parse --short HEAD 2>/dev/null || true)"
  echo "✅ ${name} 就绪 @ ${commit_sha:-unknown}"
  return 0
}

FAILED=0

if ! sync_repo "modelcontextprotocol-servers" "https://github.com/modelcontextprotocol/servers.git" "main"; then
  echo "⚠️  modelcontextprotocol-servers 同步失败"
  FAILED=1
fi

if ! sync_repo "code-index-mcp" "https://github.com/johnhuang316/code-index-mcp.git" "master"; then
  echo "⚠️  code-index-mcp 同步失败"
  FAILED=1
fi

if ! sync_repo "qmd" "https://github.com/tobi/qmd.git" "main"; then
  echo "⚠️  qmd 同步失败"
  FAILED=1
fi

if ! sync_repo "codebadger" "https://github.com/Lekssays/codebadger.git" "main"; then
  echo "⚠️  codebadger 同步失败"
  FAILED=1
fi

if [ "${FAILED}" -ne 0 ]; then
  if bool_true "${SYNC_STRICT}"; then
    echo "❌ MCP 源码同步失败（严格模式）"
    exit 1
  fi
  echo "⚠️  MCP 源码同步存在失败项，已按非严格模式继续启动"
else
  echo "🎉 MCP 源码同步完成"
fi

exit 0
