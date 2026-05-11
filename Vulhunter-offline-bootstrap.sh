#!/usr/bin/env bash

set -euo pipefail

shopt -s nullglob

CURRENT_DIR="$(pwd -P)"
if [[ "${BASH_SOURCE[0]}" == */* ]]; then
  BOOTSTRAP_SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
else
  BOOTSTRAP_SCRIPT_DIR="$CURRENT_DIR"
fi
STAGING_DIR=""
EMBEDDED_HELPER_PATH=""

log_info() {
  echo "[offline-bootstrap] $*"
}

die() {
  echo "[offline-bootstrap] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  bash ./Vulhunter-offline-bootstrap.sh --deploy [--attach-logs]
  bash ./Vulhunter-offline-bootstrap.sh --stop
  bash ./Vulhunter-offline-bootstrap.sh --cleanup
  bash ./Vulhunter-offline-bootstrap.sh --cleanup-all

Modes:
  --deploy       Public deploy entrypoint. Prefer an existing extracted release
                 root when present; otherwise extract exactly one release_code
                 archive. Bundles may already live in the release root or images/.
  --stop         Stop the current release stack only.
  --cleanup      Remove release-stack containers/images/networks and preserve volumes.
  --cleanup-all  Remove release-stack containers/images/networks and release-project volumes.
  --attach-logs  Deploy-only flag. Attach startup logs after backend becomes healthy.
EOF
}

cleanup() {
  if [[ -n "$EMBEDDED_HELPER_PATH" && -f "$EMBEDDED_HELPER_PATH" ]]; then
    rm -f "$EMBEDDED_HELPER_PATH"
  fi
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR"
  fi
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

source_host_prereq_contract() {
  local helper_candidate
  for helper_candidate in \
    "${HOST_PREREQ_HELPER:-}" \
    "$BOOTSTRAP_SCRIPT_DIR/../offline-host-prereqs.sh" \
    "$BOOTSTRAP_SCRIPT_DIR/../../scripts/lib/offline-host-prereqs.sh" \
    "$BOOTSTRAP_SCRIPT_DIR/../../scripts/offline-host-prereqs.sh" \
    "$CURRENT_DIR/scripts/offline-host-prereqs.sh" \
    "$CURRENT_DIR/scripts/lib/offline-host-prereqs.sh"; do
    [[ -n "$helper_candidate" ]] || continue
    if [[ -f "$helper_candidate" ]]; then
      # shellcheck disable=SC1090
      source "$helper_candidate"
      return 0
    fi
  done

  EMBEDDED_HELPER_PATH="$(mktemp "${TMPDIR:-/tmp}/offline-host-prereqs.XXXXXX")"
  cat >"$EMBEDDED_HELPER_PATH" <<'EOF'
#!/usr/bin/env bash

offline_host_log_info() {
  local prefix="${OFFLINE_HOST_PREREQ_LOG_PREFIX:-[offline-prereqs]}"
  printf '%s %s\n' "$prefix" "$*"
}

offline_host_log_warn() {
  local prefix="${OFFLINE_HOST_PREREQ_LOG_PREFIX:-[offline-prereqs]}"
  printf '%s %s\n' "$prefix" "$*" >&2
}

offline_host_die() {
  offline_host_log_warn "$*"
  return 1
}

offline_host_require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || offline_host_die "required command not found: $command_name"
}

offline_host_bool_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

offline_host_os_release_path() {
  if [[ -n "${OFFLINE_HOST_OS_RELEASE_PATH:-}" ]]; then
    printf '%s' "$OFFLINE_HOST_OS_RELEASE_PATH"
    return 0
  fi
  if [[ -n "${OFFLINE_UP_OS_RELEASE_PATH:-}" ]]; then
    printf '%s' "$OFFLINE_UP_OS_RELEASE_PATH"
    return 0
  fi
  printf '%s' "/etc/os-release"
}

offline_host_proc_version_path() {
  if [[ -n "${OFFLINE_HOST_PROC_VERSION_PATH:-}" ]]; then
    printf '%s' "$OFFLINE_HOST_PROC_VERSION_PATH"
    return 0
  fi
  if [[ -n "${OFFLINE_UP_PROC_VERSION_PATH:-}" ]]; then
    printf '%s' "$OFFLINE_UP_PROC_VERSION_PATH"
    return 0
  fi
  printf '%s' "/proc/version"
}

offline_host_release_field() {
  local field_name="$1"
  local path
  path="$(offline_host_os_release_path)"
  [[ -f "$path" ]] || return 1
  awk -F= -v key="$field_name" '
    $1 == key {
      value=$2
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      print value
      exit 0
    }
  ' "$path"
}

offline_host_codename() {
  local codename
  codename="$(offline_host_release_field UBUNTU_CODENAME || true)"
  [[ -n "$codename" ]] || codename="$(offline_host_release_field VERSION_CODENAME || true)"
  if [[ -n "$codename" ]]; then
    printf '%s' "$codename"
    return 0
  fi

  case "$(offline_host_release_field VERSION_ID || true)" in
    22.04) printf '%s' "jammy" ;;
    24.04) printf '%s' "noble" ;;
    *) return 1 ;;
  esac
}

offline_host_is_supported_ubuntu() {
  local distro version_id
  distro="$(offline_host_release_field ID || true)"
  version_id="$(offline_host_release_field VERSION_ID || true)"
  [[ "$distro" == "ubuntu" ]] || return 1
  [[ "$version_id" == "22.04" || "$version_id" == "24.04" ]]
}

offline_host_is_wsl() {
  local proc_version
  proc_version="$(offline_host_proc_version_path)"
  [[ -f "$proc_version" ]] || return 1
  grep -qiE 'microsoft|wsl' "$proc_version"
}

offline_host_privilege_mode() {
  if [[ "$(id -u)" == "0" ]]; then
    printf '%s' "root"
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    printf '%s' "sudo"
    return 0
  fi
  printf '%s' "none"
}

offline_host_run_privileged() {
  local mode
  mode="$(offline_host_privilege_mode)"
  case "$mode" in
    root)
      "$@"
      ;;
    sudo)
      sudo "$@"
      ;;
    none)
      return 125
      ;;
  esac
}

offline_host_compose_ready() {
  docker compose version >/dev/null 2>&1
}

offline_host_docker_ready() {
  docker info >/dev/null 2>&1
}

offline_host_collect_missing_release_prereqs() {
  local -a missing=()
  if ! command -v docker >/dev/null 2>&1; then
    missing+=("docker")
  elif ! offline_host_compose_ready; then
    missing+=("docker-compose")
  fi

  if ! command -v zstd >/dev/null 2>&1; then
    missing+=("zstd")
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    missing+=("python3")
  fi

  local forced_missing raw_item
  forced_missing="${OFFLINE_HOST_FORCE_MISSING:-${OFFLINE_UP_FORCE_MISSING:-}}"
  local force_once_stamp
  force_once_stamp="${OFFLINE_HOST_FORCE_MISSING_STAMP:-${TMPDIR:-/tmp}/offline-host-force-missing-${PPID:-$$}.stamp}"
  if [[ -n "$forced_missing" && ! -f "$force_once_stamp" ]]; then
    : >"$force_once_stamp"
    IFS=',' read -r -a forced_missing_items <<<"$forced_missing"
    for raw_item in "${forced_missing_items[@]}"; do
      case "$raw_item" in
        docker|docker-compose|zstd|python3)
          if [[ ! " ${missing[*]} " =~ [[:space:]]${raw_item}[[:space:]] ]]; then
            missing+=("$raw_item")
          fi
          ;;
      esac
    done
  fi

  if [[ "${#missing[@]}" -gt 0 ]]; then
    printf '%s\n' "${missing[@]}"
  fi
}

offline_host_join_by() {
  local delimiter="$1"
  shift
  local first="true"
  local item
  for item in "$@"; do
    if [[ "$first" == "true" ]]; then
      printf '%s' "$item"
      first="false"
    else
      printf '%s%s' "$delimiter" "$item"
    fi
  done
}

offline_host_default_apt_candidates() {
  printf '%s\n' \
    "aliyun|mirrors.aliyun.com|mirrors.aliyun.com" \
    "tsinghua|mirrors.tuna.tsinghua.edu.cn|mirrors.tuna.tsinghua.edu.cn" \
    "official|archive.ubuntu.com|security.ubuntu.com"
}

offline_host_apt_candidates() {
  if [[ -n "${OFFLINE_HOST_APT_CANDIDATES:-}" ]]; then
    printf '%s' "$OFFLINE_HOST_APT_CANDIDATES"
    return 0
  fi
  if [[ -n "${OFFLINE_UP_APT_CANDIDATES:-}" ]]; then
    printf '%s' "$OFFLINE_UP_APT_CANDIDATES"
    return 0
  fi
  offline_host_default_apt_candidates
}

offline_host_write_ubuntu_sources() {
  local output_path="$1"
  local main_host="$2"
  local security_host="$3"
  local codename="$4"
  local scheme="${OFFLINE_HOST_APT_SCHEME:-https}"

  cat >"$output_path" <<EOS
deb ${scheme}://${main_host}/ubuntu ${codename} main restricted universe multiverse
deb ${scheme}://${main_host}/ubuntu ${codename}-updates main restricted universe multiverse
deb ${scheme}://${security_host}/ubuntu ${codename}-security main restricted universe multiverse
EOS
}

offline_host_install_packages_via_apt() {
  local label="$1"
  local main_host="$2"
  local security_host="$3"
  shift 3
  local codename tmp_dir source_list source_parts lists_dir
  codename="$(offline_host_codename)" || return 1
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/offline-prereqs.XXXXXX")"
  source_list="$tmp_dir/ubuntu.sources.list"
  source_parts="$tmp_dir/sourceparts"
  lists_dir="$tmp_dir/lists"
  mkdir -p "$source_parts" "$lists_dir"
  offline_host_write_ubuntu_sources "$source_list" "$main_host" "$security_host" "$codename"

  local -a common_args
  common_args=(
    "-o" "Dir::Etc::sourcelist=$source_list"
    "-o" "Dir::Etc::sourceparts=$source_parts"
    "-o" "Dir::State::lists=$lists_dir"
    "-o" "Acquire::Retries=1"
  )

  offline_host_log_info "attempting prerequisite install via apt mirror [$label]"
  if ! offline_host_run_privileged env DEBIAN_FRONTEND=noninteractive apt-get "${common_args[@]}" update; then
    rm -rf "$tmp_dir"
    return 1
  fi
  if ! offline_host_run_privileged env DEBIAN_FRONTEND=noninteractive apt-get "${common_args[@]}" install -y --no-install-recommends "$@"; then
    rm -rf "$tmp_dir"
    return 1
  fi
  rm -rf "$tmp_dir"
  return 0
}

offline_host_emit_manual_release_guidance() {
  local missing_list="$1"
  if offline_host_is_wsl; then
    offline_host_log_warn "Docker on WSL may still require Docker Desktop integration and a reachable docker.sock after package installation."
  fi
  offline_host_log_warn "manual remediation required for: $missing_list"
}

offline_host_ensure_release_prereqs() {
  local -a missing
  mapfile -t missing < <(offline_host_collect_missing_release_prereqs)
  if [[ "${#missing[@]}" -eq 0 ]]; then
    offline_host_log_info "host prerequisites already satisfied: docker, docker compose, zstd, python3"
    if ! offline_host_docker_ready; then
      offline_host_emit_manual_release_guidance "docker readiness"
      offline_host_die "docker is installed but the daemon/socket is not ready for offline deployment"
    fi
    return 0
  fi

  local missing_list
  missing_list="$(offline_host_join_by ', ' "${missing[@]}")"
  offline_host_log_info "detected missing offline deployment prerequisites: $missing_list"

  if ! offline_host_is_supported_ubuntu; then
    offline_host_emit_manual_release_guidance "$missing_list"
    offline_host_die "unsupported host for automatic prerequisite installation; only Ubuntu 22.04/24.04 and WSL Ubuntu are auto-remediated"
  fi

  local privilege_mode
  privilege_mode="$(offline_host_privilege_mode)"
  if [[ "$privilege_mode" == "none" ]]; then
    offline_host_emit_manual_release_guidance "$missing_list"
    offline_host_die "automatic prerequisite installation requires root or sudo on supported Ubuntu hosts"
  fi

  local -a packages=()
  local item
  for item in "${missing[@]}"; do
    case "$item" in
      docker)
        packages+=("docker.io" "docker-compose-v2")
        ;;
      docker-compose)
        packages+=("docker-compose-v2")
        ;;
      zstd)
        packages+=("zstd")
        ;;
      python3)
        packages+=("python3")
        ;;
    esac
  done

  local candidates label main_host security_host install_ok="false" IFS=$'\n'
  candidates="$(offline_host_apt_candidates)"
  for entry in $candidates; do
    [[ -n "$entry" ]] || continue
    IFS='|' read -r label main_host security_host <<<"$entry"
    if offline_host_install_packages_via_apt "$label" "$main_host" "$security_host" "${packages[@]}"; then
      install_ok="true"
      break
    fi
    offline_host_log_warn "apt install attempt failed via mirror [$label]"
  done
  IFS=$' \t\n'

  if [[ "$install_ok" != "true" ]]; then
    offline_host_emit_manual_release_guidance "$missing_list"
    offline_host_die "automatic prerequisite installation failed on all configured Ubuntu mirrors"
  fi

  mapfile -t missing < <(offline_host_collect_missing_release_prereqs)
  if [[ "${#missing[@]}" -gt 0 ]]; then
    missing_list="$(offline_host_join_by ', ' "${missing[@]}")"
    offline_host_emit_manual_release_guidance "$missing_list"
    offline_host_die "some prerequisites are still missing after automatic installation"
  fi

  if ! offline_host_docker_ready; then
    offline_host_emit_manual_release_guidance "docker readiness"
    offline_host_die "packages were installed but Docker is still not ready for offline deployment"
  fi

  offline_host_log_info "offline deployment prerequisites are installed and Docker is ready"
}
EOF

  # shellcheck disable=SC1090
  source "$EMBEDDED_HELPER_PATH"
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

  for candidate in \
    "$CURRENT_DIR"/release_code.zip \
    "$CURRENT_DIR"/release_code.tar.gz; do
    [[ -f "$candidate" ]] || continue
    matches+=("$candidate")
  done

  [[ "${#matches[@]}" -eq 1 ]] || die "expected exactly one release_code.zip or release_code.tar.gz in $CURRENT_DIR"
  printf '%s' "${matches[0]}"
}

discover_single_bundle() {
  local label="$1"
  local matches=()
  local candidate

  for candidate in \
    "$CURRENT_DIR"/"vulhunter-${label}-images-"*.tar.zst \
    "$CURRENT_DIR"/"codesearchvuln-${label}-images-"*.tar.zst; do
    [[ -f "$candidate" ]] || continue
    matches+=("$candidate")
  done

  [[ "${#matches[@]}" -eq 1 ]] || die "expected exactly one ${label} bundle in $CURRENT_DIR"
  printf '%s' "${matches[0]}"
}

bundle_arch() {
  local filename="$1"

  if [[ "$filename" =~ ^(vulhunter|codesearchvuln)-(services|scanner)-images-(amd64|arm64)\.tar\.zst$ ]]; then
    printf '%s' "${BASH_REMATCH[3]}"
    return 0
  fi

  if [[ "$filename" =~ ^(vulhunter|codesearchvuln)-(services|scanner)-images-(amd64|arm64)\.tar$ ]]; then
    printf '%s' "${BASH_REMATCH[3]}"
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

MODE=""
ATTACH_LOGS="false"

set_mode() {
  local requested_mode="$1"
  [[ -z "$MODE" ]] || die "exactly one primary mode is required: --deploy, --stop, --cleanup, or --cleanup-all"
  MODE="$requested_mode"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --deploy)
        set_mode "deploy"
        shift
        ;;
      --stop)
        set_mode "stop"
        shift
        ;;
      --cleanup)
        set_mode "cleanup"
        shift
        ;;
      --cleanup-all)
        set_mode "cleanup-all"
        shift
        ;;
      --attach-logs)
        ATTACH_LOGS="true"
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

  [[ -n "$MODE" ]] || die "exactly one primary mode is required: --deploy, --stop, --cleanup, or --cleanup-all"
  if [[ "$MODE" != "deploy" && "$ATTACH_LOGS" == "true" ]]; then
    die "--attach-logs is supported only with --deploy"
  fi
}

is_release_root() {
  local candidate="$1"
  [[ -d "$candidate" ]] || return 1
  [[ -f "$candidate/docker-compose.yml" ]] || return 1
  [[ -f "$candidate/release-snapshot-lock.json" ]] || return 1
  [[ -f "$candidate/scripts/offline-up.sh" ]] || return 1
}

discover_existing_release_roots() {
  local candidate

  if is_release_root "$CURRENT_DIR"; then
    printf '%s\n' "$CURRENT_DIR"
  fi

  while IFS= read -r candidate; do
    candidate="${candidate%/docker-compose.yml}"
    [[ "$candidate" == "$CURRENT_DIR" ]] && continue
    is_release_root "$candidate" || continue
    printf '%s\n' "$candidate"
  done < <(find "$CURRENT_DIR" -mindepth 2 -maxdepth 2 -type f -name docker-compose.yml)
}

count_nonempty_lines() {
  local count=0
  local line
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    count=$((count + 1))
  done <<<"${1:-}"
  printf '%s' "$count"
}

resolve_release_root_for_mode() {
  local archive_path="${1:-}"
  local roots_text root_count release_root

  roots_text="$(discover_existing_release_roots)"
  root_count="$(count_nonempty_lines "$roots_text")"

  if [[ "$root_count" -gt 1 ]]; then
    die "expected exactly one extracted release root in $CURRENT_DIR"
  fi

  if [[ "$root_count" -eq 1 ]]; then
    release_root="$(printf '%s\n' "$roots_text" | awk 'NF {print; exit}')"
    printf '%s' "$release_root"
    return 0
  fi

  [[ -n "$archive_path" ]] || archive_path="$(discover_single_release_archive)"
  case "$archive_path" in
    *.zip)
      require_command unzip
      ;;
  esac
  extract_archive "$archive_path"
  release_root="$(resolve_release_root "$STAGING_DIR")"
  release_root="$(materialize_release_root "$release_root" "$archive_path")"
  printf '%s' "$release_root"
}

bundle_exists_in_release_root() {
  local release_root="$1"
  local bundle_name="$2"
  [[ -f "$release_root/$bundle_name" || -f "$release_root/images/$bundle_name" ]]
}

discover_existing_release_root_bundle() {
  local release_root="$1"
  local label="$2"
  local matches=()
  local base_dir

  for base_dir in "$release_root" "$release_root/images"; do
    [[ -d "$base_dir" ]] || continue
    while IFS= read -r candidate; do
      [[ -n "$candidate" ]] || continue
      matches+=("$candidate")
    done < <(find "$base_dir" -maxdepth 1 -type f \
      \( -name "vulhunter-${label}-images-*.tar" -o -name "vulhunter-${label}-images-*.tar.zst" \))
  done

  [[ "${#matches[@]}" -le 1 ]] || die "expected exactly one ${label} bundle in extracted release root ${release_root}"
  [[ "${#matches[@]}" -eq 1 ]] || return 1
  printf '%s' "${matches[0]}"
}

ensure_release_root_has_deploy_bundles() {
  local release_root="$1"
  local services_bundle
  local scanner_bundle
  local services_arch
  local scanner_arch
  local existing_services_bundle
  local existing_scanner_bundle

  if existing_services_bundle="$(discover_existing_release_root_bundle "$release_root" "services" 2>/dev/null)"; then
    :
  else
    existing_services_bundle=""
  fi
  if existing_scanner_bundle="$(discover_existing_release_root_bundle "$release_root" "scanner" 2>/dev/null)"; then
    :
  else
    existing_scanner_bundle=""
  fi
  if [[ -n "$existing_services_bundle" && -n "$existing_scanner_bundle" ]]; then
    return 0
  fi

  services_bundle="$(discover_single_bundle "services")"
  scanner_bundle="$(discover_single_bundle "scanner")"
  services_arch="$(bundle_arch "$(path_basename "$services_bundle")")"
  scanner_arch="$(bundle_arch "$(path_basename "$scanner_bundle")")"
  [[ "$services_arch" == "$scanner_arch" ]] || die "bundle architectures do not match: services=${services_arch}, scanner=${scanner_arch}"

  log_info "bundle pair: $(path_basename "$services_bundle"), $(path_basename "$scanner_bundle")"
  log_info "bundle arch: $services_arch"

  if bundle_exists_in_release_root "$release_root" "$(path_basename "$services_bundle")"; then
    die "target bundle already exists: $release_root/$(path_basename "$services_bundle")"
  fi
  if bundle_exists_in_release_root "$release_root" "$(path_basename "$scanner_bundle")"; then
    die "target bundle already exists: $release_root/$(path_basename "$scanner_bundle")"
  fi

  if ! bundle_exists_in_release_root "$release_root" "$(path_basename "$services_bundle")"; then
    mv "$services_bundle" "$release_root/"
  fi
  if ! bundle_exists_in_release_root "$release_root" "$(path_basename "$scanner_bundle")"; then
    mv "$scanner_bundle" "$release_root/"
  fi
}

source_release_refresh() {
  local release_root="$1"
  local helper_path="$release_root/scripts/release-refresh.sh"

  [[ -f "$helper_path" ]] || die "release refresh helper not found: $helper_path"
  ROOT_DIR="$release_root"
  # shellcheck disable=SC1090
  source "$helper_path"
}

ensure_docker_compose() {
  require_command docker
  docker compose version >/dev/null 2>&1 || die "docker compose not found or unavailable"
}

pre_deploy_cleanup() {
  local release_root="$1"

  source_release_refresh "$release_root"
  ensure_docker_compose
  log_info "cleaning up previous release stack (containers/images/networks) before deploy; volumes preserved"
  cleanup_release_stack
}

run_release_maintenance() {
  local release_root="$1"

  source_release_refresh "$release_root"
  ensure_docker_compose

  case "$MODE" in
    stop)
      stop_release_stack
      ;;
    cleanup)
      cleanup_release_stack
      ;;
    cleanup-all)
      cleanup_release_stack_and_volumes
      ;;
    *)
      die "unsupported maintenance mode: $MODE"
      ;;
  esac
}

main() {
  local archive_path=""
  local release_root
  local current_archive=""
  local existing_roots
  local existing_root_count

  parse_args "$@"
  trap cleanup EXIT

  source_host_prereq_contract
  export OFFLINE_HOST_PREREQ_LOG_PREFIX="[offline-bootstrap]"

  require_command bash
  require_command find
  require_command mv
  require_command tar
  require_command mktemp
  require_command rm

  existing_roots="$(discover_existing_release_roots)"
  existing_root_count="$(count_nonempty_lines "$existing_roots")"

  if [[ "$MODE" == "deploy" ]]; then
    if [[ "$existing_root_count" -eq 0 ]]; then
      current_archive="$(discover_single_release_archive)"
    else
      if current_archive="$(discover_single_release_archive 2>/dev/null)"; then
        :
      else
        current_archive=""
      fi
    fi
    if [[ -n "$current_archive" ]]; then
      case "$current_archive" in
        *.zip)
          require_command unzip
          ;;
      esac
      log_info "release archive: $(path_basename "$current_archive")"
    fi
    offline_host_ensure_release_prereqs
    if [[ "$existing_root_count" -eq 1 ]]; then
      local existing_root
      existing_root="$(printf '%s\n' "$existing_roots" | awk 'NF {print; exit}')"
      pre_deploy_cleanup "$existing_root"
    fi
    release_root="$(resolve_release_root_for_mode "$current_archive")"
    ensure_release_root_has_deploy_bundles "$release_root"
    log_info "release root: $release_root"
    log_info "delegating to bash ./scripts/offline-up.sh"
    cd "$release_root"
    if [[ "$ATTACH_LOGS" == "true" ]]; then
      exec bash ./scripts/offline-up.sh --attach-logs
    fi
    exec bash ./scripts/offline-up.sh
  fi

  if archive_path="$(discover_single_release_archive 2>/dev/null)"; then
    :
  else
    archive_path=""
  fi
  release_root="$(resolve_release_root_for_mode "$archive_path")"
  log_info "release root: $release_root"
  run_release_maintenance "$release_root"
}

main "$@"
