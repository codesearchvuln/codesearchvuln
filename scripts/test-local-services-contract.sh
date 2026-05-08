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

default_output="$(bash "$START_SCRIPT" --dry-run --skip-nexus-check)"
hybrid_output="$(bash "$START_SCRIPT" hybrid --dry-run --skip-nexus-check)"
full_output="$(bash "$START_SCRIPT" full --dry-run --skip-nexus-check)"
build_only_output="$(bash "$START_SCRIPT" full --dry-run --skip-nexus-check --build-only)"
stop_output="$(bash "$STOP_SCRIPT" --dry-run)"

assert_contains "$default_output" "Mode: default"
assert_contains "$default_output" "docker/docker-compose.yml"
assert_contains "$default_output" "docker/docker-compose.hybrid.yml"
assert_not_contains "$default_output" "docker/docker-compose.full.yml"
assert_contains "$default_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$default_output" "build backend frontend"
assert_contains "$default_output" "up -d"

assert_contains "$hybrid_output" "Mode: hybrid"
assert_contains "$hybrid_output" "docker/docker-compose.hybrid.yml"
assert_contains "$hybrid_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$hybrid_output" "build backend frontend"
assert_contains "$hybrid_output" "up -d"

assert_contains "$full_output" "Mode: full"
assert_contains "$full_output" "docker/docker-compose.full.yml"
assert_contains "$full_output" "pull db redis scan-workspace-init backend-uploads-init"
assert_contains "$full_output" "build backend frontend"
assert_contains "$full_output" "up -d"

assert_contains "$build_only_output" "build backend frontend"
assert_not_contains "$build_only_output" "up -d"

assert_contains "$stop_output" "Mode: full"
assert_contains "$stop_output" "docker/docker-compose.yml"
assert_contains "$stop_output" "docker/docker-compose.full.yml"
assert_contains "$stop_output" "down"

assert_not_matching_command "$hybrid_output" '(runner|scanner|sandbox|flow-parser)'
assert_not_matching_command "$hybrid_output" 'ghcr\.io/.*/vulhunter-.*(runner|scanner)'
assert_not_matching_command "$hybrid_output" 'unbengable12'

echo "[PASS] local service script contract"
