#!/usr/bin/env bash

STARTUP_BANNER_LAST_RELEASE_PROBE_RESULTS=""

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

startup_banner_local_frontend_base_url() {
  printf 'http://127.0.0.1:%s' "$(startup_banner_frontend_port)"
}

startup_banner_local_frontend_root_url() {
  printf '%s/' "$(startup_banner_local_frontend_base_url)"
}

startup_banner_release_root_dir() {
  local helper_dir
  local release_root
  helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  release_root="$(cd "$helper_dir/.." && pwd)"
  if [[ -f "$release_root/docker-compose.yml" ]]; then
    printf '%s' "$release_root"
    return 0
  fi
  printf '%s' "$(cd "$helper_dir/../.." && pwd)"
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

startup_banner_status_matches_allowed() {
  local status="$1"
  local allowed_statuses="$2"
  local allowed_status

  IFS='|' read -r -a allowed_statuses_array <<<"$allowed_statuses"
  for allowed_status in "${allowed_statuses_array[@]}"; do
    if [[ "$status" == "$allowed_status" ]]; then
      return 0
    fi
  done

  return 1
}

startup_banner_release_probe_plan() {
  local base_url="${1%/}"
  local release_root
  release_root="$(startup_banner_release_root_dir)"

  python3 - "$release_root" "$base_url" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path


release_root = Path(sys.argv[1])
base_url = sys.argv[2].rstrip("/")

probe_specs: list[tuple[str, str, str]] = [
    ("frontend-root", f"{base_url}/", "200"),
]

def append_asset_probes(
    label_prefix: str,
    index_path: Path,
    url_prefix: str,
) -> None:
    try:
        index_html = index_path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise SystemExit(f"missing bundle index: {index_path}") from exc

    asset_suffixes = re.findall(r'(?:src|href)="[^"]*?/(assets/[^"]+)"', index_html)
    if not asset_suffixes:
        raise SystemExit(f"no asset refs found in {index_path}")

    seen_urls: set[str] = set()
    for index, asset_suffix in enumerate(asset_suffixes, start=1):
        if url_prefix:
            asset_url = f"{base_url}/{url_prefix}/{asset_suffix}"
        else:
            asset_url = f"{base_url}/{asset_suffix}"
        if asset_url in seen_urls:
            continue
        seen_urls.add(asset_url)
        if asset_suffix.endswith(".js"):
            asset_kind = "script"
        elif asset_suffix.endswith(".css"):
            asset_kind = "style"
        else:
            asset_kind = "asset"
        probe_specs.append((f"{label_prefix}-{asset_kind}-{index}", asset_url, "200"))


# Keep the release frontend probe path literal visible for contract tests:
# deploy/runtime/frontend/site/index.html
append_asset_probes(
    "frontend-root",
    release_root / "deploy" / "runtime" / "frontend" / "site" / "index.html",
    "",
)

probe_specs.extend(
    [
        ("frontend-openapi", f"{base_url}/api/v1/openapi.json", "200"),
        (
            "frontend-projects",
            f"{base_url}/api/v1/projects/?skip=0&limit=1&include_metrics=true",
            "200|401|403",
        ),
        (
            "frontend-dashboard",
            f"{base_url}/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14",
            "200|401|403",
        ),
    ]
)

bundle_specs = (
    (
        "frontend-item-detail",
        release_root / "nexus-itemDetail" / "dist" / "index.html",
        "nexus-item-detail",
    ),
)

# nexus-web is now an independent container image; probe its URL directly
# instead of reading a dist bundle from the release tree.
probe_specs.append(("frontend-nexus", f"{base_url}/nexus/", "200"))

for label, index_path, public_prefix in bundle_specs:
    probe_specs.append((label, f"{base_url}/{public_prefix}/", "200"))
    append_asset_probes(label, index_path, public_prefix)

for label, url, allowed_statuses in probe_specs:
    print(f"{label}\t{url}\t{allowed_statuses}")
PY
}

startup_banner_run_release_readiness_probes() {
  local base_url="${1%/}"
  local probe_plan probe_output label url allowed_statuses status detail

  if ! probe_plan="$(startup_banner_release_probe_plan "$base_url" 2>&1)"; then
    detail="$(printf '%s' "$probe_plan" | tr '\r\n\t' ' ' | sed 's/  */ /g')"
    printf 'frontend-probe-plan\t%s\t200\t000\t%s\n' "$base_url" "${detail:-failed to build release probe plan}"
    return 0
  fi

  while IFS=$'\t' read -r label url allowed_statuses; do
    [[ -n "$label" ]] || continue
    probe_output="$(startup_banner_probe_status "$url")"
    IFS=$'\t' read -r status detail <<<"$probe_output"
    printf '%s\t%s\t%s\t%s\t%s\n' "$label" "$url" "$allowed_statuses" "$status" "$detail"
  done <<<"$probe_plan"
}

startup_banner_release_probe_results_green() {
  local probe_results="$1"
  local label url allowed_statuses status detail

  while IFS=$'\t' read -r label url allowed_statuses status detail; do
    [[ -n "$label" ]] || continue
    if ! startup_banner_status_matches_allowed "$status" "$allowed_statuses"; then
      return 1
    fi
  done <<<"$probe_results"

  return 0
}

startup_banner_emit_release_probe_results() {
  local probe_results="$1"
  local label url allowed_statuses status detail

  while IFS=$'\t' read -r label url allowed_statuses status detail; do
    [[ -n "$label" ]] || continue
    startup_banner_log_warn "Probe ${label}: status=${status} allowed=${allowed_statuses} url=${url} detail=${detail}"
  done <<<"$probe_results"
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

wait_for_local_frontend_release_ready() {
  local max_attempts="${1:-60}"
  local retry_delay="${2:-5}"
  local attempt=0
  local probe_results=""
  local root_url

  root_url="$(startup_banner_local_frontend_base_url)"

  while (( attempt < max_attempts )); do
    attempt=$((attempt + 1))
    probe_results="$(startup_banner_run_release_readiness_probes "$root_url")"
    if startup_banner_release_probe_results_green "$probe_results"; then
      STARTUP_BANNER_LAST_RELEASE_PROBE_RESULTS="$probe_results"
      return 0
    fi
    sleep "$retry_delay"
  done

  STARTUP_BANNER_LAST_RELEASE_PROBE_RESULTS="$probe_results"
  return 1
}

print_release_ready_banner() {
  local frontend_port frontend_url
  frontend_port="$(startup_banner_frontend_port)"
  frontend_url="$(startup_banner_frontend_url)"

  startup_banner_log_info "所有服务已启动，请访问本地 ${frontend_port} 端口进入项目可视化界面。"
  startup_banner_log_info "All services are up. Open ${frontend_url} to enter the visual project interface."
}
