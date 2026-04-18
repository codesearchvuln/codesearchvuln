from __future__ import annotations

from dataclasses import asdict, dataclass, field
import fnmatch
import os
import re
from typing import Any, Dict, Iterable, List, Sequence


_LANGUAGE_BY_EXT = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".php": "PHP",
    ".rb": "Ruby",
    ".rs": "Rust",
    ".c": "C",
    ".cc": "C++",
    ".cpp": "C++",
    ".h": "C/C++",
    ".hpp": "C/C++",
}

_FRAMEWORK_FILE_HINTS: Sequence[tuple[str, str]] = (
    ("next.config.js", "Next.js"),
    ("next.config.mjs", "Next.js"),
    ("next.config.ts", "Next.js"),
    ("nest-cli.json", "NestJS"),
    ("manage.py", "Django"),
    ("requirements.txt", "Python"),
    ("pom.xml", "Spring"),
    ("go.mod", "Go"),
)

_SEMANTIC_MODULE_TYPES = {
    "api": "api",
    "apis": "api",
    "route": "api",
    "routes": "api",
    "controller": "api",
    "controllers": "api",
    "resolver": "api",
    "resolvers": "api",
    "auth": "auth",
    "authentication": "auth",
    "login": "auth",
    "admin": "admin",
    "management": "admin",
    "payment": "payment",
    "payments": "payment",
    "billing": "payment",
    "order": "payment",
    "orders": "payment",
    "upload": "upload",
    "uploads": "upload",
    "download": "upload",
    "downloads": "upload",
    "webhook": "webhook",
    "webhooks": "webhook",
    "callback": "webhook",
    "callbacks": "webhook",
    "worker": "worker",
    "workers": "worker",
    "job": "worker",
    "jobs": "worker",
    "consumer": "worker",
    "consumers": "worker",
    "queue": "worker",
    "middleware": "cross_cutting",
    "guard": "cross_cutting",
    "guards": "cross_cutting",
    "interceptor": "cross_cutting",
    "interceptors": "cross_cutting",
    "filter": "cross_cutting",
    "filters": "cross_cutting",
    "repository": "storage",
    "repositories": "storage",
    "dao": "storage",
    "db": "storage",
    "database": "storage",
    "model": "storage",
    "models": "storage",
    "persistence": "storage",
    "frontend": "frontend",
    "pages": "frontend",
    "components": "frontend",
}

_MODULE_PRIORITY = {
    "auth": 100,
    "admin": 95,
    "payment": 92,
    "upload": 90,
    "webhook": 88,
    "api": 85,
    "worker": 75,
    "storage": 70,
    "cross_cutting": 65,
    "frontend": 50,
    "shared": 40,
}

_RISK_FOCUS_BY_MODULE = {
    "auth": ["authentication", "authorization", "session", "credential_flow"],
    "admin": ["authorization", "privilege_boundary", "configuration"],
    "payment": ["amount_tampering", "state_machine", "callback_validation"],
    "upload": ["path_traversal", "unsafe_file_write", "content_type_bypass"],
    "webhook": ["ssrf", "callback_validation", "signature_verification"],
    "api": ["input_surface", "injection", "access_control"],
    "worker": ["deserialization", "message_validation", "task_injection"],
    "storage": ["sql_injection", "raw_query", "unsafe_persistence"],
    "cross_cutting": ["middleware_bypass", "security_headers", "shared_guardrails"],
    "frontend": ["xss", "server_action", "api_route"],
    "shared": ["input_validation", "sensitive_helpers"],
}

_ENTRYPOINT_HINTS = (
    "route",
    "routes/",
    "controller",
    "resolver",
    "middleware",
    "app/api/",
    "pages/api/",
    "main.py",
    "main.ts",
    "main.js",
    "server.ts",
    "server.js",
)


def _normalize_rel_path(path: str) -> str:
    return str(path or "").strip().replace("\\", "/").lstrip("./")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", str(value or "").strip().lower())
    return slug.strip("_") or "root"


def _normalize_patterns(patterns: Sequence[str] | None) -> List[str]:
    normalized: List[str] = []
    for pattern in patterns or []:
        text = str(pattern or "").strip().replace("\\", "/")
        if text:
            normalized.append(text)
    return normalized


