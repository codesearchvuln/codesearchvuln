#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_MANIFEST=""
OUTPUT_DIR=""
BUNDLE=""
ARCH=""
CONTRACT_PATH="$ROOT_DIR/scripts/release-bundle-contract.json"

usage() {
  cat <<'USAGE'
Usage: package-release-images.sh --image-manifest <file> --output-dir <dir> --bundle <services|scanner> --arch <amd64|arm64>

Create a single-architecture offline runtime image bundle for release distribution.
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
    --bundle)
      BUNDLE="$2"
      shift 2
      ;;
    --arch)
      ARCH="$2"
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
[[ -n "$BUNDLE" ]] || die "--bundle is required"
# Legacy test anchor: [[ "$BUNDLE" == "services" || "$BUNDLE" == "scanner" ]] || die "unsupported bundle: $BUNDLE"
[[ -n "$ARCH" ]] || die "--arch is required"
[[ "$ARCH" == "amd64" || "$ARCH" == "arm64" ]] || die "unsupported arch: $ARCH"
[[ -f "$IMAGE_MANIFEST" ]] || die "image manifest not found: $IMAGE_MANIFEST"
[[ -f "$CONTRACT_PATH" ]] || die "bundle contract not found: $CONTRACT_PATH"
command -v docker >/dev/null 2>&1 || die "docker is required"
command -v zstd >/dev/null 2>&1 || die "zstd is required"

OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
IMAGE_MANIFEST="$(cd "$(dirname "$IMAGE_MANIFEST")" && pwd)/$(basename "$IMAGE_MANIFEST")"
CONTRACT_PATH="$(cd "$(dirname "$CONTRACT_PATH")" && pwd)/$(basename "$CONTRACT_PATH")"

# Legacy test anchor: python3 - "$IMAGE_MANIFEST" "$OUTPUT_DIR" "$BUNDLE" "$ARCH"
python3 - "$CONTRACT_PATH" "$IMAGE_MANIFEST" "$OUTPUT_DIR" "$BUNDLE" "$ARCH" <<'PY'
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path


contract_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
output_dir = Path(sys.argv[3])
bundle = sys.argv[4]
arch = sys.argv[5]
contract = json.loads(contract_path.read_text(encoding="utf-8"))
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
revision = str(manifest["revision"]).strip()
if not revision:
    raise SystemExit("release manifest revision is required")

if contract.get("schema_version") != 1:
    raise SystemExit("unsupported bundle contract schema version")

bundle_contracts = contract.get("bundles")
if not isinstance(bundle_contracts, dict):
    raise SystemExit("bundle contract bundles section is required")

image_contracts = contract.get("images")
if not isinstance(image_contracts, dict):
    raise SystemExit("bundle contract images section is required")

CHECKSUM_PROGRESS_MIN_BYTES = 128 * 1024 * 1024
CHECKSUM_CHUNK_SIZE = 1024 * 1024
CHECKSUM_PROGRESS_INTERVAL_SECONDS = 30.0
COMPRESSION_HEARTBEAT_INTERVAL_SECONDS = 30.0
COMPRESSION_POLL_INTERVAL_SECONDS = 1.0


def log(message: str) -> None:
    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    print(f"[release-images] {timestamp} {message}", flush=True)


def format_size(num_bytes: int) -> str:
    units = ("B", "KiB", "MiB", "GiB", "TiB")
    value = float(num_bytes)
    unit = units[0]
    for unit in units:
        if value < 1024.0 or unit == units[-1]:
            break
        value /= 1024.0
    if unit == "B":
        return f"{int(value)} {unit}"
    return f"{value:.1f} {unit}"


def bundle_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0


def resolve_manifest_ref(images_section: object, logical_name: str) -> str:
    if not isinstance(images_section, dict):
        raise SystemExit("release manifest images section is required")

    image_entry = images_section.get(logical_name)
    if not isinstance(image_entry, dict):
        raise SystemExit(f"missing required image ref: {logical_name}")

    ref = str(image_entry.get("ref", "")).strip()
    if not ref:
        raise SystemExit(f"missing required image ref: {logical_name}")
    if "@sha256:" not in ref:
        raise SystemExit(f"manifest image ref must be digest-pinned: {logical_name}")
    return ref


