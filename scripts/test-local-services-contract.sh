#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_SCRIPT="$REPO_ROOT/start-local-services.sh"
STOP_SCRIPT="$REPO_ROOT/stop-local-services.sh"

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    fail "expected dry-run output to contain: $needle"
  fi
}

assert_not_matching_command() {
  local haystack="$1"
  local pattern="$2"
  if grep -E '^\[DRY-RUN\]' <<<"$haystack" | grep -Eiq "$pattern"; then
    fail "dry-run command unexpectedly matched pattern: $pattern"
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" == *"$needle"* ]]; then
    fail "dry-run output unexpectedly contained: $needle"
  fi
}

compose_config() {
  local mode="$1"
  shift || true
  local -a files=(
    --project-directory "$REPO_ROOT"
    -f "$REPO_ROOT/docker/docker-compose.yml"
  )

  case "$mode" in
    default|hybrid)
      files+=(-f "$REPO_ROOT/docker/docker-compose.hybrid.yml")
      ;;
    full)
      files+=(-f "$REPO_ROOT/docker/docker-compose.full.yml")
      ;;
    *)
      fail "unknown compose config mode: $mode"
      ;;
  esac

  docker compose "${files[@]}" config "$@"
}

assert_compose_config_local_only() {
  local mode="$1"
  local config_output services_output images_output
  local -a files=(
    --project-directory "$REPO_ROOT"
    -f "$REPO_ROOT/docker/docker-compose.yml"
  )

  if [[ "$mode" == "full" ]]; then
    files+=(-f "$REPO_ROOT/docker/docker-compose.full.yml")
  else
    files+=(-f "$REPO_ROOT/docker/docker-compose.hybrid.yml")
  fi

  config_output="$(env RUNNER_PREFLIGHT_ENABLED=false RUNNER_PREFLIGHT_STRICT=false docker compose "${files[@]}" config)"
  services_output="$(env RUNNER_PREFLIGHT_ENABLED=false RUNNER_PREFLIGHT_STRICT=false docker compose "${files[@]}" config --services)"
  images_output="$(env RUNNER_PREFLIGHT_ENABLED=false RUNNER_PREFLIGHT_STRICT=false docker compose "${files[@]}" config --images)"

  if grep -Eiq '(runner|scanner|sandbox|flow-parser)' <<<"$services_output"; then
    fail "compose services for $mode unexpectedly include runner/scanner/sandbox/flow-parser: $services_output"
  fi
  if grep -Eiq 'vulhunter-.*(runner|scanner)|sandbox-runner|flow-parser-runner' <<<"$images_output"; then
    fail "compose images for $mode unexpectedly include runner/scanner images: $images_output"
  fi

  assert_contains "$config_output" 'RUNNER_PREFLIGHT_ENABLED: "false"'
  assert_contains "$config_output" 'RUNNER_PREFLIGHT_STRICT: "false"'
  assert_contains "$images_output" "vulhunter/backend-local:latest"
  assert_contains "$images_output" "vulhunter/frontend-local:latest"
  assert_contains "$images_output" "postgres:15-alpine"
  assert_contains "$images_output" "redis:7-alpine"
  assert_contains "$images_output" "alpine:3.20"
}

[[ -f "$START_SCRIPT" ]] || fail "missing root start script: start-local-services.sh"
[[ -f "$STOP_SCRIPT" ]] || fail "missing root stop script: stop-local-services.sh"
[[ ! -e "$REPO_ROOT/build-local-images.sh" ]] || fail "build-local-images.sh should be integrated into start-local-services.sh"
[[ ! -e "$REPO_ROOT/docker-compose.yml" ]] || fail "root docker-compose.yml should move under docker/"
[[ ! -e "$REPO_ROOT/docker-compose.hybrid.yml" ]] || fail "root docker-compose.hybrid.yml should move under docker/"
[[ ! -e "$REPO_ROOT/docker-compose.full.yml" ]] || fail "root docker-compose.full.yml should move under docker/"
[[ -f "$REPO_ROOT/docker/docker-compose.yml" ]] || fail "missing docker/docker-compose.yml"
[[ -f "$REPO_ROOT/docker/docker-compose.hybrid.yml" ]] || fail "missing docker/docker-compose.hybrid.yml"
[[ -f "$REPO_ROOT/docker/docker-compose.full.yml" ]] || fail "missing docker/docker-compose.full.yml"

bash -n "$START_SCRIPT"
bash -n "$STOP_SCRIPT"

