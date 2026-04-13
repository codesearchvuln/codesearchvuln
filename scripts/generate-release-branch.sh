#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR"
OUTPUT_DIR=""
IMAGE_MANIFEST=""
VALIDATE="false"
ALLOWLIST_PATH="$ROOT_DIR/scripts/release-allowlist.txt"
TEMPLATE_DIR="$ROOT_DIR/scripts/release-templates"

usage() {
  cat <<'USAGE'
Usage: generate-release-branch.sh --output <dir> --image-manifest <file> [--source <dir>] [--validate]

Generate an image-only runtime release tree from the checked-out repository.
The output intentionally excludes backend/frontend source code, local-build compose
overlays, Dockerfiles, and other development-only assets.

Options:
  --output <dir>           Required. Destination directory for the generated release tree.
  --image-manifest <file>  Required. JSON manifest with digest-pinned runtime image refs.
  --source <dir>           Override the source repository root. Defaults to the current checkout.
  --validate               Validate the generated tree after copying.
  -h, --help               Show this help text.
USAGE
}

log() {
  echo "[release-tree] $*"
}

die() {
  echo "[release-tree] $*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

copy_allowlisted_entry() {
  local raw_line="$1"
  local src_rel dest_rel src_abs dest_abs

  if [[ "$raw_line" == *"=>"* ]]; then
    src_rel="$(trim "${raw_line%%=>*}")"
    dest_rel="$(trim "${raw_line#*=>}")"
  else
    src_rel="$(trim "$raw_line")"
    dest_rel="$src_rel"
  fi

  [[ -n "$src_rel" ]] || return 0

  src_abs="$SOURCE_DIR/$src_rel"
  dest_abs="$OUTPUT_DIR/$dest_rel"

  [[ -e "$src_abs" ]] || die "allowlisted path does not exist: $src_rel"

  mkdir -p "$(dirname "$dest_abs")"
  cp -R "$src_abs" "$dest_abs"
}

clean_generated_tree() {
  find "$OUTPUT_DIR" \
    \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' \) \
    -exec rm -rf {} +
  find "$OUTPUT_DIR" \
    \( -name '*.pyc' -o -name '*.pyo' -o -name '.DS_Store' \) \
    -delete
}

prune_nexus_runtime_bundle() {
  local bundle_root="$1"

  [[ -d "$bundle_root" ]] || return 0

  find "$bundle_root" -mindepth 1 -maxdepth 1 ! -name dist ! -name nginx.conf -exec rm -rf {} +

  [[ -d "$bundle_root/dist" ]] || die "nexus runtime bundle missing dist directory: ${bundle_root#$OUTPUT_DIR/}"
  [[ -f "$bundle_root/nginx.conf" ]] || die "nexus runtime bundle missing nginx.conf: ${bundle_root#$OUTPUT_DIR/}"
}

render_release_compose() {
  python3 - "$IMAGE_MANIFEST" "$TEMPLATE_DIR/docker-compose.release-slim.yml" "$OUTPUT_DIR/docker-compose.yml" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path


manifest_path = Path(sys.argv[1])
template_path = Path(sys.argv[2])
output_path = Path(sys.argv[3])

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

required_keys = {
    "backend": "__BACKEND_IMAGE_REF__",
    "frontend": "__FRONTEND_IMAGE_REF__",
    "sandbox": "__SANDBOX_IMAGE_REF__",
    "sandbox_runner": "__SANDBOX_RUNNER_IMAGE_REF__",
    "scanner_yasa": "__SCANNER_YASA_IMAGE_REF__",
    "scanner_opengrep": "__SCANNER_OPENGREP_IMAGE_REF__",
    "scanner_bandit": "__SCANNER_BANDIT_IMAGE_REF__",
    "scanner_gitleaks": "__SCANNER_GITLEAKS_IMAGE_REF__",
    "scanner_phpstan": "__SCANNER_PHPSTAN_IMAGE_REF__",
    "scanner_pmd": "__SCANNER_PMD_IMAGE_REF__",
    "flow_parser_runner": "__FLOW_PARSER_RUNNER_IMAGE_REF__",
}


def get_ref(logical_name: str) -> str:
    try:
        value = str(manifest["images"][logical_name]["ref"]).strip()
    except Exception as exc:  # pragma: no cover - defensive error path
        raise SystemExit(f"missing required image ref: {logical_name}") from exc

    if not value:
        raise SystemExit(f"missing required image ref: {logical_name}")
    if "@sha256:" not in value:
        raise SystemExit(f"image ref must be digest-pinned: {logical_name}")
    return value


compose_text = template_path.read_text(encoding="utf-8")
for logical_name, placeholder in required_keys.items():
    compose_text = compose_text.replace(placeholder, get_ref(logical_name))

leftovers = [placeholder for placeholder in required_keys.values() if placeholder in compose_text]
if leftovers:
    raise SystemExit(f"unrendered release compose placeholders: {', '.join(leftovers)}")

output_path.write_text(compose_text, encoding="utf-8")
PY
}

overlay_release_templates() {
  mkdir -p \
    "$OUTPUT_DIR/scripts" \
    "$OUTPUT_DIR/docker" \
    "$OUTPUT_DIR/docker/env/backend"

  cp "$TEMPLATE_DIR/README.md" "$OUTPUT_DIR/README.md"
  cp "$TEMPLATE_DIR/README_EN.md" "$OUTPUT_DIR/README_EN.md"
  cp "$TEMPLATE_DIR/README-COMPOSE.md" "$OUTPUT_DIR/scripts/README-COMPOSE.md"
  cp "$TEMPLATE_DIR/load-images.sh" "$OUTPUT_DIR/scripts/load-images.sh"
  cp "$TEMPLATE_DIR/use-offline-env.sh" "$OUTPUT_DIR/scripts/use-offline-env.sh"
  chmod +x "$OUTPUT_DIR/scripts/load-images.sh" "$OUTPUT_DIR/scripts/use-offline-env.sh"
  render_release_compose
  python3 - "$IMAGE_MANIFEST" "$OUTPUT_DIR/images-manifest.json" "$OUTPUT_DIR/docker/env/backend/offline-images.env.example" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path


manifest_path = Path(sys.argv[1])
metadata_path = Path(sys.argv[2])
offline_env_path = Path(sys.argv[3])

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
revision = str(manifest["revision"]).strip()
if not revision:
    raise SystemExit("release manifest revision is required")

image_contracts = {
    "backend": ("BACKEND_IMAGE", "vulhunter-local/backend"),
    "frontend": ("FRONTEND_IMAGE", "vulhunter-local/frontend"),
    "sandbox": ("SANDBOX_IMAGE", "vulhunter-local/sandbox"),
    "sandbox_runner": ("SANDBOX_RUNNER_IMAGE", "vulhunter-local/sandbox-runner"),
    "scanner_yasa": ("SCANNER_YASA_IMAGE", "vulhunter-local/yasa-runner"),
    "scanner_opengrep": ("SCANNER_OPENGREP_IMAGE", "vulhunter-local/opengrep-runner"),
    "scanner_bandit": ("SCANNER_BANDIT_IMAGE", "vulhunter-local/bandit-runner"),
    "scanner_gitleaks": ("SCANNER_GITLEAKS_IMAGE", "vulhunter-local/gitleaks-runner"),
    "scanner_phpstan": ("SCANNER_PHPSTAN_IMAGE", "vulhunter-local/phpstan-runner"),
    "scanner_pmd": ("SCANNER_PMD_IMAGE", "vulhunter-local/pmd-runner"),
    "flow_parser_runner": ("FLOW_PARSER_RUNNER_IMAGE", "vulhunter-local/flow-parser-runner"),
}

images_payload: dict[str, dict[str, str]] = {}
offline_env_lines = [
    "# Copy this file to offline-images.env before using offline mode.",
    "# Then run ./scripts/load-images.sh and ./scripts/use-offline-env.sh docker compose up -d",
    "# This release tree does not support rebuilding backend/frontend from source.",
    "RUNNER_PREFLIGHT_OFFLINE_MODE=true",
]

for logical_name, (env_var, local_repo) in image_contracts.items():
    try:
        source_ref = str(manifest["images"][logical_name]["ref"]).strip()
    except Exception as exc:  # pragma: no cover - defensive path
        raise SystemExit(f"missing required image ref: {logical_name}") from exc
    if not source_ref:
        raise SystemExit(f"missing required image ref: {logical_name}")

    local_tag = f"{local_repo}:{revision}"
    images_payload[logical_name] = {
        "env_var": env_var,
        "source_ref": source_ref,
        "local_tag": local_tag,
    }
    offline_env_lines.append(f"{env_var}={local_tag}")

metadata = {
    "revision": revision,
    "bundle_template": "images/vulhunter-images-{arch}.tar.zst",
    "images": images_payload,
}

metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
offline_env_path.write_text("\n".join(offline_env_lines) + "\n", encoding="utf-8")
PY
}

validate_release_tree() {
  local required_paths forbidden_paths rel_path doc_path

  required_paths=(
    "README.md"
    "README_EN.md"
    "docker-compose.yml"
    "images-manifest.json"
    "scripts/README-COMPOSE.md"
    "scripts/load-images.sh"
    "scripts/use-offline-env.sh"
    "docker/env/backend/env.example"
    "docker/env/backend/offline-images.env.example"
    "nexus-web/dist/index.html"
    "nexus-web/nginx.conf"
    "nexus-itemDetail/dist/index.html"
    "nexus-itemDetail/nginx.conf"
  )
  forbidden_paths=(
    "backend"
    "frontend"
    ".github"
    "deploy"
    "docs"
    "docker-compose.full.yml"
    "docker-compose.hybrid.yml"
    "docker-compose.self-contained.yml"
    "docker/backend.Dockerfile"
    "docker/frontend.Dockerfile"
    "scripts/compose-up-local-build.sh"
    "scripts/compose-up-with-fallback.sh"
  )

  for rel_path in "${required_paths[@]}"; do
    [[ -e "$OUTPUT_DIR/$rel_path" ]] || die "missing required release path: $rel_path"
  done

  for rel_path in "${forbidden_paths[@]}"; do
    [[ ! -e "$OUTPUT_DIR/$rel_path" ]] || die "forbidden path present in release tree: $rel_path"
  done

  for rel_path in nexus-web nexus-itemDetail; do
    [[ -d "$OUTPUT_DIR/$rel_path/dist" ]] || die "missing runtime bundle dist directory: $rel_path/dist"
    [[ -f "$OUTPUT_DIR/$rel_path/nginx.conf" ]] || die "missing runtime bundle nginx config: $rel_path/nginx.conf"
    [[ "$(find "$OUTPUT_DIR/$rel_path" -mindepth 1 -maxdepth 1 | wc -l)" -eq 2 ]] || \
      die "runtime bundle contains unexpected top-level files: $rel_path"
    [[ ! -e "$OUTPUT_DIR/$rel_path/src" ]] || die "runtime bundle leaked source directory: $rel_path/src"
    [[ ! -e "$OUTPUT_DIR/$rel_path/node_modules" ]] || die "runtime bundle leaked node_modules: $rel_path/node_modules"
    [[ ! -e "$OUTPUT_DIR/$rel_path/tests" ]] || die "runtime bundle leaked tests directory: $rel_path/tests"
    [[ ! -e "$OUTPUT_DIR/$rel_path/package.json" ]] || die "runtime bundle leaked package.json: $rel_path/package.json"
  done

  if find "$OUTPUT_DIR" \
    \( -path "$OUTPUT_DIR/.github" -o -path "$OUTPUT_DIR/backend" -o -path "$OUTPUT_DIR/frontend" -o -name '__pycache__' -o -name '.pytest_cache' -o -name 'node_modules' \) \
    -print -quit | grep -q .; then
    die "release tree still contains source or dev residue"
  fi

  for doc_path in "README.md" "README_EN.md" "scripts/README-COMPOSE.md"; do
    if grep -Fq "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference hybrid local-build compose entrypoint: $doc_path"
    fi
    if grep -Fq "docker-compose.full.yml" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference full local-build compose overlay: $doc_path"
    fi
    if grep -Fq "vulhunter-source-" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference source artifact packaging: $doc_path"
    fi
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || die "--output requires a value"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --image-manifest)
      [[ $# -ge 2 ]] || die "--image-manifest requires a value"
      IMAGE_MANIFEST="$2"
      shift 2
      ;;
    --source)
      [[ $# -ge 2 ]] || die "--source requires a value"
      SOURCE_DIR="$2"
      shift 2
      ;;
    --validate)
      VALIDATE="true"
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

[[ -n "$OUTPUT_DIR" ]] || die "--output is required"
[[ -n "$IMAGE_MANIFEST" ]] || die "--image-manifest is required"
[[ -f "$ALLOWLIST_PATH" ]] || die "allowlist not found: $ALLOWLIST_PATH"

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
IMAGE_MANIFEST="$(cd "$(dirname "$IMAGE_MANIFEST")" && pwd)/$(basename "$IMAGE_MANIFEST")"

[[ -f "$IMAGE_MANIFEST" ]] || die "image manifest not found: $IMAGE_MANIFEST"

case "$OUTPUT_DIR" in
  "$SOURCE_DIR"|"$SOURCE_DIR"/*)
    die "output directory must be outside the source tree"
    ;;
esac

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(trim "$line")"
  [[ -n "$line" ]] || continue
  [[ "${line:0:1}" == "#" ]] && continue
  copy_allowlisted_entry "$line"
done < "$ALLOWLIST_PATH"

prune_nexus_runtime_bundle "$OUTPUT_DIR/nexus-web"
prune_nexus_runtime_bundle "$OUTPUT_DIR/nexus-itemDetail"
overlay_release_templates
clean_generated_tree

if [[ "$VALIDATE" == "true" ]]; then
  validate_release_tree
  if command -v docker >/dev/null 2>&1; then
    (cd "$OUTPUT_DIR" && docker compose -f docker-compose.yml config >/dev/null)
  fi
fi

log "release tree generated at $OUTPUT_DIR"
