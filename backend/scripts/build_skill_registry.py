#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple
from uuid import uuid4

import yaml


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


NOISE_DIR_NAMES = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    "node_modules",
}
NOISE_FILE_NAMES = {".DS_Store"}
NOISE_SUFFIXES = {".pyc"}


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _slugify(value: str, default: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^a-z0-9._-]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or default


def _compact_summary(raw: str, fallback_name: str) -> str:
    text = re.sub(r"\s+", " ", str(raw or "")).strip()
    if not text:
        text = (
            f"{fallback_name} workflow skill mirrored into the backend registry for "
            "fast retrieval and execution."
        )
    sentences = re.split(r"(?<=[.!?。！？])\s+", text)
    cleaned = [item.strip() for item in sentences if item.strip()]
    summary = " ".join(cleaned[:2]) if cleaned else text
    return summary[:360]


def _parse_skill_markdown(skill_md: Path) -> Tuple[Dict[str, Any], str]:
    text = _read_text(skill_md)
    frontmatter: Dict[str, Any] = {}
    body = text

    if text.startswith("---"):
        lines = text.splitlines()
        closing_idx = None
        for idx in range(1, len(lines)):
            if lines[idx].strip() == "---":
                closing_idx = idx
                break
        if closing_idx is not None:
            raw_frontmatter = "\n".join(lines[1:closing_idx]).strip()
            body = "\n".join(lines[closing_idx + 1 :]).strip()
            if raw_frontmatter:
                try:
                    loaded = yaml.safe_load(raw_frontmatter) or {}
                except Exception:
                    loaded = {}
                if isinstance(loaded, dict):
                    frontmatter = loaded

    return frontmatter, body


