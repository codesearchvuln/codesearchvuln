#!/usr/bin/env bash

set -euo pipefail

shopt -s nullglob

CURRENT_DIR="$(pwd -P)"
STAGING_DIR=""

log_info() {
  echo "[offline-bootstrap] $*"
}

die() {
  echo "[offline-bootstrap] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash ./codesearchvuln-offline-bootstrap.sh

Run from a directory that contains:
  - exactly one codesearchvuln-*.*.*.zip or codesearchvuln-*.*.*.tar.gz
  - exactly one codesearchvuln-services-images-(amd64|arm64).tar.zst
  - exactly one codesearchvuln-scanner-images-(amd64|arm64).tar.zst

The script extracts the release archive, moves both bundle files into the
resolved release root, then delegates to bash ./scripts/offline-up.sh.
EOF
}

cleanup() {
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR"
  fi
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

archive_stem() {
  local filename="$1"
  case "$filename" in
    *.tar.gz)
      printf '%s' "${filename%.tar.gz}"
      ;;
    *.zip)
      printf '%s' "${filename%.zip}"
      ;;
    *)
      die "unsupported release archive: $filename"
      ;;
  esac
}

path_basename() {
  local path="$1"
  printf '%s' "${path##*/}"
}

discover_single_release_archive() {
  local matches=()
  local candidate

  for candidate in "$CURRENT_DIR"/codesearchvuln-*.zip "$CURRENT_DIR"/codesearchvuln-*.tar.gz; do
    [[ -f "$candidate" ]] || continue
    matches+=("$candidate")
  done

  [[ "${#matches[@]}" -eq 1 ]] || die "expected exactly one release archive in $CURRENT_DIR"
  printf '%s' "${matches[0]}"
}

discover_single_bundle() {
  local label="$1"
  local matches=()
  local candidate

  for candidate in "$CURRENT_DIR"/"codesearchvuln-${label}-images-"*.tar.zst; do
    [[ -f "$candidate" ]] || continue
    matches+=("$candidate")
  done

  [[ "${#matches[@]}" -eq 1 ]] || die "expected exactly one ${label} bundle in $CURRENT_DIR"
  printf '%s' "${matches[0]}"
}

bundle_arch() {
  local filename="$1"

  if [[ "$filename" =~ ^codesearchvuln-(services|scanner)-images-(amd64|arm64)\.tar\.zst$ ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
    return 0
  fi

  die "unsupported bundle filename: $filename"
}

is_release_root() {
  local candidate="$1"
  [[ -f "$candidate/docker-compose.yml" ]] || return 1
  [[ -f "$candidate/release-snapshot-lock.json" ]] || return 1
  [[ -f "$candidate/scripts/offline-up.sh" ]] || return 1
}

resolve_release_root() {
  local staging_root="$1"
  local candidate
  local matches=()

  if is_release_root "$staging_root"; then
    printf '%s' "$staging_root"
    return 0
  fi

  while IFS= read -r -d '' candidate; do
    if is_release_root "$candidate"; then
      matches+=("$candidate")
    fi
  done < <(find "$staging_root" -mindepth 1 -maxdepth 1 -type d -print0)

  [[ "${#matches[@]}" -eq 1 ]] || die "unable to resolve release root from extracted archive"
  printf '%s' "${matches[0]}"
}

materialize_release_root() {
  local resolved_root="$1"
  local archive_path="$2"
  local destination

  if [[ "$resolved_root" == "$STAGING_DIR" ]]; then
    destination="$CURRENT_DIR/$(archive_stem "$(path_basename "$archive_path")")"
    [[ ! -e "$destination" ]] || die "release root destination already exists: $destination"
    mv "$STAGING_DIR" "$destination"
    STAGING_DIR=""
    printf '%s' "$destination"
    return 0
  fi

  destination="$CURRENT_DIR/$(path_basename "$resolved_root")"
  [[ ! -e "$destination" ]] || die "release root destination already exists: $destination"
  mv "$resolved_root" "$destination"
  printf '%s' "$destination"
}

extract_archive() {
  local archive_path="$1"

  STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/audittool-offline-bootstrap.XXXXXX")"

  case "$archive_path" in
    *.zip)
      require_command unzip
      unzip -q "$archive_path" -d "$STAGING_DIR"
      ;;
    *.tar.gz)
      tar -xzf "$archive_path" -C "$STAGING_DIR"
      ;;
    *)
      die "unsupported release archive: $archive_path"
      ;;
  esac
}

main() {
  local archive_path
  local services_bundle
  local scanner_bundle
  local services_arch
  local scanner_arch
  local resolved_root
  local release_root
  local target_path

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  [[ "$#" -eq 0 ]] || die "this script does not accept positional arguments"

  trap cleanup EXIT

  require_command bash
  require_command find
  require_command mv
  require_command tar
  require_command mktemp
  require_command rm

  archive_path="$(discover_single_release_archive)"
  services_bundle="$(discover_single_bundle "services")"
  scanner_bundle="$(discover_single_bundle "scanner")"
  services_arch="$(bundle_arch "$(path_basename "$services_bundle")")"
  scanner_arch="$(bundle_arch "$(path_basename "$scanner_bundle")")"

  [[ "$services_arch" == "$scanner_arch" ]] || die "bundle architectures do not match: services=${services_arch}, scanner=${scanner_arch}"

  log_info "release archive: $(path_basename "$archive_path")"
  log_info "bundle pair: $(path_basename "$services_bundle"), $(path_basename "$scanner_bundle")"
  log_info "bundle arch: $services_arch"

  extract_archive "$archive_path"
  resolved_root="$(resolve_release_root "$STAGING_DIR")"
  release_root="$(materialize_release_root "$resolved_root" "$archive_path")"

  for target_path in \
    "$release_root/$(path_basename "$services_bundle")" \
    "$release_root/$(path_basename "$scanner_bundle")"; do
    [[ ! -e "$target_path" ]] || die "target bundle already exists: $target_path"
  done

  mv "$services_bundle" "$release_root/"
  mv "$scanner_bundle" "$release_root/"

  log_info "release root: $release_root"
  log_info "delegating to bash ./scripts/offline-up.sh"
  cd "$release_root"
  exec bash ./scripts/offline-up.sh
}

main "$@"
