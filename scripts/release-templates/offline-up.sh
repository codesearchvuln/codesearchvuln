#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICES_METADATA_FILE="${SERVICES_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-services.json}"
SCANNER_METADATA_FILE="${SCANNER_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-scanner.json}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/docker/env/backend/.env}"
BACKEND_ENV_EXAMPLE="${BACKEND_ENV_EXAMPLE:-$ROOT_DIR/docker/env/backend/env.example}"
OFFLINE_ENV_FILE="${OFFLINE_ENV_FILE:-$ROOT_DIR/docker/env/backend/offline-images.env}"
OFFLINE_ENV_EXAMPLE="${OFFLINE_ENV_EXAMPLE:-$ROOT_DIR/docker/env/backend/offline-images.env.example}"
COMPOSE_ENV_HELPER="${COMPOSE_ENV_HELPER:-$ROOT_DIR/scripts/lib/compose-env.sh}"

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

select_bundle_path() {
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

  die "offline image bundle not found for ${bundle}/${arch}. Expected vulhunter-${bundle}-images-${arch}.tar.zst or .tar in the release root or images/."
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

main() {
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
  services_bundle="$(select_bundle_path "services" "$arch")"
  scanner_bundle="$(select_bundle_path "scanner" "$arch")"

  [[ -n "${DOCKER_SOCKET_PATH:-}" ]] && log_info "detected Docker socket path: ${DOCKER_SOCKET_PATH}"
  [[ -n "${DOCKER_SOCKET_GID:-}" ]] && log_info "detected Docker socket gid: ${DOCKER_SOCKET_GID}"

  load_bundle "$services_bundle"
  load_bundle "$scanner_bundle"
  ensure_images_ready
  parse_and_export_offline_env

  log_info "starting docker compose up -d"
  (
    cd "$ROOT_DIR"
    docker compose up -d
  )
  log_info "offline startup ready"
}

main "$@"