def _should_exclude(path: str, patterns: Sequence[str] | None) -> bool:
    normalized = _normalize_rel_path(path)
    for pattern in _normalize_patterns(patterns):
        if pattern.endswith("/**"):
            prefix = pattern[:-3].strip("/")
            if normalized == prefix or normalized.startswith(prefix + "/"):
                return True
            continue
        if fnmatch.fnmatch(normalized, pattern):
            return True
        if "/" not in pattern and "*" not in pattern and "?" not in pattern:
            if normalized == pattern or normalized.startswith(pattern + "/"):
                return True
            if f"/{pattern}/" in f"/{normalized}/":
                return True
    return False


def _iter_project_files(
    *,
    project_root: str,
    exclude_patterns: Sequence[str] | None = None,
    target_files: Sequence[str] | None = None,
) -> List[str]:
    normalized_targets = {
        _normalize_rel_path(path)
        for path in (target_files or [])
        if isinstance(path, str) and str(path).strip()
    }
    if normalized_targets:
        return sorted(path for path in normalized_targets if not _should_exclude(path, exclude_patterns))

    files: List[str] = []
    for root, dirs, filenames in os.walk(project_root):
        rel_dir = _normalize_rel_path(os.path.relpath(root, project_root))
        if rel_dir == ".":
            rel_dir = ""
        dirs[:] = [
            dirname
            for dirname in dirs
            if not _should_exclude(
                f"{rel_dir}/{dirname}" if rel_dir else dirname,
                exclude_patterns,
            )
        ]
        for filename in filenames:
            relative = _normalize_rel_path(
                os.path.relpath(os.path.join(root, filename), project_root)
            )
            if _should_exclude(relative, exclude_patterns):
                continue
            files.append(relative)
    return sorted(files)


def _detect_frameworks(files: Sequence[str]) -> List[str]:
    lowered = {path.lower() for path in files}
    frameworks: List[str] = []
    for hint_file, label in _FRAMEWORK_FILE_HINTS:
        if hint_file.lower() in lowered and label not in frameworks:
            frameworks.append(label)
    if any("app/api/" in path or "pages/api/" in path for path in lowered):
        frameworks.append("Next.js")
    if any(".controller.ts" in path for path in lowered):
        frameworks.append("NestJS")
    return frameworks


def _detect_languages(files: Sequence[str]) -> List[str]:
    languages: List[str] = []
    for path in files:
        ext = os.path.splitext(path)[1].lower()
        language = _LANGUAGE_BY_EXT.get(ext)
        if language and language not in languages:
            languages.append(language)
    return languages


def _classify_module_anchor(path: str) -> tuple[str, str]:
    normalized = _normalize_rel_path(path)
    parts = [part for part in normalized.split("/") if part]
    if not parts:
        return "root", "shared"

    for idx, part in enumerate(parts[:-1]):
        module_type = _SEMANTIC_MODULE_TYPES.get(part.lower())
        if module_type:
            anchor = "/".join(parts[: idx + 1]) or "root"
            return anchor, module_type

    if len(parts) >= 2 and parts[0] in {"src", "app", "server", "backend"}:
        anchor = "/".join(parts[:2])
        return anchor, "shared"
    return parts[0], "shared"


def _is_entrypoint(path: str) -> bool:
    lowered = path.lower()
    return any(hint in lowered for hint in _ENTRYPOINT_HINTS)


@dataclass
class ReconModuleDescriptor:
    module_id: str
    name: str
    module_type: str
    paths: List[str] = field(default_factory=list)
    description: str = ""
    entrypoints: List[str] = field(default_factory=list)
    language_hints: List[str] = field(default_factory=list)
    framework_hints: List[str] = field(default_factory=list)
    risk_focus: List[str] = field(default_factory=list)
    priority: int = 0
    estimated_size: int = 0
    target_files: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProjectReconModel:
    project_root: str
    languages: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    entry_points: List[str] = field(default_factory=list)
    key_directories: List[str] = field(default_factory=list)
    module_descriptors: List[ReconModuleDescriptor] = field(default_factory=list)
    global_risk_themes: List[str] = field(default_factory=list)
    cross_cutting_paths: List[str] = field(default_factory=list)
    target_files: List[str] = field(default_factory=list)
    scope_limited: bool = False

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["module_descriptors"] = [item.to_dict() for item in self.module_descriptors]
        return payload


