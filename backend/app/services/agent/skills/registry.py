from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


class SkillRegistryService:
    def __init__(
        self,
        *,
        root: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.enabled = bool(settings.SKILL_REGISTRY_ENABLED if enabled is None else enabled)
        self.root = Path(root or settings.SKILL_REGISTRY_ROOT).expanduser()
        self._manifest_path = self.root / "manifest.json"
        self._aliases_path = self.root / "aliases.json"
        self._lock = Lock()
        self._manifest_cache: Dict[str, Any] = {}
        self._manifest_mtime: Optional[float] = None
        self._aliases_cache: Dict[str, List[str]] = {}
        self._aliases_mtime: Optional[float] = None

    @staticmethod
    def _path_mtime(path: Path) -> Optional[float]:
        try:
            return path.stat().st_mtime
        except Exception:
            return None

    @staticmethod
    def _load_json(path: Path) -> Any:
        text = path.read_text(encoding="utf-8", errors="replace")
        return json.loads(text)

    def _empty_manifest(self, error: Optional[str] = None) -> Dict[str, Any]:
        payload = {
            "schema_version": "1.0",
            "generated_at": None,
            "registry_root": str(self.root),
            "total_skills": 0,
            "skills": [],
            "errors": [],
        }
        if error:
            payload["errors"] = [{"error": error}]
        return payload

    def _refresh_manifest_cache_locked(self) -> Dict[str, Any]:
        current_mtime = self._path_mtime(self._manifest_path)
        if self._manifest_cache and self._manifest_mtime == current_mtime:
            return self._manifest_cache

        if not self.enabled:
            self._manifest_cache = self._empty_manifest("skill_registry_disabled")
            self._manifest_mtime = current_mtime
            return self._manifest_cache

        if not self._manifest_path.exists():
            self._manifest_cache = self._empty_manifest("manifest_not_found")
            self._manifest_mtime = current_mtime
            return self._manifest_cache

        try:
            payload = self._load_json(self._manifest_path)
            if not isinstance(payload, dict):
                raise ValueError("manifest json must be an object")
            skills = payload.get("skills")
            if not isinstance(skills, list):
                payload["skills"] = []
            self._manifest_cache = payload
            self._manifest_mtime = current_mtime
        except Exception as exc:
            logger.warning("[SkillRegistry] failed to load manifest: %s", exc)
            self._manifest_cache = self._empty_manifest(f"manifest_load_failed:{exc}")
            self._manifest_mtime = current_mtime
        return self._manifest_cache

    def _refresh_aliases_cache_locked(self) -> Dict[str, List[str]]:
        current_mtime = self._path_mtime(self._aliases_path)
        if self._aliases_cache and self._aliases_mtime == current_mtime:
            return self._aliases_cache

        if not self.enabled or not self._aliases_path.exists():
            self._aliases_cache = {}
            self._aliases_mtime = current_mtime
            return self._aliases_cache

        try:
            payload = self._load_json(self._aliases_path)
            if isinstance(payload, dict) and isinstance(payload.get("aliases"), dict):
                payload = payload.get("aliases") or {}
            aliases: Dict[str, List[str]] = {}
            if isinstance(payload, dict):
                for alias, target in payload.items():
                    key = str(alias or "").strip().lower()
                    if not key:
                        continue
                    if isinstance(target, list):
                        aliases[key] = [str(item).strip() for item in target if str(item).strip()]
                    elif isinstance(target, str) and target.strip():
                        aliases[key] = [target.strip()]
            self._aliases_cache = aliases
            self._aliases_mtime = current_mtime
        except Exception as exc:
            logger.warning("[SkillRegistry] failed to load aliases: %s", exc)
            self._aliases_cache = {}
            self._aliases_mtime = current_mtime
        return self._aliases_cache

    def load_manifest(self) -> Dict[str, Any]:
        with self._lock:
            return self._refresh_manifest_cache_locked()

    def load_aliases(self) -> Dict[str, List[str]]:
        with self._lock:
            return self._refresh_aliases_cache_locked()

    @staticmethod
    def _public_item(skill: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "skill_id": str(skill.get("skill_id") or ""),
            "name": str(skill.get("name") or ""),
            "namespace": str(skill.get("namespace") or ""),
            "summary": str(skill.get("summary") or ""),
            "entrypoint": str(skill.get("entrypoint") or ""),
            "aliases": list(skill.get("aliases") or []),
            "has_scripts": bool(skill.get("has_scripts")),
            "has_bin": bool(skill.get("has_bin")),
            "has_assets": bool(skill.get("has_assets")),
        }

    @staticmethod
    def _score_skill(skill: Dict[str, Any], query: str) -> int:
        text = query.strip().lower()
        if not text:
            return 0
        tokens = [token for token in re.split(r"[\s\-_@/]+", text) if token]
        if not tokens:
            return 0

        skill_id = str(skill.get("skill_id") or "").lower()
        name = str(skill.get("name") or "").lower()
        summary = str(skill.get("summary") or "").lower()
        aliases = [str(item).lower() for item in (skill.get("aliases") or [])]

        score = 0
        if text == skill_id:
            score += 200
        if text == name:
            score += 120
        if text in skill_id:
            score += 80
        if text in name:
            score += 60
        if text in summary:
            score += 30
        if any(text == alias for alias in aliases):
            score += 70
        if any(text in alias for alias in aliases):
            score += 20

        for token in tokens:
            if token in skill_id:
                score += 12
            if token in name:
                score += 10
            if token in summary:
                score += 4
            if any(token in alias for alias in aliases):
                score += 6
        return score

    def search(
        self,
        *,
        query: str = "",
        namespace: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        manifest = self.load_manifest()
        skills = list(manifest.get("skills") or [])
        namespace_filter = str(namespace or "").strip().lower()

        if namespace_filter:
            skills = [
                item
                for item in skills
                if str(item.get("namespace") or "").strip().lower() == namespace_filter
            ]

        query_text = str(query or "").strip().lower()
        scored: List[tuple[int, Dict[str, Any]]] = []
        if query_text:
            for skill in skills:
                score = self._score_skill(skill, query_text)
                if score <= 0:
                    continue
                scored.append((score, skill))
            scored.sort(key=lambda item: (-item[0], str(item[1].get("skill_id") or "")))
            filtered = [item[1] for item in scored]
        else:
            filtered = sorted(skills, key=lambda item: str(item.get("skill_id") or ""))

        total = len(filtered)
        safe_limit = max(1, min(_coerce_int(limit, 20), 200))
        safe_offset = max(0, _coerce_int(offset, 0))
        paged = filtered[safe_offset : safe_offset + safe_limit]

        result: Dict[str, Any] = {
            "enabled": self.enabled,
            "total": total,
            "limit": safe_limit,
            "offset": safe_offset,
            "items": [self._public_item(item) for item in paged],
        }
        manifest_errors = list(manifest.get("errors") or [])
        if manifest_errors:
            first = manifest_errors[0]
            if isinstance(first, dict):
                result["error"] = str(first.get("error") or "")
            else:
                result["error"] = str(first)
        return result

    def get_detail(self, *, skill_id: str, include_workflow: bool = False) -> Optional[Dict[str, Any]]:
        manifest = self.load_manifest()
        skill_id_text = str(skill_id or "").strip()
        if not skill_id_text:
            return None

        skills = list(manifest.get("skills") or [])
        target = next((item for item in skills if str(item.get("skill_id")) == skill_id_text), None)

        if target is None:
            alias_map = self.load_aliases()
            aliased_ids = alias_map.get(skill_id_text.lower()) or []
            if aliased_ids:
                preferred = aliased_ids[0]
                target = next((item for item in skills if str(item.get("skill_id")) == preferred), None)

        if target is None:
            return None

        detail = dict(target)
        if include_workflow:
            entrypoint = str(detail.get("entrypoint") or "").strip()
            workflow_path = self.root / entrypoint if entrypoint else None
            if workflow_path and workflow_path.exists():
                content = workflow_path.read_text(encoding="utf-8", errors="replace")
                max_chars = 60_000
                detail["workflow_content"] = content[:max_chars]
                detail["workflow_truncated"] = len(content) > max_chars
            else:
                detail["workflow_content"] = ""
                detail["workflow_truncated"] = False
                detail["workflow_error"] = "workflow_not_found"
        return detail


@lru_cache(maxsize=1)
def get_skill_registry_service() -> SkillRegistryService:
    return SkillRegistryService()

