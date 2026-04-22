#!/usr/bin/env bash
# Regression test for the sourcecode branch change-detection logic
# used in .github/workflows/publish-sourcecode.yml (detect_changes step).
#
# Exercises three scenarios:
#   1. First publish (no remote branch) → has_changes=true
#   2. Identical tree re-publish        → has_changes=false
#   3. Modified tree                    → has_changes=true
#
# Runs entirely inside a disposable temp directory; no network access needed.

set -uo pipefail

PASS=0
FAIL=0
report() {
  local label="$1" expected="$2" actual="$3"
  if [[ "${actual}" == "${expected}" ]]; then
    echo "  PASS: ${label} (expected=${expected})"
    (( PASS++ )) || true
  else
    echo "  FAIL: ${label} (expected=${expected}, got=${actual})"
    (( FAIL++ )) || true
  fi
}

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# ── helper: replicate the workflow's tree-hash function ──────────────
git_tree_hash_for_dir() {
  local source_dir="$1"
  local repo_dir="$2"

  rm -rf "${repo_dir}"
  mkdir -p "${repo_dir}"
  git init -q "${repo_dir}"

  if [[ -d "${source_dir}" ]]; then
    cp -a "${source_dir}/." "${repo_dir}/"
  fi

  git -C "${repo_dir}" add -A
  git -C "${repo_dir}" write-tree
}

# ── helper: replicate the workflow's detect-changes logic ────────────
detect_changes() {
  local sourcecode_dir="$1"
  local origin_repo="$2"
  local compare_dir="${WORK}/compare"

  local candidate_tree
  candidate_tree="$(git_tree_hash_for_dir "${sourcecode_dir}" "${compare_dir}")"

  local has_changes=true
  if git -C "${origin_repo}" rev-parse --verify refs/heads/sourcecode >/dev/null 2>&1; then
    local remote_tree
    remote_tree="$(git -C "${origin_repo}" rev-parse refs/heads/sourcecode^{tree})"
    if [[ "${candidate_tree}" == "${remote_tree}" ]]; then
      has_changes=false
    fi
  fi
  echo "${has_changes}"
}

# ── helper: push a directory as the sourcecode branch on a bare repo ─
push_as_sourcecode() {
  local source_dir="$1"
  local bare_repo="$2"
  local staging="${WORK}/push-staging"

  rm -rf "${staging}"
  mkdir -p "${staging}"
  git init -q "${staging}"
  cp -R "${source_dir}/." "${staging}/"
  git -C "${staging}" add -A
  git -C "${staging}" -c user.name=test -c user.email=test@test commit -q -m "snapshot"
  git -C "${staging}" push -q --force "${bare_repo}" HEAD:refs/heads/sourcecode
  rm -rf "${staging}"
}

# ── setup ────────────────────────────────────────────────────────────
ORIGIN_REPO="${WORK}/origin.git"
git init -q --bare "${ORIGIN_REPO}"

SOURCECODE_DIR="${WORK}/sourcecode-tree"
mkdir -p "${SOURCECODE_DIR}"
echo "hello" > "${SOURCECODE_DIR}/README.md"
echo '{}' > "${SOURCECODE_DIR}/docker-compose.yml"

# ── Scenario 1: no remote sourcecode branch → has_changes=true ───────
echo "Scenario 1: first publish (no remote branch)"
result="$(detect_changes "${SOURCECODE_DIR}" "${ORIGIN_REPO}")"
report "no remote branch → has_changes" "true" "${result}"

# ── simulate a prior publish ─────────────────────────────────────────
push_as_sourcecode "${SOURCECODE_DIR}" "${ORIGIN_REPO}"

# ── Scenario 2: identical tree → has_changes=false ───────────────────
echo "Scenario 2: identical tree re-publish"
result="$(detect_changes "${SOURCECODE_DIR}" "${ORIGIN_REPO}")"
report "identical tree → has_changes" "false" "${result}"

# ── Scenario 3: modified tree → has_changes=true ─────────────────────
echo "Scenario 3: modified tree"
echo "world" >> "${SOURCECODE_DIR}/README.md"
result="$(detect_changes "${SOURCECODE_DIR}" "${ORIGIN_REPO}")"
report "modified tree → has_changes" "true" "${result}"

# ── summary ──────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
if (( FAIL > 0 )); then
  exit 1
fi
