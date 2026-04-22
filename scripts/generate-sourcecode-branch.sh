#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR"
SOURCE_REF=""
OUTPUT_DIR=""
VALIDATE="false"
TEMPLATE_DIR="$ROOT_DIR/scripts/sourcecode-templates"

usage() {
  cat <<'USAGE'
Usage: generate-sourcecode-branch.sh --output <dir> [--source <dir>] [--ref <git-ref>] [--validate]

Generate the public sourcecode branch tree from tracked repository files.
The output keeps runtime/build source code and strips CI, docs, release packaging,
and internal development-only entrypoints.

Options:
  --output <dir>   Required. Destination directory for the generated tree.
  --source <dir>   Override the source repository root. Defaults to the current checkout.
  --ref <git-ref>  Optional git ref to export exactly. Defaults to tracked files in the current checkout.
  --validate       Validate the generated tree after pruning and templating.
  -h, --help       Show this help text.
USAGE
}

log() {
  echo "[sourcecode-tree] $*"
}

die() {
  echo "[sourcecode-tree] $*" >&2
  exit 1
}

clean_generated_tree() {
  find "$OUTPUT_DIR" \
    \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' \) \
    -exec rm -rf {} +
  find "$OUTPUT_DIR" \
    \( -name '*.pyc' -o -name '*.pyo' -o -name '.DS_Store' \) \
    -delete
}

export_tracked_tree() {
  if [[ -n "$SOURCE_REF" ]]; then
    git -C "$SOURCE_DIR" archive --format=tar "$SOURCE_REF" | tar -xf - -C "$OUTPUT_DIR"
  else
    (
      cd "$SOURCE_DIR"
      git ls-files -z | tar --null -T - -cf -
    ) | tar -xf - -C "$OUTPUT_DIR"
  fi

  # git ls-files / git archive do not include submodule contents.
  # Copy each initialised submodule into the output tree.
  git -C "$SOURCE_DIR" submodule --quiet foreach --recursive '
    rel="${sm_path}"
    src="${toplevel}/${rel}"
    dst="'"$OUTPUT_DIR"'/${rel}"
    if [ -d "${src}" ]; then
      rm -rf "${dst}"
      mkdir -p "${dst}"
      git -C "${src}" ls-files -z | (cd "${src}" && tar --null -T - -cf -) | tar -xf - -C "${dst}"
    fi
  '
}

prune_public_tree() {
  rm -rf \
    "$OUTPUT_DIR/.github" \
    "$OUTPUT_DIR/docs" \
    "$OUTPUT_DIR/deploy" \
    "$OUTPUT_DIR/agent_checkpoints" \
    "$OUTPUT_DIR/backend/tests" \
    "$OUTPUT_DIR/frontend/tests" \
    "$OUTPUT_DIR/CLAUDE.md" \
    "$OUTPUT_DIR/docker-compose.hybrid.yml"

  if [[ -d "$OUTPUT_DIR/scripts" ]]; then
    find "$OUTPUT_DIR/scripts" -mindepth 1 ! -name 'setup-env.sh' -exec rm -rf {} +
  fi

  [[ -f "$OUTPUT_DIR/scripts/setup-env.sh" ]] || die "missing required public script: scripts/setup-env.sh"
  mkdir -p "$OUTPUT_DIR/data"
  chmod +x "$OUTPUT_DIR/scripts/setup-env.sh"
}

overlay_templates() {
  [[ -d "$TEMPLATE_DIR" ]] || die "template directory not found: $TEMPLATE_DIR"

  cp "$TEMPLATE_DIR/README.md" "$OUTPUT_DIR/README.md"
  cp "$TEMPLATE_DIR/README_EN.md" "$OUTPUT_DIR/README_EN.md"
  cp "$TEMPLATE_DIR/Makefile" "$OUTPUT_DIR/Makefile"
  cp "$TEMPLATE_DIR/docker-compose.full.yml" "$OUTPUT_DIR/docker-compose.full.yml"
}

