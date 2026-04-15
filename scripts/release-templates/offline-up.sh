#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICES_METADATA_FILE="${SERVICES_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-services.json}"
SCANNER_METADATA_FILE="${SCANNER_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-scanner.json}"
RELEASE_SNAPSHOT_LOCK_PATH="${RELEASE_SNAPSHOT_LOCK_PATH:-$ROOT_DIR/release-snapshot-lock.json}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/docker/env/backend/.env}"
BACKEND_ENV_EXAMPLE="${BACKEND_ENV_EXAMPLE:-$ROOT_DIR/docker/env/backend/env.example}"
OFFLINE_ENV_FILE="${OFFLINE_ENV_FILE:-$ROOT_DIR/docker/env/backend/offline-images.env}"
OFFLINE_ENV_EXAMPLE="${OFFLINE_ENV_EXAMPLE:-$ROOT_DIR/docker/env/backend/offline-images.env.example}"
COMPOSE_ENV_HELPER="${COMPOSE_ENV_HELPER:-$ROOT_DIR/scripts/lib/compose-env.sh}"
ATTACH_LOGS="false"

log_info() {
  echo "[offline-up] $*"
}

log_warn() {
  echo "[offline-up] $*" >&2
}

die() {
  echo "[offline-up] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash ./scripts/offline-up.sh [--attach-logs]

Options:
  --attach-logs   After backend becomes healthy, run foreground
                  `docker compose up` so startup logs stay attached.
  -h, --help      Show this help text.
EOF
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

ensure_file_from_example() {
  local target="$1"
  local example="$2"
  local label="$3"
  local followup="$4"

  if [[ -f "$target" ]]; then
    return 0
  fi
  [[ -f "$example" ]] || die "missing ${label} example file: $example"
  mkdir -p "$(dirname "$target")"
  cp "$example" "$target"
  log_warn "${label} auto-generated from template: ${target#$ROOT_DIR/}"
  log_warn "$followup"
}

normalize_arch() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    amd64|x86_64)
      printf 'amd64'
      ;;
    arm64|aarch64)
      printf 'arm64'
      ;;
    *)
      die "unsupported docker server architecture: $1"
      ;;
  esac
}

detect_server_arch() {
  local arch
  arch="$(docker version --format '{{.Server.Arch}}' 2>/dev/null | tr -d '\r' | tail -n 1)"
  [[ -n "$arch" ]] || die "unable to determine docker server architecture"
  normalize_arch "$arch"
}

find_bundle_path() {
  local bundle="$1"
  local arch="$2"
  local locations=("$ROOT_DIR" "$ROOT_DIR/images")
  local extensions=(".tar.zst" ".tar")
  local location extension candidate

  for location in "${locations[@]}"; do
    for extension in "${extensions[@]}"; do
      candidate="$location/vulhunter-${bundle}-images-${arch}${extension}"
      if [[ -f "$candidate" ]]; then
        printf '%s' "$candidate"
        return 0
      fi
    done
  done

  return 1
}

read_lock_bundle_contract() {
  local bundle="$1"
  local arch="$2"

  python3 - "$RELEASE_SNAPSHOT_LOCK_PATH" "$bundle" "$arch" <<'PY'
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


lock_path = Path(sys.argv[1])
bundle = sys.argv[2]
arch = sys.argv[3]

try:
    lock_payload = json.loads(lock_path.read_text(encoding="utf-8"))
except FileNotFoundError as exc:
    raise SystemExit(f"missing lock file: {lock_path}") from exc
except json.JSONDecodeError as exc:
    raise SystemExit(f"invalid lock file JSON: {lock_path}: {exc}") from exc

snapshot_tag = str(lock_payload.get("snapshot_tag", "")).strip() or "unknown"
entry = lock_payload.get("bundles", {}).get(bundle, {}).get(arch)
if not isinstance(entry, dict):
    raise SystemExit(f"missing bundles/{bundle}/{arch} entry in lock file: {lock_path}")

bundle_file = str(entry.get("asset_name", "")).strip()
bundle_sha256 = str(entry.get("bundle_sha256", "")).strip().lower()
if not bundle_file:
    raise SystemExit(f"missing asset_name for {bundle}/{arch} in lock file: {lock_path}")
if not re.fullmatch(r"[0-9a-f]{64}", bundle_sha256):
    raise SystemExit(f"invalid bundle_sha256 for {bundle}/{arch} in lock file: {lock_path}")

print(f"{snapshot_tag}\t{bundle_file}\t{bundle_sha256}")
PY
}