@dataclass
class ReconModuleResult:
    module_id: str
    success: bool
    risk_points: List[Dict[str, Any]] = field(default_factory=list)
    files_read: List[str] = field(default_factory=list)
    files_discovered: List[str] = field(default_factory=list)
    directories_scanned: List[str] = field(default_factory=list)
    input_surfaces: List[str] = field(default_factory=list)
    trust_boundaries: List[str] = field(default_factory=list)
    target_files: List[str] = field(default_factory=list)
    summary: str = ""
    error: str | None = None
    module_name: str | None = None
    module_type: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def build_project_recon_model(
    *,
    project_root: str,
    project_info: Dict[str, Any] | None = None,
    config: Dict[str, Any] | None = None,
) -> ProjectReconModel:
    config = dict(config or {})
    project_info = dict(project_info or {})
    target_files = [
        _normalize_rel_path(path)
        for path in (config.get("target_files") or [])
        if isinstance(path, str) and str(path).strip()
    ]
    exclude_patterns = config.get("exclude_patterns") or []
    all_files = _iter_project_files(
        project_root=project_root,
        exclude_patterns=exclude_patterns,
        target_files=target_files,
    )

    grouped: Dict[str, Dict[str, Any]] = {}
    key_directories: List[str] = []
    entry_points: List[str] = []
    cross_cutting_paths: List[str] = []

    for path in all_files:
        parts = [part for part in path.split("/") if part]
        if len(parts) > 1:
            directory = "/".join(parts[:-1])
            if directory not in key_directories:
                key_directories.append(directory)

        if _is_entrypoint(path) and path not in entry_points:
            entry_points.append(path)

        anchor, module_type = _classify_module_anchor(path)
        bucket = grouped.setdefault(
            anchor,
            {
                "module_type": module_type,
                "files": [],
                "entrypoints": [],
                "languages": [],
            },
        )
        bucket["files"].append(path)
        if _is_entrypoint(path) and path not in bucket["entrypoints"]:
            bucket["entrypoints"].append(path)
        language = _LANGUAGE_BY_EXT.get(os.path.splitext(path)[1].lower())
        if language and language not in bucket["languages"]:
            bucket["languages"].append(language)
        if module_type == "cross_cutting" and anchor not in cross_cutting_paths:
            cross_cutting_paths.append(anchor)

    frameworks = _detect_frameworks(all_files)
    languages = project_info.get("languages")
    model_languages = (
        [str(item) for item in languages if str(item).strip()]
        if isinstance(languages, list) and languages
        else _detect_languages(all_files)
    )

    module_descriptors: List[ReconModuleDescriptor] = []
    for anchor, payload in grouped.items():
        module_type = str(payload.get("module_type") or "shared")
        files = sorted({_normalize_rel_path(path) for path in payload.get("files") or []})
        if not files:
            continue
        entrypoints = sorted({_normalize_rel_path(path) for path in payload.get("entrypoints") or []})
        priority = _MODULE_PRIORITY.get(module_type, 40)
        descriptor = ReconModuleDescriptor(
            module_id=_slugify(anchor),
            name=anchor,
            module_type=module_type,
            paths=[anchor],
            description=f"Inspect {anchor} for {module_type} risks",
            entrypoints=entrypoints[:20],
            language_hints=list(payload.get("languages") or []),
            framework_hints=list(frameworks),
            risk_focus=list(_RISK_FOCUS_BY_MODULE.get(module_type, _RISK_FOCUS_BY_MODULE["shared"])),
            priority=priority,
            estimated_size=len(files),
            target_files=files,
        )
        module_descriptors.append(descriptor)

    module_descriptors.sort(key=lambda item: (-item.priority, item.name))
    if not module_descriptors and all_files:
        module_descriptors.append(
            ReconModuleDescriptor(
                module_id="root_module",
                name="root_module",
                module_type="shared",
                paths=["."],
                description="Inspect the project root for shared risks",
                entrypoints=entry_points[:20],
                language_hints=list(model_languages),
                framework_hints=list(frameworks),
                risk_focus=list(_RISK_FOCUS_BY_MODULE["shared"]),
                priority=_MODULE_PRIORITY["shared"],
                estimated_size=len(all_files),
                target_files=list(all_files),
            )
        )

    global_risk_themes: List[str] = []
    for descriptor in module_descriptors:
        for theme in descriptor.risk_focus:
            if theme not in global_risk_themes:
                global_risk_themes.append(theme)

    return ProjectReconModel(
        project_root=project_root,
        languages=list(model_languages),
        frameworks=list(frameworks),
        entry_points=entry_points[:40],
        key_directories=key_directories[:120],
        module_descriptors=module_descriptors,
        global_risk_themes=global_risk_themes,
        cross_cutting_paths=cross_cutting_paths[:40],
        target_files=target_files,
        scope_limited=bool(target_files),
    )