def _extract_body_summary(body: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("```"):
            continue
        if stripped.startswith(">"):
            continue
        return stripped
    return ""


def _detect_namespace(skill_md: Path, source_root: Path) -> str:
    md_text = str(skill_md.resolve()).replace("\\", "/").lower()
    source_text = str(source_root.resolve()).replace("\\", "/").lower()

    if "/.agents/skills/" in md_text or source_text.endswith("/.agents/skills"):
        return "agents"
    if "/.codex/superpowers/skills/" in md_text or source_text.endswith("/.codex/superpowers/skills"):
        return "superpowers"
    if "/.codex/skills/" in md_text or source_text.endswith("/.codex/skills"):
        return "codex"
    if "/codex-home/skills/" in md_text or "/codex-home/skills" in source_text:
        return "codex_home"

    source_name = _slugify(source_root.name, "custom")
    return source_name.replace("-", "_")


def _iter_skill_entrypoints(source_root: Path) -> Iterable[Path]:
    for current_root, dirnames, filenames in os.walk(source_root):
        dirnames[:] = [item for item in dirnames if item not in NOISE_DIR_NAMES]
        if "SKILL.md" in filenames:
            yield Path(current_root) / "SKILL.md"


def _ignore_for_copy(_directory: str, names: List[str]) -> List[str]:
    ignored: List[str] = []
    for name in names:
        if name in NOISE_DIR_NAMES or name in NOISE_FILE_NAMES:
            ignored.append(name)
            continue
        if any(name.endswith(suffix) for suffix in NOISE_SUFFIXES):
            ignored.append(name)
    return ignored


def _copy_skill_dir(source_dir: Path, target_dir: Path) -> None:
    shutil.copytree(source_dir, target_dir, ignore=_ignore_for_copy)


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.tmp.{uuid4().hex}")
    tmp_path.write_text(content, encoding="utf-8")
    os.replace(tmp_path, path)


def _atomic_write_json(path: Path, payload: Any) -> None:
    _atomic_write_text(path, json.dumps(payload, ensure_ascii=False, indent=2))


def _replace_skills_directory(registry_root: Path, staged_skills_dir: Path) -> None:
    target_skills_dir = registry_root / "skills"
    if not staged_skills_dir.exists():
        raise FileNotFoundError(f"staged skills dir missing: {staged_skills_dir}")

    if not target_skills_dir.exists():
        os.replace(staged_skills_dir, target_skills_dir)
        return

    backup_dir = registry_root / f".skills-backup-{uuid4().hex}"
    os.replace(target_skills_dir, backup_dir)
    try:
        os.replace(staged_skills_dir, target_skills_dir)
    except Exception:
        if not target_skills_dir.exists() and backup_dir.exists():
            os.replace(backup_dir, target_skills_dir)
        raise
    else:
        shutil.rmtree(backup_dir, ignore_errors=True)


def _build_skills_markdown(entries: Sequence[Dict[str, Any]], generated_at: str) -> str:
    lines: List[str] = [
        "# SKILLS",
        "",
        "Unified backend skill registry index. Each entry includes a concise capability summary.",
        "",
        f"- Generated at: `{generated_at}`",
        f"- Total skills: **{len(entries)}**",
        "",
        "## Catalog",
    ]
    for item in entries:
        lines.append(f"- `{item['skill_id']}`: {item['summary']}")
    lines.append("")
    return "\n".join(lines)


def _normalize_source_roots(source_roots: Sequence[Path]) -> List[Path]:
    normalized: List[Path] = []
    seen: set[str] = set()
    for root in source_roots:
        try:
            resolved = root.expanduser().resolve()
        except Exception:
            resolved = root.expanduser()
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(resolved)
    return normalized


def build_skill_registry(*, registry_root: Path, source_roots: Sequence[Path]) -> Dict[str, Any]:
    registry_root = registry_root.expanduser().resolve()
    registry_root.mkdir(parents=True, exist_ok=True)

    normalized_roots = _normalize_source_roots(source_roots)
    generated_at = datetime.now(timezone.utc).isoformat()
    errors: List[Dict[str, str]] = []
    entries: List[Dict[str, Any]] = []
    alias_map: Dict[str, set[str]] = defaultdict(set)
    skill_id_counters: Dict[str, int] = defaultdict(int)

    staged_skills_dir = registry_root / f".skills-staging-{uuid4().hex}"
    staged_skills_dir.mkdir(parents=True, exist_ok=True)

    try:
        for source_root in normalized_roots:
            if not source_root.exists() or not source_root.is_dir():
                continue

            for skill_md in _iter_skill_entrypoints(source_root):
                source_dir = skill_md.parent
                try:
                    frontmatter, body = _parse_skill_markdown(skill_md)
                    explicit_name = str(frontmatter.get("name") or "").strip()
                    display_name = explicit_name or source_dir.name
                    normalized_name = _slugify(display_name, "skill")
                    namespace = _detect_namespace(skill_md, source_root)
                    base_skill_id = f"{normalized_name}@{namespace}"

                    skill_id_counters[base_skill_id] += 1
                    count = skill_id_counters[base_skill_id]
                    skill_id = base_skill_id if count == 1 else f"{base_skill_id}-{count}"

                    summary_seed = str(frontmatter.get("description") or "").strip() or _extract_body_summary(body)
                    summary = _compact_summary(summary_seed, fallback_name=display_name)
                    mirror_dir = staged_skills_dir / skill_id
                    _copy_skill_dir(source_dir, mirror_dir)

                    if not (mirror_dir / "SKILL.md").exists():
                        errors.append(
                            {
                                "source": str(skill_md),
                                "error": "mirrored skill missing SKILL.md",
                            }
                        )
                        shutil.rmtree(mirror_dir, ignore_errors=True)
                        continue

                    files_count = sum(1 for item in mirror_dir.rglob("*") if item.is_file())
                    aliases = {
                        normalized_name,
                        _slugify(source_dir.name, "skill"),
                    }
                    if explicit_name:
                        aliases.add(_slugify(explicit_name, "skill"))

                    entry = {
                        "skill_id": skill_id,
                        "name": display_name,
                        "namespace": namespace,
                        "summary": summary,
                        "entrypoint": f"skills/{skill_id}/SKILL.md",
                        "mirror_dir": f"skills/{skill_id}",
                        "source_root": str(source_root),
                        "source_dir": str(source_dir),
                        "source_skill_md": str(skill_md),
                        "aliases": sorted(item for item in aliases if item),
                        "has_scripts": (mirror_dir / "scripts").exists(),
                        "has_bin": (mirror_dir / "bin").exists(),
                        "has_assets": (mirror_dir / "assets").exists(),
                        "files_count": files_count,
                    }
                    entries.append(entry)

                    for alias in entry["aliases"]:
                        alias_map[alias].add(skill_id)

                except Exception as exc:
                    errors.append({"source": str(skill_md), "error": str(exc)})

        entries.sort(key=lambda item: item["skill_id"])
        aliases_payload = {
            alias: sorted(list(skill_ids))
            for alias, skill_ids in sorted(alias_map.items(), key=lambda item: item[0])
        }
        manifest_payload = {
            "schema_version": "1.0",
            "generated_at": generated_at,
            "registry_root": str(registry_root),
            "total_skills": len(entries),
            "total_aliases": len(aliases_payload),
            "source_roots": [str(item) for item in normalized_roots],
            "skills": entries,
            "errors": errors,
        }
        skills_markdown = _build_skills_markdown(entries, generated_at=generated_at)

        _replace_skills_directory(registry_root, staged_skills_dir)
        _atomic_write_text(registry_root / "SKILLS.md", skills_markdown)
        _atomic_write_json(registry_root / "manifest.json", manifest_payload)
        _atomic_write_json(registry_root / "aliases.json", aliases_payload)

        return {
            "registry_root": str(registry_root),
            "generated_at": generated_at,
            "total_skills": len(entries),
            "total_aliases": len(aliases_payload),
            "errors": errors,
            "source_roots": [str(item) for item in normalized_roots],
        }
    finally:
        if staged_skills_dir.exists():
            shutil.rmtree(staged_skills_dir, ignore_errors=True)


def _parse_cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build unified backend skill registry.")
    parser.add_argument(
        "--registry-root",
        type=str,
        default="",
        help="Target registry root directory. Defaults to Settings.SKILL_REGISTRY_ROOT.",
    )
    parser.add_argument(
        "--source-root",
        dest="source_roots",
        action="append",
        default=[],
        help="Skill source root. Can be repeated.",
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print result as JSON.",
    )
    return parser.parse_args()


def main() -> int:
    from app.core.config import settings

    args = _parse_cli_args()
    enabled = bool(getattr(settings, "SKILL_REGISTRY_ENABLED", True))
    if not enabled:
        result = {
            "enabled": False,
            "message": "Skill registry is disabled by configuration.",
        }
        if args.print_json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("[SkillRegistry] disabled by configuration")
        return 0

    registry_root = Path(args.registry_root or getattr(settings, "SKILL_REGISTRY_ROOT", "./data/mcp/skill-registry"))
    configured_source_roots = list(getattr(settings, "SKILL_SOURCE_ROOTS", []) or [])
    cli_source_roots = list(args.source_roots or [])
    source_roots = [Path(item) for item in (cli_source_roots or configured_source_roots)]

    result = build_skill_registry(
        registry_root=registry_root,
        source_roots=source_roots,
    )
    if args.print_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(
            "[SkillRegistry] built "
            f"{result.get('total_skills', 0)} skills "
            f"(aliases={result.get('total_aliases', 0)}) at {result.get('registry_root')}"
        )
        if result.get("errors"):
            print(f"[SkillRegistry] warnings: {len(result['errors'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