sha256_file() {
  local path="$1"

  python3 - "$path" <<'PY'
from __future__ import annotations

import hashlib
import sys


digest = hashlib.sha256()
with open(sys.argv[1], "rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
print(digest.hexdigest())
PY
}

prevalidate_bundle() {
  local bundle="$1"
  local arch="$2"
  local contract snapshot_tag expected_file expected_sha bundle_path actual_file actual_sha
  local lock_label="${RELEASE_SNAPSHOT_LOCK_PATH#$ROOT_DIR/}"

  if ! contract="$(read_lock_bundle_contract "$bundle" "$arch" 2>&1)"; then
    die "offline bundle prevalidation failed for ${bundle}/${arch} (snapshot unknown): ${contract}"
  fi

  IFS=$'\t' read -r snapshot_tag expected_file expected_sha <<<"$contract"

  if ! bundle_path="$(find_bundle_path "$bundle" "$arch")"; then
    die "offline bundle prevalidation failed for ${bundle}/${arch} (snapshot ${snapshot_tag}): expected ${expected_file} in the release root or images/ according to ${lock_label}."
  fi

  actual_file="$(basename "$bundle_path")"
  if [[ "$actual_file" != "$expected_file" ]]; then
    die "offline bundle prevalidation failed for ${bundle}/${arch} (snapshot ${snapshot_tag}): expected filename ${expected_file}, found ${actual_file}."
  fi

  actual_sha="$(sha256_file "$bundle_path")"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    die "offline bundle prevalidation failed for ${bundle}/${arch} (snapshot ${snapshot_tag}): checksum mismatch for ${actual_file}."
  fi

  log_info "prevalidated ${bundle}/${arch}: ${actual_file} (snapshot ${snapshot_tag})" >&2
  printf '%s' "$bundle_path"
}

load_bundle() {
  local bundle_path="$1"
  log_info "loading bundle: ${bundle_path#$ROOT_DIR/}"
  case "$bundle_path" in
    *.tar.zst)
      require_command zstd
      zstd -dc "$bundle_path" | docker load
      ;;
    *.tar)
      docker load -i "$bundle_path"
      ;;
    *)
      die "unsupported bundle format: $bundle_path"
      ;;
  esac
}

emit_manifest_images() {
  python3 - "$SERVICES_METADATA_FILE" "$SCANNER_METADATA_FILE" <<'PY'
from __future__ import annotations

import json
import sys

for metadata_path in sys.argv[1:]:
    with open(metadata_path, encoding="utf-8") as handle:
        metadata = json.load(handle)
    for logical_name, image in metadata["images"].items():
        print(f"{logical_name}\t{image['env_var']}\t{image['source_ref']}\t{image['local_tag']}")
PY
}

ensure_images_ready() {
  while IFS=$'\t' read -r logical_name _env_var source_ref local_tag; do
    [[ -n "$logical_name" ]] || continue

    if docker image inspect "$local_tag" >/dev/null 2>&1; then
      log_info "ready: ${logical_name} -> ${local_tag}"
      continue
    fi

    if docker image inspect "$source_ref" >/dev/null 2>&1; then
      docker tag "$source_ref" "$local_tag"
      log_info "retagged: ${logical_name} -> ${local_tag}"
      continue
    fi

    die "image missing after load: ${logical_name} (${local_tag}). Re-download the bundle and retry."
  done < <(emit_manifest_images)
}

validate_compose_images_local_only() {
  local compose_output
  compose_output="$(
    cd "$ROOT_DIR"
    docker compose config
  )"

  COMPOSE_CONFIG="$compose_output" python3 - "$SERVICES_METADATA_FILE" "$SCANNER_METADATA_FILE" <<'PY'
from __future__ import annotations

import json
import os
import re
import sys

allowed: set[str] = set()
for metadata_path in sys.argv[1:]:
    with open(metadata_path, encoding="utf-8") as handle:
        metadata = json.load(handle)
    for image in metadata["images"].values():
        allowed.add(str(image["local_tag"]).strip())

violations: list[str] = []
for line in os.environ.get("COMPOSE_CONFIG", "").splitlines():
    match = re.match(r"^\s*image:\s*(\S+)\s*$", line)
    if not match:
        continue
    image_ref = match.group(1).strip()
    if image_ref not in allowed:
        violations.append(image_ref)

if violations:
    raise SystemExit("compose images not covered by services/scanner bundles: " + ", ".join(violations))
PY
}

compose() {
  (
    cd "$ROOT_DIR"
    docker compose "$@"
  )
}

