#!/bin/bash
set -euo pipefail

log() {
    echo "[CodexSkills] $*"
}

is_true() {
    case "${1:-}" in
        1|true|TRUE|True|yes|YES|on|ON)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

build_clone_urls() {
    local repo="$1"
    local -a urls=()
    local prefixes_csv=""

    if is_true "${GIT_MIRROR_ENABLED:-false}"; then
        prefixes_csv="${GIT_MIRROR_PREFIXES:-${GIT_MIRROR_PREFIX:-}}"
    fi

    if [ -n "$prefixes_csv" ]; then
        local -a prefixes=()
        local prefix=""
        IFS=',' read -r -a prefixes <<< "$prefixes_csv"
        for prefix in "${prefixes[@]}"; do
            prefix="$(echo "$prefix" | xargs)"
            [ -z "$prefix" ] && continue
            urls+=("${prefix%/}/https://github.com/${repo}.git")
        done
    fi

    urls+=("https://github.com/${repo}.git")
    printf '%s\n' "${urls[@]}"
}

install_one_skill() {
    local skill_name="$1"
    local repo="$2"
    local source_path="$3"
    local ref="$4"
    local skills_root="$5"
    local tmp_root="$6"

    local skill_dir="${skills_root}/${skill_name}"
    local checkout_dir=""
    local source_dir=""
    local -a clone_urls=()
    local url=""

    if [ -f "${skill_dir}/SKILL.md" ]; then
        log "已安装，跳过: ${skill_name}"
        return 0
    fi

    mapfile -t clone_urls < <(build_clone_urls "$repo")

    for url in "${clone_urls[@]}"; do
        checkout_dir="${tmp_root}/${skill_name}-checkout"
        rm -rf "$checkout_dir"

        log "尝试拉取 ${skill_name} (${url})"
        if ! git clone \
            --filter=blob:none \
            --depth 1 \
            --sparse \
            --single-branch \
            --branch "$ref" \
            "$url" \
            "$checkout_dir" >/dev/null 2>&1; then
            continue
        fi

        if ! git -C "$checkout_dir" sparse-checkout set "$source_path" >/dev/null 2>&1; then
            continue
        fi

        source_dir="${checkout_dir}/${source_path}"
        if [ ! -d "$source_dir" ]; then
            continue
        fi

        rm -rf "$skill_dir"
        mkdir -p "$skill_dir"
        cp -a "${source_dir}/." "$skill_dir/"

        if [ ! -f "${skill_dir}/SKILL.md" ]; then
            rm -rf "$skill_dir"
            log "安装失败（缺少 SKILL.md）: ${skill_name}"
            return 1
        fi

        log "安装成功: ${skill_name}"
        return 0
    done

    log "安装失败（无法拉取或路径不存在）: ${skill_name}"
    return 1
}

CODEX_HOME="${CODEX_HOME:-/app/data/mcp/codex-home}"
CODEX_SKILLS_AUTO_INSTALL="${CODEX_SKILLS_AUTO_INSTALL:-true}"
CODEX_SKILLS_FAIL_ON_ERROR="${CODEX_SKILLS_FAIL_ON_ERROR:-true}"
SKILLS_ROOT="${CODEX_HOME}/skills"

if ! is_true "$CODEX_SKILLS_AUTO_INSTALL"; then
    log "自动安装已关闭（CODEX_SKILLS_AUTO_INSTALL=${CODEX_SKILLS_AUTO_INSTALL}）"
    exit 0
fi

if ! command -v git >/dev/null 2>&1; then
    log "未找到 git，无法安装 codex skills"
    if is_true "$CODEX_SKILLS_FAIL_ON_ERROR"; then
        exit 1
    fi
    exit 0
fi

mkdir -p "$SKILLS_ROOT"
TMP_ROOT="$(mktemp -d /tmp/codex-skills.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

FAILED_COUNT=0
declare -a FAILED_SKILLS=()
declare -a SKILL_DEFINITIONS=(
    "project-context|scientiacapital/skills|stable/project-context-skill|main"
    "codebase-exploration|404kidwiz/claude-supercode-skills|codebase-exploration-skill|main"
    "ray-so-code-snippet|intellectronica/agent-skills|skills/ray-so-code-snippet|main"
    "codebase-documenter|mhattingpete/claude-skills-marketplace|productivity-skills-plugin/skills/codebase-documenter|main"
)

log "开始安装 codex skills 到 ${SKILLS_ROOT}"

for definition in "${SKILL_DEFINITIONS[@]}"; do
    IFS='|' read -r skill_name repo source_path ref <<< "$definition"
    if ! install_one_skill "$skill_name" "$repo" "$source_path" "$ref" "$SKILLS_ROOT" "$TMP_ROOT"; then
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_SKILLS+=("$skill_name")
    fi
done

if [ "$FAILED_COUNT" -gt 0 ]; then
    log "安装完成，失败 ${FAILED_COUNT} 个: ${FAILED_SKILLS[*]}"
    if is_true "$CODEX_SKILLS_FAIL_ON_ERROR"; then
        exit 1
    fi
    log "按配置继续启动（CODEX_SKILLS_FAIL_ON_ERROR=${CODEX_SKILLS_FAIL_ON_ERROR}）"
    exit 0
fi

log "全部 skills 安装完成"
