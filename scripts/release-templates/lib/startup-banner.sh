#!/usr/bin/env bash

startup_banner_log_info() {
  if declare -F log_info >/dev/null 2>&1; then
    log_info "$@"
    return
  fi
  echo "[startup-banner] $*"
}

startup_banner_log_warn() {
  if declare -F log_warn >/dev/null 2>&1; then
    log_warn "$@"
    return
  fi
  echo "[startup-banner] $*" >&2
}

startup_banner_frontend_port() {
  printf '%s' "${VULHUNTER_FRONTEND_PORT:-3000}"
}

startup_banner_frontend_url() {
  printf 'http://localhost:%s' "$(startup_banner_frontend_port)"
}

startup_banner_local_frontend_root_url() {
  printf 'http://127.0.0.1:%s/' "$(startup_banner_frontend_port)"
}

startup_banner_probe_status() {
  local url="$1"
  local timeout_seconds="${STARTUP_BANNER_HTTP_TIMEOUT_SECONDS:-5}"

  python3 - "$url" "$timeout_seconds" <<'PY'
from __future__ import annotations

import socket
import sys
import urllib.error
import urllib.request


url = sys.argv[1]
timeout = float(sys.argv[2])
status = "000"
detail = "unknown error"

request = urllib.request.Request(url, method="GET")
try:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        status = str(response.getcode())
        detail = getattr(response, "reason", "") or "OK"
except urllib.error.HTTPError as exc:
    status = str(exc.code)
    detail = getattr(exc, "reason", "") or exc.__class__.__name__
except urllib.error.URLError as exc:
    reason = exc.reason
    if isinstance(reason, socket.timeout):
        detail = "timeout"
    else:
        detail = str(reason)
except TimeoutError:
    detail = "timeout"
except Exception as exc:  # pragma: no cover - defensive shell runtime path
    detail = f"{exc.__class__.__name__}: {exc}"

detail = detail.replace("\t", " ").replace("\r", " ").replace("\n", " ").strip() or "n/a"
print(f"{status}\t{detail}")
PY
}

wait_for_local_frontend_root_ready() {
  local max_attempts="${1:-60}"
  local retry_delay="${2:-5}"
  local attempt=0
  local probe_output status detail
  local root_url

  root_url="$(startup_banner_local_frontend_root_url)"

  while (( attempt < max_attempts )); do
    attempt=$((attempt + 1))
    probe_output="$(startup_banner_probe_status "$root_url")"
    IFS=$'\t' read -r status detail <<<"$probe_output"
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    sleep "$retry_delay"
  done

  startup_banner_log_warn "frontend root did not become ready: url=${root_url} status=${status:-000} detail=${detail:-n/a}"
  return 1
}

print_release_ready_banner() {
  local frontend_port frontend_url
  frontend_port="$(startup_banner_frontend_port)"
  frontend_url="$(startup_banner_frontend_url)"

  startup_banner_log_info "所有服务已启动，请访问本地 ${frontend_port} 端口进入项目可视化界面。"
  startup_banner_log_info "All services are up. Open ${frontend_url} to enter the visual project interface."
}