def _risk_point_fingerprint(point: Dict[str, Any]) -> str:
    return "|".join(
        [
            str(point.get("file_path") or "").strip().lower(),
            str(int(point.get("line_start") or 0)),
            str(point.get("vulnerability_type") or "").strip().lower(),
            str(point.get("entry_function") or "").strip().lower(),
            str(point.get("source") or "").strip().lower(),
            str(point.get("sink") or "").strip().lower(),
            str(point.get("input_surface") or "").strip().lower(),
            str(point.get("trust_boundary") or "").strip().lower(),
            " ".join(str(point.get("description") or "").strip().lower().split()),
        ]
    )


def dedupe_risk_points(points: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for point in points:
        if not isinstance(point, dict):
            continue
        fingerprint = _risk_point_fingerprint(point)
        if not fingerprint or fingerprint in seen:
            continue
        seen.add(fingerprint)
        merged.append(dict(point))
    return merged


def merge_recon_module_results(
    *,
    project_model: ProjectReconModel,
    module_results: Sequence[ReconModuleResult],
    project_info: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    project_info = dict(project_info or {})
    all_risk_points = dedupe_risk_points(
        point
        for result in module_results
        for point in (result.risk_points or [])
    )
    input_surfaces: List[str] = []
    trust_boundaries: List[str] = []
    target_files: List[str] = []
    files_read: List[str] = []
    files_discovered: List[str] = []
    directories_scanned: List[str] = []
    summaries: List[str] = []
    high_risk_areas: List[str] = []

    for result in module_results:
        for bucket, items in (
            (input_surfaces, result.input_surfaces),
            (trust_boundaries, result.trust_boundaries),
            (target_files, result.target_files),
            (files_read, result.files_read),
            (files_discovered, result.files_discovered),
            (directories_scanned, result.directories_scanned),
        ):
            for item in items or []:
                text = str(item or "").strip()
                if text and text not in bucket:
                    bucket.append(text)
        if result.summary:
            summaries.append(result.summary.strip())

    for point in all_risk_points:
        file_path = str(point.get("file_path") or "").strip()
        if file_path and file_path not in high_risk_areas:
            high_risk_areas.append(file_path)

    initial_findings = [
        {
            "title": point.get("description") or f"Risk at {point.get('file_path', '')}:{point.get('line_start', 1)}",
            "description": point.get("description") or "",
            "file_path": point.get("file_path"),
            "line_start": point.get("line_start"),
            "severity": point.get("severity"),
            "vulnerability_type": point.get("vulnerability_type"),
        }
        for point in all_risk_points[:20]
    ]

    structure = project_info.get("structure")
    if not isinstance(structure, dict):
        structure = {
            "directories": project_model.key_directories[:20],
            "files": project_model.entry_points[:20],
            "scope_limited": project_model.scope_limited,
        }

    return {
        "project_structure": structure,
        "tech_stack": {
            "languages": list(project_model.languages),
            "frameworks": list(project_model.frameworks),
            "databases": [],
        },
        "project_profile": {
            "is_web_project": bool(project_model.frameworks or project_model.entry_points),
            "web_project_confidence": 0.7 if (project_model.frameworks or project_model.entry_points) else 0.2,
            "signals": [
                f"framework:{item.lower()}"
                for item in project_model.frameworks
            ][:16],
            "web_vulnerability_focus": list(project_model.global_risk_themes[:12]),
        },
        "entry_points": [
            {
                "type": "module_entrypoint",
                "file": path,
                "description": "Detected module entrypoint",
            }
            for path in project_model.entry_points[:30]
        ],
        "high_risk_areas": high_risk_areas[:64],
        "initial_findings": initial_findings,
        "risk_points": all_risk_points,
        "input_surfaces": input_surfaces[:24],
        "trust_boundaries": trust_boundaries[:24],
        "target_files": target_files[:256] or list(project_model.target_files[:256]),
        "coverage_summary": {
            "directories_scanned": directories_scanned[:80],
            "files_discovered": files_discovered[:400],
            "files_read": files_read[:300],
            "directories_scanned_count": len(directories_scanned),
            "files_discovered_count": len(files_discovered),
            "files_read_count": len(files_read),
            "module_count": len(project_model.module_descriptors),
            "module_success_count": sum(1 for result in module_results if result.success),
            "module_failure_count": sum(1 for result in module_results if not result.success),
            "tracker_enabled": False,
            "tracker_built": False,
        },
        "summary": "\n".join(summary for summary in summaries if summary)[:6000],
    }