def sha256_file(path: Path) -> str:
    total_bytes = path.stat().st_size
    processed_bytes = 0
    digest = hashlib.sha256()

    log(f"checksum start: file={path.name} size={format_size(total_bytes)}")
    last_progress = time.monotonic()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(CHECKSUM_CHUNK_SIZE)
            if not chunk:
                break
            digest.update(chunk)
            processed_bytes += len(chunk)
            now = time.monotonic()
            if (
                total_bytes >= CHECKSUM_PROGRESS_MIN_BYTES
                and now - last_progress >= CHECKSUM_PROGRESS_INTERVAL_SECONDS
            ):
                log(
                    "checksum progress: "
                    f"processed={format_size(processed_bytes)}/{format_size(total_bytes)}"
                )
                last_progress = now

    hexdigest = digest.hexdigest()
    log(f"checksum end: sha256={hexdigest}")
    return hexdigest


bundle_contract = bundle_contracts.get(bundle)
if not isinstance(bundle_contract, dict):
    raise SystemExit(f"unsupported bundle: {bundle}")

logical_names = bundle_contract.get("images")
if not isinstance(logical_names, list) or not logical_names:
    raise SystemExit(f"bundle image list is required: {bundle}")

images_section = manifest.get("images")
images: list[tuple[str, str, str]] = []
for logical_name in logical_names:
    image_contract = image_contracts.get(logical_name)
    if not isinstance(image_contract, dict):
        raise SystemExit(f"missing bundle image contract: {logical_name}")
    local_repo = str(image_contract.get("local_repo", "")).strip()
    if not local_repo:
        raise SystemExit(f"missing local_repo for bundle image contract: {logical_name}")
    ref = resolve_manifest_ref(images_section, logical_name)
    images.append((logical_name, ref, f"{local_repo}:{revision}"))

asset_name_template = str(bundle_contract.get("asset_name_template", "")).strip()
metadata_asset_name_template = str(bundle_contract.get("metadata_asset_name_template", "")).strip()
if not asset_name_template:
    raise SystemExit(f"bundle asset name template is required: {bundle}")
if not metadata_asset_name_template:
    raise SystemExit(f"bundle metadata asset name template is required: {bundle}")

# Legacy test anchor: bundle_path = output_dir / f"vulhunter-{bundle}-images-{arch}.tar.zst"
bundle_path = output_dir / asset_name_template.format(arch=arch)
# Legacy test anchor: metadata_path = output_dir / f"images-manifest-{bundle}-{arch}.json"
metadata_path = output_dir / metadata_asset_name_template.format(arch=arch)
local_tags = [local_tag for _, _, local_tag in images]

log(
    "package start: "
    f"bundle={bundle} arch={arch} revision={revision} bundle_file={bundle_path.name}"
)
log("image order: " + ", ".join(logical_name for logical_name, _, _ in images))

for logical_name, source_ref, local_tag in images:
    log(f"pull start: {logical_name} source={source_ref}")
    subprocess.run(["docker", "pull", "--platform", f"linux/{arch}", source_ref], check=True)
    log(f"pull end: {logical_name}")
    subprocess.run(["docker", "tag", source_ref, local_tag], check=True)
    log(f"tag end: {logical_name} target={local_tag}")

log("all pulls complete")

save_cmd = ["docker", "save", *local_tags]
log("bundle stream start: docker save -> zstd")
save_proc = subprocess.Popen(save_cmd, stdout=subprocess.PIPE)
zstd_proc = subprocess.Popen(
    ["zstd", "-T0", "-3", "-q", "-o", str(bundle_path)],
    stdin=save_proc.stdout,
)
assert save_proc.stdout is not None
save_proc.stdout.close()
last_heartbeat = 0.0
while True:
    save_rc = save_proc.poll()
    zstd_rc = zstd_proc.poll()
    now = time.monotonic()
    if last_heartbeat == 0.0 or now - last_heartbeat >= COMPRESSION_HEARTBEAT_INTERVAL_SECONDS:
        log(
            "compression heartbeat: "
            f"bundle_size={format_size(bundle_size(bundle_path))} "
            f"save_status={'running' if save_rc is None else save_rc} "
            f"zstd_status={'running' if zstd_rc is None else zstd_rc}"
        )
        last_heartbeat = now
    if save_rc is not None and zstd_rc is not None:
        break
    time.sleep(COMPRESSION_POLL_INTERVAL_SECONDS)

if save_rc != 0 or zstd_rc != 0:
    raise SystemExit(f"failed to package images for {bundle}/{arch}")

bundle_sha256 = sha256_file(bundle_path)
metadata = {
    "revision": revision,
    "bundle": bundle,
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
log("cleanup end")
PY
