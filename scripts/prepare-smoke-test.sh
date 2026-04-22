#!/usr/bin/env bash
set -euo pipefail

die() {
  echo "::error::$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash scripts/prepare-smoke-test.sh \
         --release-tree <dir> --snapshot-assets <dir>

Detects the Docker server architecture, reads the release-snapshot-lock.json
from the release tree, and copies the matching image bundles into the release
tree's images/ directory so that offline-up.sh can load them.
EOF
}

RELEASE_TREE=""
SNAPSHOT_ASSETS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-tree)
      RELEASE_TREE="$2"
      shift 2
      ;;
    --snapshot-assets)
      SNAPSHOT_ASSETS="$2"
      shift 2
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

[[ -n "$RELEASE_TREE" ]] || die "--release-tree is required"
[[ -n "$SNAPSHOT_ASSETS" ]] || die "--snapshot-assets is required"
[[ -d "$RELEASE_TREE" ]] || die "release tree not found: $RELEASE_TREE"
[[ -d "$SNAPSHOT_ASSETS" ]] || die "snapshot assets not found: $SNAPSHOT_ASSETS"

LOCK_FILE="$RELEASE_TREE/release-snapshot-lock.json"
[[ -f "$LOCK_FILE" ]] || die "release-snapshot-lock.json not found in release tree: $LOCK_FILE"

docker_server_arch="$(docker version --format '{{.Server.Arch}}' | tr -d '\r' | tail -n 1)"
case "$(printf '%s' "$docker_server_arch" | tr '[:upper:]' '[:lower:]')" in
  amd64|x86_64)
    smoke_arch="amd64"
    ;;
  arm64|aarch64)
    smoke_arch="arm64"
    ;;
  *)
    die "unsupported Docker server architecture for smoke test: $docker_server_arch"
    ;;
esac

mapfile -t bundle_assets < <(
  python3 - "$LOCK_FILE" "$smoke_arch" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

lock_path = Path(sys.argv[1])
arch = sys.argv[2]
lock_payload = json.loads(lock_path.read_text(encoding="utf-8"))

for bundle in ("services", "scanner"):
    entry = lock_payload.get("bundles", {}).get(bundle, {}).get(arch)
    if not isinstance(entry, dict):
        raise SystemExit(f"missing lock entry bundles/{bundle}/{arch}: {lock_path}")
    asset_name = str(entry.get("asset_name") or "").strip()
    if not asset_name:
        raise SystemExit(f"missing asset_name for {bundle}/{arch}: {lock_path}")
    print(asset_name)
PY
)

[[ "${#bundle_assets[@]}" -eq 2 ]] || die "expected exactly two smoke-test bundle assets for ${smoke_arch}, got ${#bundle_assets[@]}"

mkdir -p "$RELEASE_TREE/images"
for asset_name in "${bundle_assets[@]}"; do
  cp --reflink=auto "$SNAPSHOT_ASSETS/$asset_name" "$RELEASE_TREE/images/$asset_name"
done
