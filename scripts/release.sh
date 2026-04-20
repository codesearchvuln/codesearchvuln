#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
只读预览 release 分支语义化版本，不修改代码、不更新文件、不创建 tag。

用法:
  ./scripts/release.sh [source-sha]

示例:
  ./scripts/release.sh
  ./scripts/release.sh HEAD
  ./scripts/release.sh 38d723efdde378a5e0d846886294aa54c519e875
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if ! git -C "${ROOT_DIR}" rev-parse --git-dir >/dev/null 2>&1; then
  echo "[ERROR] 当前目录不是 Git 仓库" >&2
  exit 1
fi

SOURCE_SHA="${1:-HEAD}"
RESOLVED_SOURCE_SHA="$(git -C "${ROOT_DIR}" rev-parse "${SOURCE_SHA}")"

echo "[INFO] release.sh 已切换为只读预览模式"
echo "[INFO] 版本真源为 release workflow 创建的 Git tag"
echo "[INFO] 当前受管版本轨道: v0.0.*"
echo "[INFO] 预览 source_sha: ${RESOLVED_SOURCE_SHA}"
echo

python3 "${ROOT_DIR}/scripts/release_version.py" \
  --repo "${ROOT_DIR}" \
  --source-sha "${RESOLVED_SOURCE_SHA}" \
  --format text
