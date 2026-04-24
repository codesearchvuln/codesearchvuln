#!/usr/bin/env bash

release_refresh_log_info() {
  if declare -F log_info >/dev/null 2>&1; then
    log_info "$@"
    return
  fi
  echo "[release-refresh] $*"
}

release_refresh_log_warn() {
  if declare -F log_warn >/dev/null 2>&1; then
    log_warn "$@"
    return
  fi
  echo "[release-refresh] $*" >&2
}

release_compose_project_name() {
  printf '%s' "${VULHUNTER_RELEASE_PROJECT_NAME:-vulhunter-release}"
}

compose_release() {
  (
    cd "${ROOT_DIR:?ROOT_DIR is required before sourcing release-refresh.sh}"
    docker compose -p "$(release_compose_project_name)" "$@"
  )
}

release_refresh_discovery_is_fatal() {
  local stderr="${1:-}"
  [[ -n "$stderr" ]] || return 1
  grep -Eiq \
    'permission denied|docker socket access was denied|docker\.sock|cannot connect to the docker daemon|is the docker daemon running|error during connect|server api version|context .* does not exist|current context|config file|certificate|tls|connection refused|dial unix|no such host' \
    <<<"$stderr"
}

collect_release_stack_container_ids() {
  local stderr_file status container_ids discovery_stderr

  stderr_file="$(mktemp)"
  set +e
  container_ids="$(
    docker ps -aq --filter "label=com.docker.compose.project=$(release_compose_project_name)" \
      2>"$stderr_file" | tr -d '\r'
  )"
  status="$?"
  set -e

  discovery_stderr="$(cat "$stderr_file")"
  rm -f "$stderr_file"

  if [[ "$status" -eq 0 ]]; then
    printf '%s' "$container_ids"
    return 0
  fi

  if release_refresh_discovery_is_fatal "$discovery_stderr"; then
    [[ -n "$discovery_stderr" ]] && printf '%s\n' "$discovery_stderr" >&2
    return "$status"
  fi

  release_refresh_log_warn "warning: release-stack container discovery failed; treating as no existing containers and continuing cleanup"
  [[ -n "$discovery_stderr" ]] && printf '%s\n' "$discovery_stderr" >&2
  return 0
}

collect_release_stack_image_ids() {
  local container_ids="${1:-}"
  local container_id image_id

  [[ -n "$container_ids" ]] || return 0

  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    image_id="$(docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null || true)"
    [[ -n "$image_id" ]] && printf '%s\n' "$image_id"
  done <<<"$container_ids" | awk 'NF && !seen[$0]++'
}

collect_image_ids_for_refs() {
  local image_refs="${1:-}"
  local image_ref image_id

  [[ -n "$image_refs" ]] || return 0

  while IFS= read -r image_ref; do
    [[ -n "$image_ref" ]] || continue
    image_id="$(docker image inspect --format '{{.Id}}' "$image_ref" 2>/dev/null || true)"
    [[ -n "$image_id" ]] && printf '%s\n' "$image_id"
  done <<<"$image_refs" | awk 'NF && !seen[$0]++'
}

collect_current_compose_image_ids() {
  local compose_output_file image_refs refs_file status parse_status
  local stderr_file stderr_output

  compose_output_file="$(mktemp "${TMPDIR:-/tmp}/release-refresh-compose-output.XXXXXX")"
  refs_file="$(mktemp "${TMPDIR:-/tmp}/release-refresh-compose-refs.XXXXXX")"
  stderr_file="$(mktemp "${TMPDIR:-/tmp}/release-refresh-compose-stderr.XXXXXX")"

  set +e
  compose_release config >"$compose_output_file" 2>"$stderr_file"
  status=$?
  set -e

  stderr_output="$(tr -d '\r' <"$stderr_file")"
  rm -f "$stderr_file"

  if [[ "$status" -ne 0 ]]; then
    rm -f "$compose_output_file" "$refs_file"
    release_refresh_log_warn "warning: compose image discovery failed (status=$status); skipping stale image cleanup"
    [[ -n "$stderr_output" ]] && printf '%s\n' "$stderr_output" >&2
    return 0
  fi

  stderr_file="$(mktemp "${TMPDIR:-/tmp}/release-refresh-compose-refs-stderr.XXXXXX")"
  set +e
  python3 - "$compose_output_file" >"$refs_file" 2>"$stderr_file" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

seen: set[str] = set()
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    match = re.match(r"^\s*image:\s*(\S+)\s*$", line)
    if not match:
        continue
    image_ref = match.group(1).strip()
    if not image_ref or image_ref in seen:
        continue
    seen.add(image_ref)
    print(image_ref)
PY
  parse_status=$?
  set -e

  stderr_output="$(tr -d '\r' <"$stderr_file")"
  rm -f "$stderr_file"

  if [[ "$parse_status" -ne 0 ]]; then
    rm -f "$compose_output_file" "$refs_file"
    release_refresh_log_warn "warning: compose image discovery failed (status=$parse_status); skipping stale image cleanup"
    [[ -n "$stderr_output" ]] && printf '%s\n' "$stderr_output" >&2
    return 0
  fi

  image_refs="$(cat "$refs_file")"
  rm -f "$compose_output_file" "$refs_file"
  collect_image_ids_for_refs "$image_refs" || true
}

