#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES_METADATA_FILE="${SERVICES_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-services.json}"
SCANNER_METADATA_FILE="${SCANNER_IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest-scanner.json}"

die() {
  echo "[offline-images] $*" >&2
  exit 1
}

detect_arch() {
  local machine
  machine="$(uname -m)"
  case "$machine" in
    x86_64|amd64)
      printf 'amd64'
      ;;
    aarch64|arm64)
      printf 'arm64'
      ;;
    *)
      die "unsupported architecture: $machine"
      ;;
  esac
}

find_bundle() {
  local bundle="$1"
  local arch="$2"
  # Expected bundle names:
  # - vulhunter-services-images-${arch}.tar.zst
  # - vulhunter-scanner-images-${arch}.tar.zst
  local candidates=(
    "$ROOT_DIR/images/vulhunter-${bundle}-images-${arch}.tar.zst"
    "$ROOT_DIR/vulhunter-${bundle}-images-${arch}.tar.zst"
    "$ROOT_DIR/images/vulhunter-${bundle}-images-${arch}.tar"
    "$ROOT_DIR/vulhunter-${bundle}-images-${arch}.tar"
  )
  local path

  for path in "${candidates[@]}"; do
    if [[ -f "$path" ]]; then
      printf '%s' "$path"
      return 0
    fi
  done

  return 1
}

[[ -f "$SERVICES_METADATA_FILE" ]] || die "images manifest not found: $SERVICES_METADATA_FILE"
[[ -f "$SCANNER_METADATA_FILE" ]] || die "images manifest not found: $SCANNER_METADATA_FILE"

ARCH="$(detect_arch)"
SERVICES_BUNDLE_PATH="$(find_bundle "services" "$ARCH" || true)"
SCANNER_BUNDLE_PATH="$(find_bundle "scanner" "$ARCH" || true)"
[[ -n "$SERVICES_BUNDLE_PATH" ]] || die "offline image bundle not found for ${ARCH}. Download vulhunter-services-images-${ARCH}.tar.zst into ./images or the release root."
[[ -n "$SCANNER_BUNDLE_PATH" ]] || die "offline image bundle not found for ${ARCH}. Download vulhunter-scanner-images-${ARCH}.tar.zst into ./images or the release root."

for BUNDLE_PATH in "$SERVICES_BUNDLE_PATH" "$SCANNER_BUNDLE_PATH"; do
echo "[offline-images] loading bundle: ${BUNDLE_PATH}"
case "$BUNDLE_PATH" in
  *.tar.zst)
    command -v zstd >/dev/null 2>&1 || die "zstd is required to load ${BUNDLE_PATH}"
    zstd -dc "$BUNDLE_PATH" | docker load
    ;;
  *.tar)
    docker load -i "$BUNDLE_PATH"
    ;;
  *)
    die "unsupported bundle format: $BUNDLE_PATH"
    ;;
esac
done

python3 - "$SERVICES_METADATA_FILE" "$SCANNER_METADATA_FILE" <<'PY' | while IFS=$'\t' read -r logical_name source_ref local_tag; do
from __future__ import annotations

import json
import sys


for metadata_path in sys.argv[1:]:
    metadata = json.load(open(metadata_path, encoding="utf-8"))
    for logical_name, image in metadata["images"].items():
        print(f"{logical_name}\t{image['source_ref']}\t{image['local_tag']}")
PY
  if docker image inspect "$local_tag" >/dev/null 2>&1; then
    echo "[offline-images] ready: ${logical_name} -> ${local_tag}"
    continue
  fi

  if docker image inspect "$source_ref" >/dev/null 2>&1; then
    docker tag "$source_ref" "$local_tag"
    echo "[offline-images] retagged: ${logical_name} -> ${local_tag}"
    continue
  fi

  die "image missing after load: ${logical_name} (${local_tag}). Re-download the bundle and retry."
done

echo "[offline-images] all offline images are ready for ${ARCH}"