default_preflight_output="$(env -u RUNNER_PREFLIGHT_ENABLED -u RUNNER_PREFLIGHT_STRICT bash "$START_SCRIPT" --dry-run --skip-nexus-check --no-up)"
default_preflight_ignores_env_output="$(env RUNNER_PREFLIGHT_ENABLED=false RUNNER_PREFLIGHT_STRICT=false bash "$START_SCRIPT" --dry-run --skip-nexus-check --no-up)"
default_output="$(bash "$START_SCRIPT" --dry-run --skip-nexus-check --no-preflight)"
hybrid_output="$(bash "$START_SCRIPT" hybrid --dry-run --skip-nexus-check --no-preflight)"
full_output="$(bash "$START_SCRIPT" full --dry-run --skip-nexus-check --no-preflight)"
build_only_output="$(bash "$START_SCRIPT" full --dry-run --skip-nexus-check --build-only --no-preflight)"
stop_output="$(bash "$STOP_SCRIPT" --dry-run)"

assert_contains "$default_preflight_output" "RUNNER_PREFLIGHT_ENABLED=true"
assert_contains "$default_preflight_output" "RUNNER_PREFLIGHT_STRICT=true"
assert_contains "$default_preflight_output" "Remote runner/scanner/sandbox image preflight: enabled"
assert_contains "$default_preflight_ignores_env_output" "RUNNER_PREFLIGHT_ENABLED=true"
assert_contains "$default_preflight_ignores_env_output" "RUNNER_PREFLIGHT_STRICT=true"
assert_contains "$default_preflight_ignores_env_output" "Remote runner/scanner/sandbox image preflight: enabled"

assert_contains "$default_output" "Mode: default"
assert_contains "$default_output" "docker/docker-compose.yml"
assert_contains "$default_output" "docker/docker-compose.hybrid.yml"
assert_not_contains "$default_output" "docker/docker-compose.full.yml"
assert_contains "$default_output" "RUNNER_PREFLIGHT_ENABLED=false"
assert_contains "$default_output" "RUNNER_PREFLIGHT_STRICT=false"
assert_contains "$default_output" "Remote runner/scanner/sandbox image preflight: disabled by --no-preflight"
assert_contains "$default_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$default_output" "build backend frontend"
assert_contains "$default_output" "up -d --pull never"

assert_contains "$hybrid_output" "Mode: hybrid"
assert_contains "$hybrid_output" "docker/docker-compose.hybrid.yml"
assert_contains "$hybrid_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$hybrid_output" "build backend frontend"
assert_contains "$hybrid_output" "up -d --pull never"

assert_contains "$full_output" "Mode: full"
assert_contains "$full_output" "docker/docker-compose.full.yml"
assert_contains "$full_output" "RUNNER_PREFLIGHT_ENABLED=false"
assert_contains "$full_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$full_output" "build backend frontend"
assert_contains "$full_output" "up -d --pull never"

assert_contains "$build_only_output" "build backend frontend"
assert_not_contains "$build_only_output" "up -d"

assert_contains "$stop_output" "Mode: full"
assert_contains "$stop_output" "docker/docker-compose.yml"
assert_contains "$stop_output" "docker/docker-compose.full.yml"
assert_contains "$stop_output" "down"

for output in "$default_output" "$hybrid_output" "$full_output" "$build_only_output"; do
  assert_not_matching_command "$output" '(runner|scanner|sandbox|flow-parser)'
  assert_not_matching_command "$output" 'ghcr\.io/.*/vulhunter-.*(runner|scanner)'
  assert_not_matching_command "$output" 'unbengable12'
done

hybrid_overlay="$(cat "$REPO_ROOT/docker/docker-compose.hybrid.yml")"
full_overlay="$(cat "$REPO_ROOT/docker/docker-compose.full.yml")"
assert_contains "$hybrid_overlay" 'RUNNER_PREFLIGHT_ENABLED: "${RUNNER_PREFLIGHT_ENABLED:-true}"'
assert_contains "$hybrid_overlay" 'RUNNER_PREFLIGHT_STRICT: "${RUNNER_PREFLIGHT_STRICT:-true}"'
assert_contains "$full_overlay" 'RUNNER_PREFLIGHT_ENABLED: "${RUNNER_PREFLIGHT_ENABLED:-true}"'
assert_contains "$full_overlay" 'RUNNER_PREFLIGHT_STRICT: "${RUNNER_PREFLIGHT_STRICT:-true}"'

if docker compose version >/dev/null 2>&1; then
  default_config_with_defaults="$(compose_config default)"
  assert_contains "$default_config_with_defaults" 'RUNNER_PREFLIGHT_ENABLED: "true"'
  assert_contains "$default_config_with_defaults" 'RUNNER_PREFLIGHT_STRICT: "true"'
  assert_compose_config_local_only default
  assert_compose_config_local_only hybrid
  assert_compose_config_local_only full
fi

echo "[PASS] local service script contract"