image_id_is_protected() {
  local image_id="${1:-}"
  local protected_image_ids="${2:-}"
  local protected_id

  [[ -n "$image_id" && -n "$protected_image_ids" ]] || return 1

  while IFS= read -r protected_id; do
    [[ -n "$protected_id" ]] || continue
    if [[ "$protected_id" == "$image_id" ]]; then
      return 0
    fi
  done <<<"$protected_image_ids"

  return 1
}

stop_release_stack() {
  local project_name

  project_name="$(release_compose_project_name)"
  release_refresh_log_info "stopping release stack containers for project ${project_name}"
  compose_release stop || true
}

collect_release_project_volume_names() {
  docker volume ls --format '{{.Name}} {{.Labels}}' 2>/dev/null | awk -v project="$(release_compose_project_name)" '
    index($0, "com.docker.compose.project=" project) > 0 { print $1 }
  '
}

cleanup_release_stack() {
  local protected_image_ids="${1:-}"
  local project_name container_ids image_ids image_id compose_image_ids

  project_name="$(release_compose_project_name)"
  container_ids="$(collect_release_stack_container_ids)"
  image_ids="$(collect_release_stack_image_ids "$container_ids")"
  compose_image_ids="$(collect_current_compose_image_ids || true)"
  if [[ -n "$compose_image_ids" ]]; then
    image_ids="$(printf '%s\n%s\n' "$image_ids" "$compose_image_ids" | awk 'NF && !seen[$0]++')"
  fi

  if [[ -z "$container_ids" ]]; then
    release_refresh_log_info "no existing release stack containers found for project ${project_name}; continuing cleanup for networks/images"
  else
    stop_release_stack
  fi

  release_refresh_log_info "removing release stack containers and networks for project ${project_name} (volumes preserved)"
  compose_release down --remove-orphans || true

  while IFS= read -r image_id; do
    [[ -n "$image_id" ]] || continue
    if image_id_is_protected "$image_id" "$protected_image_ids"; then
      release_refresh_log_info "keeping image in refreshed target set: ${image_id}"
      continue
    fi
    if docker image rm "$image_id" >/dev/null 2>&1; then
      release_refresh_log_info "removed previous release image: ${image_id}"
      continue
    fi
    release_refresh_log_warn "unable to remove previous release image (likely still used elsewhere): ${image_id}"
  done <<<"$image_ids"

  release_refresh_log_info "cleanup completed for project ${project_name}; volumes were preserved"
}

cleanup_release_stack_and_volumes() {
  local project_name volume_name

  project_name="$(release_compose_project_name)"
  cleanup_release_stack "$@"

  while IFS= read -r volume_name; do
    [[ -n "$volume_name" ]] || continue
    if docker volume rm "$volume_name" >/dev/null 2>&1; then
      release_refresh_log_info "removed release project volume: ${volume_name}"
      continue
    fi
    release_refresh_log_warn "unable to remove release project volume (likely still used elsewhere): ${volume_name}"
  done < <(collect_release_project_volume_names)

  release_refresh_log_info "cleanup-all completed for project ${project_name}; release project volumes were removed"
}
