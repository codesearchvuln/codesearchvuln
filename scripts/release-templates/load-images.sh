#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METADATA_FILE="${IMAGES_MANIFEST_PATH:-$ROOT_DIR/images-manifest.json}"

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
  local arch="$1"
  local candidates=(
    "$ROOT_DIR/images/vulhunter-images-${arch}.tar.zst"
    "$ROOT_DIR/vulhunter-images-${arch}.tar.zst"
    "$ROOT_DIR/images/vulhunter-images-${arch}.tar"
    "$ROOT_DIR/vulhunter-images-${arch}.tar"
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

[[ -f "$METADATA_FILE" ]] || die "images manifest not found: $METADATA_FILE"

ARCH="$(detect_arch)"
BUNDLE_PATH="$(find_bundle "$ARCH" || true)"
[[ -n "$BUNDLE_PATH" ]] || die "offline image bundle not found for ${ARCH}. Download vulhunter-images-${ARCH}.tar.zst into ./images or the release root."

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

python3 - "$METADATA_FILE" <<'PY' | while IFS=$'\t' read -r logical_name source_ref local_tag; do
from __future__ import annotations

import json
import sys


metadata = json.load(open(sys.argv[1], encoding="utf-8"))
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
