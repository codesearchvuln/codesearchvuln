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

collect_release_stack_container_ids() {
  docker ps -aq --filter "label=com.docker.compose.project=$(release_compose_project_name)" | tr -d '\r'
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

collect_compose_image_refs() {
  local compose_output

  compose_output="$(compose_release config)"

  COMPOSE_CONFIG="$compose_output" python3 - <<'PY'
from __future__ import annotations

import os
import re

seen: set[str] = set()
for line in os.environ.get("COMPOSE_CONFIG", "").splitlines():
    match = re.match(r"^\s*image:\s*(\S+)\s*$", line)
    if not match:
        continue
    image_ref = match.group(1).strip()
    if not image_ref or image_ref in seen:
        continue
    seen.add(image_ref)
    print(image_ref)
PY
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
  local image_refs

  image_refs="$(collect_compose_image_refs)"
  collect_image_ids_for_refs "$image_refs"
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
  release_refresh_log_info "[trace:cleanup] collecting container ids"
  container_ids="$(collect_release_stack_container_ids)"
  release_refresh_log_info "[trace:cleanup] collecting stack image ids"
  image_ids="$(collect_release_stack_image_ids "$container_ids")"
  release_refresh_log_info "[trace:cleanup] collecting compose image ids"
  compose_image_ids="$(collect_current_compose_image_ids)"
  release_refresh_log_info "[trace:cleanup] compose image ids collected (${#compose_image_ids} chars)"
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
