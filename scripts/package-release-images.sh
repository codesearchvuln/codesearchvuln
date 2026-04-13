#!/usr/bin/env bash

set -euo pipefail

IMAGE_MANIFEST=""
OUTPUT_DIR=""

usage() {
  cat <<'USAGE'
Usage: package-release-images.sh --image-manifest <file> --output-dir <dir>

Create per-architecture offline runtime image bundles for release distribution.
USAGE
}

die() {
  echo "[release-images] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-manifest)
      IMAGE_MANIFEST="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
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

[[ -n "$IMAGE_MANIFEST" ]] || die "--image-manifest is required"
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir is required"
[[ -f "$IMAGE_MANIFEST" ]] || die "image manifest not found: $IMAGE_MANIFEST"
command -v docker >/dev/null 2>&1 || die "docker is required"
command -v zstd >/dev/null 2>&1 || die "zstd is required"

OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
IMAGE_MANIFEST="$(cd "$(dirname "$IMAGE_MANIFEST")" && pwd)/$(basename "$IMAGE_MANIFEST")"

python3 - "$IMAGE_MANIFEST" "$OUTPUT_DIR" <<'PY'
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


manifest_path = Path(sys.argv[1])
output_dir = Path(sys.argv[2])
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
revision = str(manifest["revision"]).strip()
if not revision:
    raise SystemExit("release manifest revision is required")

contracts = {
    "backend": "vulhunter-local/backend",
    "static_frontend": "vulhunter-local/static-frontend-nginx",
    "sandbox": "vulhunter-local/sandbox",
    "sandbox_runner": "vulhunter-local/sandbox-runner",
    "scanner_yasa": "vulhunter-local/yasa-runner",
    "scanner_opengrep": "vulhunter-local/opengrep-runner",
    "scanner_bandit": "vulhunter-local/bandit-runner",
    "scanner_gitleaks": "vulhunter-local/gitleaks-runner",
    "scanner_phpstan": "vulhunter-local/phpstan-runner",
    "scanner_pmd": "vulhunter-local/pmd-runner",
    "flow_parser_runner": "vulhunter-local/flow-parser-runner",
}

images: list[tuple[str, str, str]] = []
for logical_name, local_repo in contracts.items():
    if logical_name == "static_frontend":
        ref = "docker.m.daocloud.io/library/nginx:1.27-alpine"
    else:
        ref = str(manifest["images"][logical_name]["ref"]).strip()
        if not ref:
            raise SystemExit(f"missing required image ref: {logical_name}")
    images.append((logical_name, ref, f"{local_repo}:{revision}"))

for arch in ("amd64", "arm64"):
    bundle_path = output_dir / f"vulhunter-images-{arch}.tar.zst"
    metadata_path = output_dir / f"images-manifest-{arch}.json"
    local_tags = [local_tag for _, _, local_tag in images]

    for logical_name, source_ref, local_tag in images:
        subprocess.run(["docker", "pull", "--platform", f"linux/{arch}", source_ref], check=True)
        subprocess.run(["docker", "tag", source_ref, local_tag], check=True)

    save_cmd = ["docker", "save", *local_tags]
    save_proc = subprocess.Popen(save_cmd, stdout=subprocess.PIPE)
    zstd_proc = subprocess.Popen(
        ["zstd", "-T0", "-19", "-q", "-o", str(bundle_path)],
        stdin=save_proc.stdout,
    )
    assert save_proc.stdout is not None
    save_proc.stdout.close()
    save_rc = save_proc.wait()
    zstd_rc = zstd_proc.wait()
    if save_rc != 0 or zstd_rc != 0:
        raise SystemExit(f"failed to package images for {arch}")

    bundle_sha256 = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
    metadata = {
        "revision": revision,
        "architecture": arch,
        "bundle_file": bundle_path.name,
        "bundle_sha256": bundle_sha256,
        "images": {
            logical_name: {
                "source_ref": source_ref,
                "local_tag": local_tag,
            }
            for logical_name, source_ref, local_tag in images
        },
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    cleanup_targets = [target for image in images for target in (image[2], image[1])]
    subprocess.run(["docker", "image", "rm", "-f", *cleanup_targets], check=False)
PY
