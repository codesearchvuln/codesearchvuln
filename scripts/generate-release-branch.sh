#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR"
OUTPUT_DIR=""
IMAGE_MANIFEST=""
FRONTEND_BUNDLE_DIR=""
VALIDATE="false"
ALLOWLIST_PATH="$ROOT_DIR/scripts/release-allowlist.txt"
TEMPLATE_DIR="$ROOT_DIR/scripts/release-templates"
CONTRACT_PATH="$ROOT_DIR/scripts/release-bundle-contract.json"

usage() {
  cat <<'USAGE'
Usage: generate-release-branch.sh --output <dir> --image-manifest <file> --frontend-bundle <dir> [--source <dir>] [--validate]

Generate an image-only runtime release tree from the checked-out repository.
The output intentionally excludes backend/frontend source code, local-build compose
overlays, Dockerfiles, and other development-only assets.
The default backend image in the generated release tree is expected to come from
the runtime-plain Docker target; optional hardened variants are out of band.

Options:
  --output <dir>           Required. Destination directory for the generated release tree.
  --image-manifest <file>  Required. JSON manifest with digest-pinned runtime image refs.
  --frontend-bundle <dir>  Required. Directory containing frontend runtime assets:
                           site/** and nginx/default.conf.
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
    "postgres": "__POSTGRES_IMAGE_REF__",
    "redis": "__REDIS_IMAGE_REF__",
    "adminer": "__ADMINER_IMAGE_REF__",
    "scan_workspace_init": "__SCAN_WORKSPACE_INIT_IMAGE_REF__",
    "static_frontend": "__STATIC_FRONTEND_IMAGE_REF__",
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

copy_frontend_runtime_bundle() {
  local bundle_root="$1"
  local source_site="$bundle_root/site"
  local source_nginx="$bundle_root/nginx/default.conf"
  local dest_root="$OUTPUT_DIR/deploy/runtime/frontend"

  [[ -d "$source_site" ]] || die "frontend bundle missing site directory: $source_site"
  [[ -f "$source_nginx" ]] || die "frontend bundle missing nginx config: $source_nginx"

  mkdir -p "$dest_root/site" "$dest_root/nginx"
  cp -R "$source_site/." "$dest_root/site/"
  cp "$source_nginx" "$dest_root/nginx/default.conf"
}

overlay_release_templates() {
  mkdir -p \
    "$OUTPUT_DIR/scripts" \
    "$OUTPUT_DIR/docker" \
    "$OUTPUT_DIR/docker/env/backend"

  cp "$TEMPLATE_DIR/README.md" "$OUTPUT_DIR/README.md"
  cp "$TEMPLATE_DIR/README_EN.md" "$OUTPUT_DIR/README_EN.md"
  cp "$ROOT_DIR/scripts/release-assets/offline-bootstrap.sh" "$OUTPUT_DIR/Vulhunter-offline-bootstrap.sh"
  cp "$TEMPLATE_DIR/offline-up.sh" "$OUTPUT_DIR/scripts/offline-up.sh"
  cp "$ROOT_DIR/scripts/lib/compose-env.sh" "$OUTPUT_DIR/scripts/compose-env.sh"
  cp "$ROOT_DIR/scripts/lib/offline-host-prereqs.sh" "$OUTPUT_DIR/scripts/offline-host-prereqs.sh"
  cp "$TEMPLATE_DIR/lib/startup-banner.sh" "$OUTPUT_DIR/scripts/startup-banner.sh"
  cp "$TEMPLATE_DIR/lib/release-refresh.sh" "$OUTPUT_DIR/scripts/release-refresh.sh"
  chmod +x "$OUTPUT_DIR/Vulhunter-offline-bootstrap.sh"
  chmod +x "$OUTPUT_DIR/scripts/offline-up.sh"
  render_release_compose
  python3 - \
    "$CONTRACT_PATH" \
    "$IMAGE_MANIFEST" \
    "$OUTPUT_DIR/images-manifest-services.json" \
    "$OUTPUT_DIR/images-manifest-scanner.json" \
    "$OUTPUT_DIR/docker/env/backend/offline-images.env.example" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path


contract_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
services_metadata_path = Path(sys.argv[3])
scanner_metadata_path = Path(sys.argv[4])
offline_env_path = Path(sys.argv[5])

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


def resolve_backend_provenance(manifest_payload: dict[str, object]) -> tuple[str, str | None]:
    images = manifest_payload.get("images")
    if not isinstance(images, dict):
        return ("built_this_run", None)

    backend = images.get("backend")
    if not isinstance(backend, dict):
        return ("built_this_run", None)

    provenance = backend.get("provenance")
    if not isinstance(provenance, dict):
        return ("built_this_run", None)

    mode = str(provenance.get("mode", "")).strip() or "built_this_run"
    if mode not in {"built_this_run", "resolved_fallback"}:
        raise SystemExit(f"unsupported backend provenance mode: {mode}")

    source_tag = None
    if mode == "resolved_fallback":
        source_tag = str(provenance.get("source_tag", "")).strip()
        if not source_tag:
            raise SystemExit("resolved_fallback backend provenance requires source_tag")

    return (mode, source_tag)

offline_env_lines = [
    "# Copy this file to offline-images.env before using offline mode.",
    "# Then run bash ./Vulhunter-offline-bootstrap.sh --deploy.",
    "# This release tree does not support rebuilding backend/frontend from source.",
    "# The default backend runtime image in this release tree comes from the runtime-plain target.",
    "RUNNER_PREFLIGHT_OFFLINE_MODE=true",
]


def build_payload(bundle_name: str) -> dict[str, dict[str, str]]:
    bundle_contract = bundle_contracts.get(bundle_name)
    if not isinstance(bundle_contract, dict):
        raise SystemExit(f"missing bundle contract: {bundle_name}")

    logical_names = bundle_contract.get("images")
    if not isinstance(logical_names, list) or not logical_names:
        raise SystemExit(f"bundle image list is required: {bundle_name}")

    payload: dict[str, dict[str, str]] = {}
    for logical_name in logical_names:
        image_contract = image_contracts.get(logical_name)
        if not isinstance(image_contract, dict):
            raise SystemExit(f"missing bundle image contract: {logical_name}")
        env_var = str(image_contract.get("env_var", "")).strip()
        local_repo = str(image_contract.get("local_repo", "")).strip()
        if not env_var:
            raise SystemExit(f"missing env_var for bundle image contract: {logical_name}")
        if not local_repo:
            raise SystemExit(f"missing local_repo for bundle image contract: {logical_name}")
        try:
            source_ref = str(manifest["images"][logical_name]["ref"]).strip()
        except Exception as exc:  # pragma: no cover - defensive path
            raise SystemExit(f"missing required image ref: {logical_name}") from exc
        if not source_ref:
            raise SystemExit(f"missing required image ref: {logical_name}")

        local_tag = f"{local_repo}:{revision}"
        payload[logical_name] = {
            "env_var": env_var,
            "source_ref": source_ref,
            "local_tag": local_tag,
        }
        offline_env_lines.append(f"{env_var}={local_tag}")
    return payload


services_images_payload = build_payload("services")
scanner_images_payload = build_payload("scanner")

services_bundle_contract = bundle_contracts["services"]
scanner_bundle_contract = bundle_contracts["scanner"]
backend_provenance_mode, backend_provenance_source_tag = resolve_backend_provenance(manifest)

services_metadata = {
    "revision": revision,
    "bundle_template": f"images/{services_bundle_contract['asset_name_template']}",
    "backend_provenance_mode": backend_provenance_mode,
    "images": services_images_payload,
}
if backend_provenance_source_tag:
    services_metadata["backend_provenance_source_tag"] = backend_provenance_source_tag

scanner_metadata = {
    "revision": revision,
    "bundle_template": f"images/{scanner_bundle_contract['asset_name_template']}",
    "images": scanner_images_payload,
}

services_metadata_path.write_text(json.dumps(services_metadata, indent=2) + "\n", encoding="utf-8")
scanner_metadata_path.write_text(json.dumps(scanner_metadata, indent=2) + "\n", encoding="utf-8")
offline_env_path.write_text("\n".join(offline_env_lines) + "\n", encoding="utf-8")
PY
}

validate_release_tree() {
  local required_paths forbidden_paths rel_path doc_path

  required_paths=(
    "README.md"
    "README_EN.md"
    "Vulhunter-offline-bootstrap.sh"
    "docker-compose.yml"
    "images-manifest-services.json"
    "images-manifest-scanner.json"
    "scripts/offline-up.sh"
    "scripts/compose-env.sh"
    "scripts/offline-host-prereqs.sh"
    "scripts/startup-banner.sh"
    "scripts/release-refresh.sh"
    "docker/env/backend/env.example"
    "docker/env/backend/offline-images.env.example"
    "deploy/runtime/frontend/site/index.html"
    "deploy/runtime/frontend/nginx/default.conf"
    "nexus-web/dist/index.html"
    "nexus-web/nginx.conf"
    "nexus-itemDetail/dist/index.html"
    "nexus-itemDetail/nginx.conf"
  )
  forbidden_paths=(
    "backend"
    "frontend"
    ".github"
    "docs"
    "docker-compose.full.yml"
    "docker-compose.hybrid.yml"
    "docker-compose.self-contained.yml"
    "docker/backend.Dockerfile"
    "docker/frontend.Dockerfile"
    "scripts/compose-up-local-build.sh"
    "scripts/compose-up-with-fallback.sh"
    "scripts/load-images.sh"
    "scripts/load-images.ps1"
    "scripts/use-offline-env.sh"
    "scripts/use-offline-env.ps1"
  )

  for rel_path in "${required_paths[@]}"; do
    [[ -e "$OUTPUT_DIR/$rel_path" ]] || die "missing required release path: $rel_path"
  done

  for rel_path in "${forbidden_paths[@]}"; do
    [[ ! -e "$OUTPUT_DIR/$rel_path" ]] || die "forbidden path present in release tree: $rel_path"
  done

  [[ -d "$OUTPUT_DIR/deploy/runtime/frontend/site" ]] || die "missing frontend runtime site directory"
  [[ -f "$OUTPUT_DIR/deploy/runtime/frontend/nginx/default.conf" ]] || die "missing frontend nginx config"
  [[ ! -e "$OUTPUT_DIR/docker/frontend.Dockerfile" ]] || die "release tree leaked frontend Dockerfile"
  [[ ! -e "$OUTPUT_DIR/frontend" ]] || die "release tree leaked frontend source directory"
  if [[ -d "$OUTPUT_DIR/deploy" ]]; then
    [[ "$(find "$OUTPUT_DIR/deploy" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]] || \
      die "deploy directory contains unexpected top-level entries"
    [[ -d "$OUTPUT_DIR/deploy/runtime" ]] || die "deploy directory missing runtime subtree"
    [[ "$(find "$OUTPUT_DIR/deploy/runtime" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]] || \
      die "deploy/runtime contains unexpected entries"
    [[ -d "$OUTPUT_DIR/deploy/runtime/frontend" ]] || die "deploy/runtime missing frontend subtree"
    [[ "$(find "$OUTPUT_DIR/deploy/runtime/frontend" -mindepth 1 -maxdepth 1 | wc -l)" -eq 2 ]] || \
      die "deploy/runtime/frontend contains unexpected entries"
    [[ ! -e "$OUTPUT_DIR/deploy/compose" ]] || die "release tree leaked deploy compose overlays"
  fi

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

  for doc_path in "README.md" "README_EN.md"; do
    if grep -Fq "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference hybrid local-build compose entrypoint: $doc_path"
    fi
    if grep -Fq "vulhunter-source-" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference source artifact packaging: $doc_path"
    fi
    if grep -Fq "./scripts/online-up.sh" "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference removed online deployment entrypoint: $doc_path"
    fi
    if grep -Eq '(^|[^A-Z_])FRONTEND_IMAGE([^A-Z_]|$)' "$OUTPUT_DIR/$doc_path"; then
      die "release docs still reference frontend runtime image override: $doc_path"
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
    --frontend-bundle)
      [[ $# -ge 2 ]] || die "--frontend-bundle requires a value"
      FRONTEND_BUNDLE_DIR="$2"
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
[[ -n "$FRONTEND_BUNDLE_DIR" ]] || die "--frontend-bundle is required"
[[ -f "$ALLOWLIST_PATH" ]] || die "allowlist not found: $ALLOWLIST_PATH"

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
IMAGE_MANIFEST="$(cd "$(dirname "$IMAGE_MANIFEST")" && pwd)/$(basename "$IMAGE_MANIFEST")"
FRONTEND_BUNDLE_DIR="$(cd "$FRONTEND_BUNDLE_DIR" && pwd)"

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
copy_frontend_runtime_bundle "$FRONTEND_BUNDLE_DIR"
clean_generated_tree

if [[ "$VALIDATE" == "true" ]]; then
  validate_release_tree
  if command -v docker >/dev/null 2>&1; then
    (cd "$OUTPUT_DIR" && docker compose -f docker-compose.yml config >/dev/null)
  fi
fi

log "release tree generated at $OUTPUT_DIR"