service_cid() {
  compose ps -q "$1"
}

service_status() {
  local cid="$1"
  [[ -n "$cid" ]] || {
    printf 'missing'
    return 0
  }
  docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || printf 'unknown'
}

service_health() {
  local cid="$1"
  [[ -n "$cid" ]] || {
    printf 'missing'
    return 0
  }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || printf 'unknown'
}

probe_frontend_url() {
  local url="$1"
  compose exec -T frontend sh -lc "wget -q -O- '$url' >/dev/null"
}

emit_failure_hints() {
  local logs="$1"
  log_warn "Hint: a release tree is only ready after backend health, frontend /, and proxied /api/v1/openapi.json all succeed."
  if grep -Eiq 'offline runner image unavailable|pull failed for|image missing after load' <<<"$logs"; then
    log_warn "Hint: runner images are missing from the offline bundles. Rebuild and reload both services/scanner image bundles."
  else
    log_warn "Hint: if logs mention 'offline runner image unavailable' or 'pull failed for', rebuild and reload both offline bundles."
  fi
  if grep -Eiq 'runner preflight|preflight' <<<"$logs"; then
    log_warn "Hint: runner preflight is blocking backend readiness. Review the backend preflight errors before retrying."
  else
    log_warn "Hint: if backend startup stalls before /health turns green, inspect runner preflight output first."
  fi
  if grep -Eiq 'Docker socket access was denied|permission denied|permissionerror' <<<"$logs"; then
    log_warn "Hint: Docker socket access failed. Ensure DOCKER_SOCKET_GID matches the host docker.sock group."
  else
    log_warn "Hint: if logs mention 'Docker socket access was denied', set DOCKER_SOCKET_GID to the host docker.sock group."
  fi
  if grep -Eiq '数据库迁移版本与代码不一致|alembic' <<<"$logs"; then
    log_warn "Hint: database migration state is behind the code. Repair the DB migration state before retrying."
  else
    log_warn "Hint: if logs mention '数据库迁移版本与代码不一致' or Alembic failures, repair the database migration state."
  fi
}

wait_for_backend_readiness() {
  local max_attempts="${OFFLINE_UP_MAX_ATTEMPTS:-60}"
  local retry_delay="${OFFLINE_UP_RETRY_DELAY_SECONDS:-5}"
  local attempt=0

  while (( attempt < max_attempts )); do
    attempt=$((attempt + 1))
    local backend_cid backend_status_value backend_health_value
    backend_cid="$(service_cid backend)"
    backend_status_value="$(service_status "$backend_cid")"
    backend_health_value="$(service_health "$backend_cid")"

    if [[ "$backend_status_value" == "running" ]] && \
       [[ "$backend_health_value" == "healthy" ]]; then
      return 0
    fi

    if [[ "$backend_status_value" == "exited" || "$backend_status_value" == "dead" || "$backend_health_value" == "unhealthy" ]]; then
      break
    fi

    sleep "$retry_delay"
  done

  return 1
}

wait_for_frontend_readiness() {
  local max_attempts="${OFFLINE_UP_MAX_ATTEMPTS:-60}"
  local retry_delay="${OFFLINE_UP_RETRY_DELAY_SECONDS:-5}"
  local attempt=0

  while (( attempt < max_attempts )); do
    attempt=$((attempt + 1))
    local backend_cid frontend_cid backend_status_value backend_health_value frontend_status_value
    backend_cid="$(service_cid backend)"
    frontend_cid="$(service_cid frontend)"
    backend_status_value="$(service_status "$backend_cid")"
    backend_health_value="$(service_health "$backend_cid")"
    frontend_status_value="$(service_status "$frontend_cid")"

    if [[ "$backend_status_value" == "running" ]] && \
       [[ "$backend_health_value" == "healthy" ]] && \
       [[ "$frontend_status_value" == "running" ]] && \
       probe_frontend_url "http://backend:8000/health" && \
       probe_frontend_url "http://127.0.0.1/" && \
       probe_frontend_url "http://127.0.0.1/api/v1/openapi.json"; then
      return 0
    fi

    if [[ "$backend_status_value" == "exited" || "$backend_status_value" == "dead" || "$backend_health_value" == "unhealthy" || "$frontend_status_value" == "exited" || "$frontend_status_value" == "dead" ]]; then
      break
    fi

    sleep "$retry_delay"
  done

  return 1
}