validate_sourcecode_tree() {
  local rel_path
  local required_paths=(
    "backend"
    "frontend"
    "docker"
    "data"
    "nexus-web"
    "nexus-itemDetail"
    "docker-compose.yml"
    "docker-compose.full.yml"
    "README.md"
    "README_EN.md"
    "Makefile"
    "scripts/setup-env.sh"
    "docker/env/backend/env.example"
    "LICENSE"
  )
  local forbidden_paths=(
    ".github"
    "docs"
    "deploy"
    "agent_checkpoints"
    "backend/tests"
    "frontend/tests"
    "CLAUDE.md"
    "docker-compose.hybrid.yml"
    "scripts/build-frontend.sh"
    "scripts/compose-up-local-build.sh"
    "scripts/compose-up-with-fallback.bat"
    "scripts/compose-up-with-fallback.ps1"
    "scripts/compose-up-with-fallback.sh"
    "scripts/deploy-linux.sh"
    "scripts/download-release-assets.py"
    "scripts/generate-release-branch.sh"
    "scripts/package-release-images.sh"
    "scripts/release-assets"
    "scripts/release-allowlist.txt"
    "scripts/release-bundle-contract.json"
    "scripts/release-tag-cleanup.txt"
    "scripts/release-templates"
    "scripts/release.sh"
    "scripts/release_version.py"
    "scripts/setup_security_tools.bat"
    "scripts/setup_security_tools.ps1"
    "scripts/setup_security_tools.sh"
    "scripts/sourcecode-templates"
    "scripts/write-release-snapshot-lock.py"
  )

  for rel_path in "${required_paths[@]}"; do
    [[ -e "$OUTPUT_DIR/$rel_path" ]] || die "missing required sourcecode path: $rel_path"
  done

  for rel_path in "${forbidden_paths[@]}"; do
    [[ ! -e "$OUTPUT_DIR/$rel_path" ]] || die "forbidden path present in sourcecode tree: $rel_path"
  done

  [[ -d "$OUTPUT_DIR/scripts" ]] || die "scripts directory is required"
  [[ "$(find "$OUTPUT_DIR/scripts" -mindepth 1 | wc -l)" -eq 1 ]] || \
    die "scripts directory contains unexpected files"
  [[ -f "$OUTPUT_DIR/scripts/setup-env.sh" ]] || die "scripts/setup-env.sh is required"

  for rel_path in README.md README_EN.md Makefile scripts/setup-env.sh docker-compose.yml docker-compose.full.yml; do
    if grep -Fq "docker-compose.hybrid.yml" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references hybrid compose entrypoint: $rel_path"
    fi
    if grep -Fq "compose-up-with-fallback" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references compose fallback wrapper: $rel_path"
    fi
    if grep -Fq "docker compose up" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references bare docker compose up: $rel_path"
    fi
  done

  for rel_path in README.md README_EN.md; do
    if ! grep -Fq "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode readme is missing the full local-build entrypoint: $rel_path"
    fi
  done

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    (
      cd "$OUTPUT_DIR"
      docker compose -f docker-compose.yml -f docker-compose.full.yml config >/dev/null
    )
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || die "--output requires a value"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --source)
      [[ $# -ge 2 ]] || die "--source requires a value"
      SOURCE_DIR="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref requires a value"
      SOURCE_REF="$2"
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

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
[[ -d "$SOURCE_DIR/.git" || -f "$SOURCE_DIR/.git" ]] || die "source directory is not a git repository: $SOURCE_DIR"
if [[ -n "$SOURCE_REF" ]]; then
  git -C "$SOURCE_DIR" rev-parse --verify "${SOURCE_REF}^{commit}" >/dev/null 2>&1 || \
    die "git ref does not resolve to a commit: $SOURCE_REF"
fi

OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"

case "$OUTPUT_DIR" in
  "$SOURCE_DIR"|"$SOURCE_DIR"/*)
    die "output directory must be outside the source tree"
    ;;
esac

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

export_tracked_tree
prune_public_tree
overlay_templates
clean_generated_tree

if [[ "$VALIDATE" == "true" ]]; then
  validate_sourcecode_tree
fi

log "sourcecode tree generated at $OUTPUT_DIR"