parse_and_export_offline_env() {
  local line_no=0 raw_line trimmed_line raw_name name value

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    ((line_no += 1))
    raw_line="${raw_line%$'\r'}"
    if [[ $line_no -eq 1 ]]; then
      raw_line="${raw_line#$'\357\273\277'}"
    fi

    trimmed_line="$(trim "$raw_line")"
    [[ -z "$trimmed_line" ]] && continue
    [[ "${trimmed_line:0:1}" == "#" ]] && continue

    if [[ "$trimmed_line" == export[[:space:]]* ]]; then
      die "unsupported env syntax in ${OFFLINE_ENV_FILE#$ROOT_DIR/}:$line_no"
    fi
    if [[ "$raw_line" != *"="* ]]; then
      die "unsupported env syntax in ${OFFLINE_ENV_FILE#$ROOT_DIR/}:$line_no"
    fi

    raw_name="${raw_line%%=*}"
    value="${raw_line#*=}"
    name="$(trim "$raw_name")"

    [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "unsupported env key in ${OFFLINE_ENV_FILE#$ROOT_DIR/}:$line_no"
    [[ "$value" != *'$('* ]] || die "unsupported env syntax in ${OFFLINE_ENV_FILE#$ROOT_DIR/}:$line_no"
    [[ "$value" != *'`'* ]] || die "unsupported env syntax in ${OFFLINE_ENV_FILE#$ROOT_DIR/}:$line_no"

    export "$name=$value"
  done < "$OFFLINE_ENV_FILE"
}

ensure_compose_ready() {
  docker compose version >/dev/null 2>&1 || die "docker compose not found or unavailable"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --attach-logs)
        ATTACH_LOGS="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  require_command docker
  require_command python3
  [[ -f "$SERVICES_METADATA_FILE" ]] || die "images manifest not found: $SERVICES_METADATA_FILE"
  [[ -f "$SCANNER_METADATA_FILE" ]] || die "images manifest not found: $SCANNER_METADATA_FILE"
  [[ -f "$COMPOSE_ENV_HELPER" ]] || die "missing compose env helper: $COMPOSE_ENV_HELPER"

  ensure_file_from_example \
    "$BACKEND_ENV_FILE" \
    "$BACKEND_ENV_EXAMPLE" \
    "backend env file" \
    "Review at least LLM_API_KEY, LLM_PROVIDER, and LLM_MODEL before relying on this deployment."
  ensure_file_from_example \
    "$OFFLINE_ENV_FILE" \
    "$OFFLINE_ENV_EXAMPLE" \
    "offline env file" \
    "The generated offline env usually needs no edits unless you want custom image overrides."

  ensure_compose_ready

  # shellcheck disable=SC1090
  source "$COMPOSE_ENV_HELPER"
  load_container_socket_env
  load_container_socket_gid_env

  local arch services_bundle scanner_bundle
  arch="$(detect_server_arch)"
  log_info "detected architecture: $arch"
  services_bundle="$(prevalidate_bundle "services" "$arch")"
  scanner_bundle="$(prevalidate_bundle "scanner" "$arch")"

  [[ -n "${DOCKER_SOCKET_PATH:-}" ]] && log_info "detected Docker socket path: ${DOCKER_SOCKET_PATH}"
  [[ -n "${DOCKER_SOCKET_GID:-}" ]] && log_info "detected Docker socket gid: ${DOCKER_SOCKET_GID}"

  load_bundle "$services_bundle"
  load_bundle "$scanner_bundle"
  ensure_images_ready
  parse_and_export_offline_env
  validate_compose_images_local_only

  log_info "starting docker compose up -d db redis backend"
  compose up -d db redis backend

  if ! wait_for_backend_readiness; then
    log_warn "release readiness probe failed"
    compose ps || true
    logs_output="$(compose logs backend frontend --tail=100 2>&1 || true)"
    printf '%s\n' "$logs_output" >&2
    emit_failure_hints "$logs_output"
    die "release services failed readiness checks"
  fi

  if [[ "$ATTACH_LOGS" == "true" ]]; then
    log_info "backend is healthy; attaching startup logs with docker compose up"
    compose up
    return 0
  fi

  log_info "starting docker compose up -d frontend"
  compose up -d frontend

  if ! wait_for_frontend_readiness; then
    log_warn "release readiness probe failed"
    compose ps || true
    logs_output="$(compose logs backend frontend --tail=100 2>&1 || true)"
    printf '%s\n' "$logs_output" >&2
    emit_failure_hints "$logs_output"
    die "release services failed readiness checks"
  fi

  log_info "offline startup ready"
}

main "$@"
