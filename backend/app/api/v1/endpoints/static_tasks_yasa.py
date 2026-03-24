import asyncio
import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.v1.endpoints.static_tasks_shared import (
    _clear_scan_task_cancel,
    _force_cleanup_yasa_processes,
    _get_project_root,
    _is_scan_task_cancelled,
    _is_scan_process_active,
    _request_scan_task_cancel,
    _run_subprocess_with_tracking,
    _sync_task_scan_duration,
    deps,
    get_db,
    logger,
    settings,
)
from app.models.project import Project
from app.models.user import User
from app.models.yasa import YasaFinding, YasaRuleConfig, YasaScanTask
from app.services.yasa_runtime import build_yasa_scan_command
from app.services.yasa_runtime_config import (
    load_global_yasa_runtime_config,
    save_global_yasa_runtime_config,
)
from app.services.yasa_language import (
    YASA_SUPPORTED_LANGUAGES,
    is_yasa_blocked_project_language,
    resolve_yasa_language_from_programming_languages,
    resolve_yasa_language_profile,
)

router = APIRouter()


class YasaScanTaskCreate(BaseModel):
    project_id: str = Field(..., description="项目ID")
    name: Optional[str] = Field(None, description="任务名称")
    target_path: str = Field(".", description="扫描目标路径，相对于项目根目录")
    language: Optional[str] = Field(None, description="扫描语言，可自动识别映射")
    checker_pack_ids: Optional[List[str]] = Field(None, description="checkerPackIds")
    checker_ids: Optional[List[str]] = Field(None, description="checkerIds")
    rule_config_file: Optional[str] = Field(None, description="自定义 rule config 文件路径")
    rule_config_id: Optional[str] = Field(None, description="自定义规则配置ID")


class YasaScanTaskResponse(BaseModel):
    id: str
    project_id: str
    name: str
    status: str
    target_path: str
    language: str
    checker_pack_ids: Optional[str]
    checker_ids: Optional[str]
    rule_config_file: Optional[str]
    rule_config_id: Optional[str]
    rule_config_name: Optional[str]
    rule_config_source: Optional[str]
    total_findings: int
    scan_duration_ms: int
    files_scanned: int
    diagnostics_summary: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class YasaFindingResponse(BaseModel):
    id: str
    scan_task_id: str
    rule_id: Optional[str]
    rule_name: Optional[str]
    level: str
    message: str
    file_path: str
    start_line: Optional[int]
    end_line: Optional[int]
    status: str

    model_config = ConfigDict(from_attributes=True)


class YasaRuleResponse(BaseModel):
    checker_id: str
    checker_path: Optional[str] = None
    description: Optional[str] = None
    checker_packs: List[str] = []
    languages: List[str] = []
    demo_rule_config_path: Optional[str] = None
    source: str = "builtin"


class YasaRuleConfigResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    language: str
    checker_pack_ids: Optional[str]
    checker_ids: str
    rule_config_json: str
    is_active: bool
    source: str
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class YasaRuleConfigUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    checker_pack_ids: Optional[List[str]] = None
    checker_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class YasaRuntimeConfigResponse(BaseModel):
    yasa_timeout_seconds: int
    yasa_orphan_stale_seconds: int
    yasa_exec_heartbeat_seconds: int
    yasa_process_kill_grace_seconds: int


class YasaRuntimeConfigUpdateRequest(BaseModel):
    yasa_timeout_seconds: int = Field(..., ge=30, le=86400)
    yasa_orphan_stale_seconds: int = Field(..., ge=30, le=86400)
    yasa_exec_heartbeat_seconds: int = Field(..., ge=1, le=3600)
    yasa_process_kill_grace_seconds: int = Field(..., ge=1, le=60)

    model_config = ConfigDict(extra="ignore")


_SUPPORTED_YASA_LANGUAGES = YASA_SUPPORTED_LANGUAGES


def _normalize_csv(values: Optional[List[str]]) -> Optional[str]:
    if not values:
        return None
    normalized = [str(item).strip() for item in values if str(item).strip()]
    if not normalized:
        return None
    return ",".join(normalized)


def _split_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _split_csv_form(value: Optional[str]) -> List[str]:
    return _split_csv(value)


def _resolve_language_profile(language: Optional[str]) -> Dict[str, str]:
    return resolve_yasa_language_profile(language)


def _detect_language_from_project(project: Project) -> Optional[str]:
    return resolve_yasa_language_from_programming_languages(
        getattr(project, "programming_languages", None)
    )


def _assert_yasa_project_language_supported(project: Project) -> None:
    if is_yasa_blocked_project_language(getattr(project, "programming_languages", None)):
        raise HTTPException(status_code=400, detail="YASA 引擎暂不支持 C/C++ 项目")


def _resolve_yasa_binary() -> str:
    configured = str(getattr(settings, "YASA_BIN_PATH", "yasa") or "yasa").strip()
    if not configured:
        configured = "yasa"

    if os.path.isabs(configured):
        if os.path.exists(configured) and os.access(configured, os.X_OK):
            return configured
        raise FileNotFoundError(f"yasa executable not found: {configured}")

    resolved = shutil.which(configured)
    if resolved:
        return resolved
    raise FileNotFoundError(
        f"无法找到 yasa 可执行文件，请确认 YASA_BIN_PATH 配置（当前: {configured}）"
    )


def _resolve_resource_dir() -> Optional[Path]:
    configured = str(getattr(settings, "YASA_RESOURCE_DIR", "") or "").strip()
    if configured:
        resource_dir = Path(configured).expanduser()
        if resource_dir.exists():
            return resource_dir

    candidates = [
        Path.home() / ".local" / "share" / "yasa-engine" / "resource",
        Path("/usr/local/share/yasa-engine/resource"),
        Path("/usr/share/yasa-engine/resource"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _build_default_rule_config_path(profile: Dict[str, str]) -> Optional[str]:
    resource_dir = _resolve_resource_dir()
    if resource_dir is None:
        return None
    candidate = resource_dir / "example-rule-config" / profile["rule_config"]
    if candidate.exists():
        return str(candidate)
    return None


def _safe_json_load(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return None


def _infer_languages_from_pack_id(pack_id: str) -> List[str]:
    normalized = str(pack_id or "").strip().lower()
    tags: List[str] = []
    if "java" in normalized:
        tags.append("java")
    if "python" in normalized:
        tags.append("python")
    if "go" in normalized or "golang" in normalized:
        tags.append("golang")
    if "javascript" in normalized or "js" in normalized or "express" in normalized:
        tags.extend(["javascript", "typescript"])
    seen = set()
    ordered: List[str] = []
    for item in tags:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def _extract_yasa_rules_from_resource_dir(resource_dir: Path) -> List[YasaRuleResponse]:
    checker_config_path = resource_dir / "checker" / "checker-config.json"
    checker_pack_config_path = resource_dir / "checker" / "checker-pack-config.json"

    checker_payload = _safe_json_load(checker_config_path)
    checker_pack_payload = _safe_json_load(checker_pack_config_path)
    if not isinstance(checker_payload, list) or not isinstance(checker_pack_payload, list):
        return []

    checker_pack_map: Dict[str, List[str]] = {}
    checker_language_map: Dict[str, List[str]] = {}
    for item in checker_pack_payload:
        if not isinstance(item, dict):
            continue
        checker_pack_id = str(item.get("checkerPackId") or "").strip()
        checker_ids = item.get("checkerIds")
        if not checker_pack_id or not isinstance(checker_ids, list):
            continue
        languages = _infer_languages_from_pack_id(checker_pack_id)
        for checker_id in checker_ids:
            checker_key = str(checker_id or "").strip()
            if not checker_key:
                continue
            checker_pack_map.setdefault(checker_key, []).append(checker_pack_id)
            checker_language_map.setdefault(checker_key, [])
            for language in languages:
                if language not in checker_language_map[checker_key]:
                    checker_language_map[checker_key].append(language)

    rules: List[YasaRuleResponse] = []
    for raw in checker_payload:
        if not isinstance(raw, dict):
            continue
        checker_id = str(raw.get("checkerId") or "").strip()
        if not checker_id:
            continue
        rules.append(
            YasaRuleResponse(
                checker_id=checker_id,
                checker_path=str(raw.get("checkerPath") or "").strip() or None,
                description=str(raw.get("description") or "").strip() or None,
                checker_packs=checker_pack_map.get(checker_id, []),
                languages=checker_language_map.get(checker_id, []),
                demo_rule_config_path=str(raw.get("demoRuleConfigPath") or "").strip()
                or None,
                source="builtin",
            )
        )

    rules.sort(key=lambda item: item.checker_id.lower())
    return rules


def _load_checker_catalog(resource_dir: Path) -> Dict[str, Any]:
    checker_config_path = resource_dir / "checker" / "checker-config.json"
    checker_pack_config_path = resource_dir / "checker" / "checker-pack-config.json"

    checker_payload = _safe_json_load(checker_config_path)
    checker_pack_payload = _safe_json_load(checker_pack_config_path)
    if not isinstance(checker_payload, list) or not isinstance(checker_pack_payload, list):
        raise HTTPException(status_code=500, detail="YASA checker 配置文件无效")

    checker_ids: set[str] = set()
    checker_pack_ids: set[str] = set()
    pack_map: Dict[str, List[str]] = {}

    for item in checker_payload:
        if not isinstance(item, dict):
            continue
        checker_id = str(item.get("checkerId") or "").strip()
        if checker_id:
            checker_ids.add(checker_id)

    for item in checker_pack_payload:
        if not isinstance(item, dict):
            continue
        checker_pack_id = str(item.get("checkerPackId") or "").strip()
        checker_members = item.get("checkerIds")
        if not checker_pack_id or not isinstance(checker_members, list):
            continue
        checker_pack_ids.add(checker_pack_id)
        pack_map[checker_pack_id] = [
            str(member).strip() for member in checker_members if str(member).strip()
        ]

    return {
        "checker_ids": checker_ids,
        "checker_pack_ids": checker_pack_ids,
        "pack_map": pack_map,
    }


def _parse_rule_config_checker_ids(rule_config_payload: Any) -> List[str]:
    collected: List[str] = []

    def _collect_from_entry(entry: Any) -> None:
        if not isinstance(entry, dict):
            return
        raw_checker_ids = entry.get("checkerIds")
        if not isinstance(raw_checker_ids, list):
            return
        for raw in raw_checker_ids:
            checker_id = str(raw or "").strip()
            if checker_id:
                collected.append(checker_id)

    if isinstance(rule_config_payload, dict):
        _collect_from_entry(rule_config_payload)
        rules = rule_config_payload.get("rules")
        if isinstance(rules, list):
            for item in rules:
                _collect_from_entry(item)
    elif isinstance(rule_config_payload, list):
        for item in rule_config_payload:
            _collect_from_entry(item)

    seen: set[str] = set()
    deduplicated: List[str] = []
    for item in collected:
        if item in seen:
            continue
        seen.add(item)
        deduplicated.append(item)
    return deduplicated


def _normalize_checker_values(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    normalized: List[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _validate_checker_bindings(
    *,
    checker_ids: List[str],
    checker_pack_ids: List[str],
    catalog: Dict[str, Any],
) -> None:
    unknown_checker_ids = [
        checker_id for checker_id in checker_ids if checker_id not in catalog["checker_ids"]
    ]
    if unknown_checker_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "未知 checkerIds: "
                + ",".join(unknown_checker_ids)
                + "（区分大小写，请与 checker-config.json 保持一致）"
            ),
        )

    unknown_checker_pack_ids = [
        checker_pack_id
        for checker_pack_id in checker_pack_ids
        if checker_pack_id not in catalog["checker_pack_ids"]
    ]
    if unknown_checker_pack_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "未知 checkerPackIds: "
                + ",".join(unknown_checker_pack_ids)
                + "（区分大小写，请与 checker-pack-config.json 保持一致）"
            ),
        )



def _extract_sarif_location(result_item: Dict[str, Any]) -> Dict[str, Any]:
    locations = result_item.get("locations")
    if not isinstance(locations, list) or not locations:
        return {}
    first_location = locations[0]
    if not isinstance(first_location, dict):
        return {}
    physical = first_location.get("physicalLocation")
    if not isinstance(physical, dict):
        return {}
    artifact = physical.get("artifactLocation")
    region = physical.get("region")
    file_path = ""
    if isinstance(artifact, dict):
        file_path = str(artifact.get("uri") or "").strip()
    start_line = None
    end_line = None
    if isinstance(region, dict):
        if isinstance(region.get("startLine"), int):
            start_line = int(region.get("startLine"))
        if isinstance(region.get("endLine"), int):
            end_line = int(region.get("endLine"))
    return {
        "file_path": file_path,
        "start_line": start_line,
        "end_line": end_line,
    }


def _parse_yasa_sarif_output(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    runs = payload.get("runs")
    if not isinstance(runs, list):
        return []

    findings: List[Dict[str, Any]] = []
    for run in runs:
        if not isinstance(run, dict):
            continue
        results = run.get("results")
        if not isinstance(results, list):
            continue
        for result_item in results:
            if not isinstance(result_item, dict):
                continue

            message_payload = result_item.get("message")
            message = ""
            if isinstance(message_payload, dict):
                message = str(message_payload.get("text") or "").strip()
            rule_id = str(result_item.get("ruleId") or "").strip() or None
            rule_name = str(result_item.get("rule") or "").strip() or rule_id
            level = str(result_item.get("level") or "warning").strip().lower() or "warning"

            location_info = _extract_sarif_location(result_item)
            file_path = str(location_info.get("file_path") or "").strip() or "unknown"

            findings.append(
                {
                    "rule_id": rule_id,
                    "rule_name": rule_name,
                    "level": level,
                    "message": message or (rule_id or "yasa finding"),
                    "file_path": file_path,
                    "start_line": location_info.get("start_line"),
                    "end_line": location_info.get("end_line"),
                    "raw_payload": json.dumps(result_item, ensure_ascii=False)[:15000],
                }
            )

    return findings


def _read_diagnostics_summary(report_dir: str) -> Optional[str]:
    diagnostics_path = Path(report_dir) / "yasa-diagnostics-log.txt"
    if not diagnostics_path.exists():
        return None
    try:
        content = diagnostics_path.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception:
        return None
    if not content:
        return None
    return content[:3000]

def _truncate_diag_text(text: str, head: int = 4096, tail: int = 4096) -> str:
    raw = str(text or "").strip()
    if not raw:
        return ""
    if len(raw) <= head + tail:
        return raw
    return f"{raw[:head]}\n...<TRUNCATED>...\n{raw[-tail:]}"


def _build_failure_diagnostics_summary(
    *,
    language: str,
    checker_packs: List[str],
    rule_config_file: Optional[str],
    source_path: str,
    report_dir: str,
    stderr_text: str,
    stdout_text: str,
    diagnostics_log: Optional[str],
) -> str:
    payload: Dict[str, Any] = {
        "failure_type": "yasa_process_failed_without_sarif",
        "language": language,
        "checker_packs": checker_packs,
        "rule_config_file": rule_config_file or "",
        "source_path": source_path,
        "report_dir": report_dir,
    }

    stderr_trimmed = _truncate_diag_text(stderr_text)
    stdout_trimmed = _truncate_diag_text(stdout_text)
    log_trimmed = _truncate_diag_text(diagnostics_log or "", head=2000, tail=2000)

    if stderr_trimmed:
        payload["stderr"] = stderr_trimmed
    if stdout_trimmed:
        payload["stdout"] = stdout_trimmed
    if log_trimmed:
        payload["diagnostics_log"] = log_trimmed

    return json.dumps(payload, ensure_ascii=False)[:12000]


def _merge_task_diagnostics_summary(
    existing_summary: Optional[str],
    metadata: Dict[str, Any],
) -> Optional[str]:
    cleaned = {k: v for k, v in metadata.items() if v not in (None, "")}
    if not cleaned:
        return existing_summary

    if not existing_summary:
        return json.dumps(cleaned, ensure_ascii=False)[:12000]

    try:
        parsed = json.loads(existing_summary)
    except Exception:
        parsed = {"summary": existing_summary}

    if isinstance(parsed, dict):
        parsed.update(cleaned)
        return json.dumps(parsed, ensure_ascii=False)[:12000]

    return json.dumps({"summary": parsed, **cleaned}, ensure_ascii=False)[:12000]


async def _handle_yasa_interrupted(
    db: AsyncSession,
    task_id: str,
    *,
    message: str,
    diagnostics: Optional[Dict[str, Any]] = None,
) -> bool:
    result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task or task.status in {"completed", "failed", "interrupted"}:
        return False

    task.status = "interrupted"
    task.error_message = message[:500]
    task.diagnostics_summary = _merge_task_diagnostics_summary(
        task.diagnostics_summary,
        diagnostics or {},
    )
    _sync_task_scan_duration(task)
    await db.commit()
    return True


async def _execute_yasa_scan(
    task_id: str,
    project_root: str,
    target_path: str,
    language: str,
    checker_pack_ids: Optional[str],
    checker_ids: Optional[str],
    rule_config_file: Optional[str],
    rule_config_id: Optional[str],
) -> None:
    from app.db.session import async_session_factory

    async with async_session_factory() as db:
        report_dir: Optional[str] = None
        try:
            result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                logger.error("YASA task %s not found", task_id)
                return

            if _is_scan_task_cancelled("yasa", task_id) or task.status == "interrupted":
                task.status = "interrupted"
                task.error_message = task.error_message or "扫描任务已中止（用户操作）"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            if not bool(getattr(settings, "YASA_ENABLED", True)):
                task.status = "failed"
                task.error_message = "YASA 引擎已禁用，请设置 YASA_ENABLED=true"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            task.status = "running"
            await db.commit()

            full_target_path = os.path.join(project_root, target_path)
            if not os.path.exists(full_target_path):
                task.status = "failed"
                task.error_message = f"Target path {full_target_path} not found"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            resolved_bin = _resolve_yasa_binary()
            try:
                profile = _resolve_language_profile(language)
            except ValueError as exc:
                task.status = "failed"
                task.error_message = str(exc)[:500]
                task.diagnostics_summary = json.dumps(
                    {
                        "failure_type": "unsupported_or_missing_language",
                        "language": str(language or "").strip(),
                        "supported_languages": list(_SUPPORTED_YASA_LANGUAGES),
                    },
                    ensure_ascii=False,
                )[:3000]
                _sync_task_scan_duration(task)
                await db.commit()
                return
            normalized_language = profile["language"]
            packs = _split_csv(checker_pack_ids)
            checker_values = _split_csv(checker_ids)
            resolved_rule_config = str(rule_config_file or "").strip()
            task_rule_config_name: Optional[str] = None
            task_rule_config_source = "builtin"
            report_dir = tempfile.mkdtemp(prefix=f"yasa_report_{task_id}_")

            if rule_config_id:
                custom_rule_result = await db.execute(
                    select(YasaRuleConfig).where(YasaRuleConfig.id == rule_config_id)
                )
                custom_rule_config = custom_rule_result.scalar_one_or_none()
                if custom_rule_config is None:
                    task.status = "failed"
                    task.error_message = "自定义 YASA 规则配置不存在"
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return
                if not bool(custom_rule_config.is_active):
                    task.status = "failed"
                    task.error_message = "自定义 YASA 规则配置已禁用"
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return
                normalized_language = str(custom_rule_config.language or "").strip().lower()
                packs = _split_csv(custom_rule_config.checker_pack_ids)
                checker_values = _split_csv(custom_rule_config.checker_ids)
                resolved_rule_config = os.path.join(report_dir, "custom-rule-config.json")
                Path(resolved_rule_config).write_text(
                    str(custom_rule_config.rule_config_json or ""),
                    encoding="utf-8",
                )
                task_rule_config_name = str(custom_rule_config.name or "").strip() or None
                task_rule_config_source = str(custom_rule_config.source or "custom").strip() or "custom"
            else:
                if not packs:
                    packs = [profile["checker_pack"]]
                if not resolved_rule_config:
                    default_rule_config = _build_default_rule_config_path(profile)
                    if default_rule_config:
                        resolved_rule_config = default_rule_config

            cmd = build_yasa_scan_command(
                binary=resolved_bin,
                source_path=full_target_path,
                language=normalized_language,
                report_dir=report_dir,
                checker_pack_ids=packs,
                checker_ids=checker_values,
                rule_config_file=resolved_rule_config or None,
            )

            runtime_config = await load_global_yasa_runtime_config(db)
            timeout_seconds = max(1, int(runtime_config["yasa_timeout_seconds"]))
            heartbeat_seconds = max(1, int(runtime_config["yasa_exec_heartbeat_seconds"]))
            orphan_stale_seconds = max(30, int(runtime_config["yasa_orphan_stale_seconds"]))
            loop = asyncio.get_event_loop()
            scan_started_at = datetime.utcnow()
            process_future = loop.run_in_executor(
                None,
                lambda: _run_subprocess_with_tracking(
                    "yasa",
                    task_id,
                    cmd,
                    timeout=timeout_seconds,
                ),
            )
            process_result: Optional[subprocess.CompletedProcess[str]] = None
            orphan_since: Optional[datetime] = None

            while True:
                if process_future.done():
                    process_result = await process_future
                    break

                if _is_scan_task_cancelled("yasa", task_id):
                    _request_scan_task_cancel("yasa", task_id)
                    cleanup_stats = _force_cleanup_yasa_processes(
                        task_id=task_id,
                        report_dir=report_dir,
                        source_path=full_target_path,
                    )
                    await _handle_yasa_interrupted(
                        db,
                        task_id,
                        message="扫描任务已中止（用户操作）",
                        diagnostics={
                            "termination_reason": "manual_interrupt",
                            "process_cleanup_applied": bool(cleanup_stats["matched"]),
                            "cleanup_matched": cleanup_stats["matched"],
                            "cleanup_terminated": cleanup_stats["terminated"],
                            "cleanup_killed": cleanup_stats["killed"],
                        },
                    )
                    return

                is_active = _is_scan_process_active("yasa", task_id)
                if not is_active:
                    if orphan_since is None:
                        orphan_since = datetime.utcnow()
                    orphan_elapsed = int((datetime.utcnow() - orphan_since).total_seconds())
                    if orphan_elapsed >= orphan_stale_seconds:
                        _request_scan_task_cancel("yasa", task_id)
                        cleanup_stats = _force_cleanup_yasa_processes(
                            task_id=task_id,
                            report_dir=report_dir,
                            source_path=full_target_path,
                        )
                        await _handle_yasa_interrupted(
                            db,
                            task_id,
                            message="任务进程丢失，已自动标记为中止",
                            diagnostics={
                                "termination_reason": "orphan_recovery",
                                "orphan_recovered": True,
                                "process_cleanup_applied": bool(cleanup_stats["matched"]),
                                "cleanup_matched": cleanup_stats["matched"],
                                "cleanup_terminated": cleanup_stats["terminated"],
                                "cleanup_killed": cleanup_stats["killed"],
                            },
                        )
                        return
                else:
                    orphan_since = None

                task.updated_at = datetime.utcnow()
                _sync_task_scan_duration(task)
                await db.commit()
                await asyncio.sleep(heartbeat_seconds)

            if process_result is None:
                raise RuntimeError("YASA 执行结果为空")

            if _is_scan_task_cancelled("yasa", task_id):
                task.status = "interrupted"
                task.error_message = task.error_message or "扫描任务已中止（用户操作）"
                task.diagnostics_summary = _merge_task_diagnostics_summary(
                    task.diagnostics_summary,
                    {"termination_reason": "manual_interrupt"},
                )
                _sync_task_scan_duration(task)
                await db.commit()
                return

            sarif_path = Path(report_dir) / "report.sarif"
            findings_payload: List[Dict[str, Any]] = []
            if sarif_path.exists():
                try:
                    sarif_data = json.loads(
                        sarif_path.read_text(encoding="utf-8", errors="ignore")
                    )
                    findings_payload = _parse_yasa_sarif_output(sarif_data)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Failed to parse YASA SARIF for task %s: %s", task_id, exc)

            if process_result.returncode != 0 and not findings_payload:
                stderr_text = str(process_result.stderr or "").strip()
                stdout_text = str(process_result.stdout or "").strip()
                diagnostics_log = _read_diagnostics_summary(report_dir)

                short_message = (
                    stderr_text
                    or stdout_text
                    or "YASA 扫描失败，请检查 YASA_BIN_PATH 或规则参数"
                )

                task.status = "failed"
                task.error_message = short_message[:500]
                task.diagnostics_summary = _build_failure_diagnostics_summary(
                    language=normalized_language,
                    checker_packs=packs,
                    rule_config_file=resolved_rule_config or None,
                    source_path=full_target_path,
                    report_dir=report_dir,
                    stderr_text=stderr_text,
                    stdout_text=stdout_text,
                    diagnostics_log=diagnostics_log,
                )
                _sync_task_scan_duration(task)
                await db.commit()
                return

            for finding_item in findings_payload:
                db.add(
                    YasaFinding(
                        scan_task_id=task_id,
                        rule_id=finding_item.get("rule_id"),
                        rule_name=finding_item.get("rule_name"),
                        level=str(finding_item.get("level") or "warning")[:32],
                        message=str(finding_item.get("message") or "")[:4000],
                        file_path=str(finding_item.get("file_path") or "unknown")[:1200],
                        start_line=finding_item.get("start_line"),
                        end_line=finding_item.get("end_line"),
                        status="open",
                        raw_payload=finding_item.get("raw_payload"),
                    )
                )

            task.status = "completed"
            task.language = normalized_language
            task.checker_pack_ids = ",".join(packs)
            task.checker_ids = ",".join(checker_values) if checker_values else None
            task.rule_config_file = resolved_rule_config or None
            task.rule_config_id = rule_config_id or None
            task.rule_config_name = task_rule_config_name
            task.rule_config_source = task_rule_config_source
            task.total_findings = len(findings_payload)
            task.files_scanned = len(
                {
                    str(item.get("file_path") or "").strip()
                    for item in findings_payload
                    if str(item.get("file_path") or "").strip()
                }
            )
            task.diagnostics_summary = _read_diagnostics_summary(report_dir)
            metadata_summary = {
                "rule_config_id": rule_config_id or "",
                "rule_config_name": task_rule_config_name or "",
                "rule_config_source": task_rule_config_source,
            }
            if task.diagnostics_summary:
                task.diagnostics_summary = json.dumps(
                    {
                        "summary": task.diagnostics_summary,
                        "rule_config": metadata_summary,
                    },
                    ensure_ascii=False,
                )[:3000]
            else:
                task.diagnostics_summary = json.dumps(
                    {"rule_config": metadata_summary},
                    ensure_ascii=False,
                )[:3000]
            if task.total_findings == 0 and not task.diagnostics_summary:
                task.diagnostics_summary = "YASA 扫描完成，未发现 SARIF 结果"
            task.diagnostics_summary = _merge_task_diagnostics_summary(
                task.diagnostics_summary,
                {
                    "termination_reason": "completed",
                    "timeout_seconds": timeout_seconds,
                    "orphan_recovered": False,
                },
            )
            _sync_task_scan_duration(task)
            await db.commit()
        except subprocess.TimeoutExpired:
            await db.rollback()
            cleanup_stats = _force_cleanup_yasa_processes(
                task_id=task_id,
                report_dir=report_dir,
                source_path=(
                    os.path.join(project_root, target_path)
                    if project_root and target_path
                    else None
                ),
            )
            result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.error_message = "YASA 扫描超时"
                task.diagnostics_summary = _merge_task_diagnostics_summary(
                    task.diagnostics_summary,
                    {
                        "termination_reason": "hard_timeout",
                        "process_cleanup_applied": bool(cleanup_stats["matched"]),
                        "cleanup_matched": cleanup_stats["matched"],
                        "cleanup_terminated": cleanup_stats["terminated"],
                        "cleanup_killed": cleanup_stats["killed"],
                    },
                )
                _sync_task_scan_duration(task)
                await db.commit()
        except FileNotFoundError as exc:
            await db.rollback()
            result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.error_message = str(exc)[:500]
                _sync_task_scan_duration(task)
                await db.commit()
        except asyncio.CancelledError:
            await db.rollback()
            cleanup_stats = _force_cleanup_yasa_processes(
                task_id=task_id,
                report_dir=report_dir,
                source_path=(
                    os.path.join(project_root, target_path)
                    if project_root and target_path
                    else None
                ),
            )
            result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
            task = result.scalar_one_or_none()
            if task and task.status in {"pending", "running"}:
                task.status = "interrupted"
                task.error_message = task.error_message or "扫描任务因服务中断被标记为中止"
                task.diagnostics_summary = _merge_task_diagnostics_summary(
                    task.diagnostics_summary,
                    {
                        "termination_reason": "service_cancelled",
                        "process_cleanup_applied": bool(cleanup_stats["matched"]),
                        "cleanup_matched": cleanup_stats["matched"],
                        "cleanup_terminated": cleanup_stats["terminated"],
                        "cleanup_killed": cleanup_stats["killed"],
                    },
                )
                _sync_task_scan_duration(task)
                await db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.error("Error executing YASA task %s: %s", task_id, exc)
            await db.rollback()
            cleanup_stats = _force_cleanup_yasa_processes(
                task_id=task_id,
                report_dir=report_dir,
                source_path=(
                    os.path.join(project_root, target_path)
                    if project_root and target_path
                    else None
                ),
            )
            result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.error_message = str(exc)[:500]
                task.diagnostics_summary = _merge_task_diagnostics_summary(
                    task.diagnostics_summary,
                    {
                        "termination_reason": "unexpected_exception",
                        "process_cleanup_applied": bool(cleanup_stats["matched"]),
                        "cleanup_matched": cleanup_stats["matched"],
                        "cleanup_terminated": cleanup_stats["terminated"],
                        "cleanup_killed": cleanup_stats["killed"],
                    },
                )
                _sync_task_scan_duration(task)
                await db.commit()
        finally:
            if report_dir:
                shutil.rmtree(report_dir, ignore_errors=True)
            _clear_scan_task_cancel("yasa", task_id)


@router.get("/yasa/runtime-config", response_model=YasaRuntimeConfigResponse)
async def get_yasa_runtime_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    runtime_config = await load_global_yasa_runtime_config(db)
    return YasaRuntimeConfigResponse(**runtime_config)


@router.put("/yasa/runtime-config", response_model=YasaRuntimeConfigResponse)
async def update_yasa_runtime_config(
    payload: YasaRuntimeConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    runtime_config = await save_global_yasa_runtime_config(
        db,
        user_id=current_user.id,
        runtime_config=payload.model_dump(),
    )
    return YasaRuntimeConfigResponse(**runtime_config)


@router.post("/yasa/scan", response_model=YasaScanTaskResponse)
async def create_yasa_scan(
    request: YasaScanTaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if request.rule_config_id and request.rule_config_file:
        raise HTTPException(
            status_code=400,
            detail="rule_config_id 与 rule_config_file 不能同时传入",
        )

    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    _assert_yasa_project_language_supported(project)

    project_root = await _get_project_root(request.project_id)
    if not project_root:
        raise HTTPException(
            status_code=400,
            detail="找不到项目的 zip 文件，请先上传项目 ZIP 文件到 uploads/zip_files 目录",
        )

    selected_rule_config: Optional[YasaRuleConfig] = None
    if request.rule_config_id:
        rule_result = await db.execute(
            select(YasaRuleConfig).where(YasaRuleConfig.id == request.rule_config_id)
        )
        selected_rule_config = rule_result.scalar_one_or_none()
        if selected_rule_config is None:
            raise HTTPException(status_code=404, detail="YASA 自定义规则配置不存在")
        if not bool(selected_rule_config.is_active):
            raise HTTPException(status_code=409, detail="YASA 自定义规则配置已禁用")

    detected_language = request.language or _detect_language_from_project(project)
    if selected_rule_config is not None:
        detected_language = selected_rule_config.language

    try:
        profile = _resolve_language_profile(detected_language)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    checker_pack_csv = _normalize_csv(request.checker_pack_ids)
    checker_ids_csv = _normalize_csv(request.checker_ids)
    if selected_rule_config is not None:
        checker_pack_csv = selected_rule_config.checker_pack_ids
        checker_ids_csv = selected_rule_config.checker_ids

    scan_task = YasaScanTask(
        project_id=request.project_id,
        name=request.name or f"YASA_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        status="pending",
        target_path=request.target_path,
        language=profile["language"],
        checker_pack_ids=checker_pack_csv,
        checker_ids=checker_ids_csv,
        rule_config_file=str(request.rule_config_file or "").strip() or None,
        rule_config_id=selected_rule_config.id if selected_rule_config else None,
        rule_config_name=selected_rule_config.name if selected_rule_config else None,
        rule_config_source=selected_rule_config.source if selected_rule_config else None,
    )
    db.add(scan_task)
    await db.commit()
    await db.refresh(scan_task)

    background_tasks.add_task(
        _execute_yasa_scan,
        scan_task.id,
        project_root,
        request.target_path,
        scan_task.language,
        scan_task.checker_pack_ids,
        scan_task.checker_ids,
        scan_task.rule_config_file,
        scan_task.rule_config_id,
    )
    return scan_task


@router.get("/yasa/tasks", response_model=List[YasaScanTaskResponse])
async def list_yasa_tasks(
    project_id: Optional[str] = Query(None, description="按项目ID过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    query = select(YasaScanTask)
    if project_id:
        query = query.where(YasaScanTask.project_id == project_id)
    query = query.order_by(YasaScanTask.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/yasa/tasks/{task_id}", response_model=YasaScanTaskResponse)
async def get_yasa_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/yasa/tasks/{task_id}/interrupt")
async def interrupt_yasa_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in {"completed", "failed", "interrupted"}:
        return {
            "message": f"任务当前状态为 {task.status}，无需中止",
            "task_id": task_id,
            "status": task.status,
        }

    _request_scan_task_cancel("yasa", task_id)
    cleanup_stats = _force_cleanup_yasa_processes(task_id=task_id)
    task.status = "interrupted"
    task.error_message = task.error_message or "扫描任务已中止（用户操作）"
    task.diagnostics_summary = _merge_task_diagnostics_summary(
        task.diagnostics_summary,
        {
            "termination_reason": "manual_interrupt",
            "process_cleanup_applied": bool(cleanup_stats["matched"]),
            "cleanup_matched": cleanup_stats["matched"],
            "cleanup_terminated": cleanup_stats["terminated"],
            "cleanup_killed": cleanup_stats["killed"],
        },
    )
    _sync_task_scan_duration(task)
    await db.commit()
    return {"message": "任务已中止", "task_id": task_id, "status": "interrupted"}


@router.delete("/yasa/tasks/{task_id}")
async def delete_yasa_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    await db.delete(task)
    await db.commit()
    return {"message": "任务已删除", "task_id": task_id}


@router.get("/yasa/tasks/{task_id}/findings", response_model=List[YasaFindingResponse])
async def get_yasa_findings(
    task_id: str,
    status: Optional[str] = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    task_result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    query = select(YasaFinding).where(YasaFinding.scan_task_id == task_id)
    if status:
        query = query.where(YasaFinding.status == status)
    query = query.order_by(YasaFinding.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/yasa/rule-configs/import", response_model=YasaRuleConfigResponse)
async def import_yasa_rule_config(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    language: str = Form(...),
    checker_pack_ids: Optional[str] = Form(None),
    checker_ids: Optional[str] = Form(None),
    rule_config_json: Optional[str] = Form(None),
    rule_config_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    normalized_name = str(name or "").strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="name 不能为空")

    normalized_language = str(language or "").strip().lower()
    if normalized_language not in _SUPPORTED_YASA_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail="language 无效，YASA 仅支持 python/javascript/typescript/golang/java",
        )

    payload_text = str(rule_config_json or "").strip()
    if rule_config_file is not None:
        file_bytes = await rule_config_file.read()
        payload_text = file_bytes.decode("utf-8", errors="ignore").strip()

    if not payload_text:
        raise HTTPException(status_code=400, detail="rule_config_json 或 rule_config_file 必须提供")

    try:
        rule_config_payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"rule-config JSON 无效: {exc.msg}") from exc

    derived_checker_ids = _parse_rule_config_checker_ids(rule_config_payload)
    if not derived_checker_ids:
        raise HTTPException(
            status_code=400,
            detail="rule-config 缺少 checkerIds（必须为非空数组）",
        )

    resource_dir = _resolve_resource_dir()
    if resource_dir is None:
        raise HTTPException(
            status_code=500,
            detail="未找到 YASA 资源目录，请确认 YASA_RESOURCE_DIR 或本机 yasa-engine 安装",
        )

    catalog = _load_checker_catalog(resource_dir)
    normalized_checker_ids = _normalize_checker_values(_split_csv_form(checker_ids)) or derived_checker_ids
    normalized_checker_pack_ids = _normalize_checker_values(_split_csv_form(checker_pack_ids))
    _validate_checker_bindings(
        checker_ids=normalized_checker_ids,
        checker_pack_ids=normalized_checker_pack_ids,
        catalog=catalog,
    )

    row = YasaRuleConfig(
        name=normalized_name,
        description=str(description or "").strip() or None,
        language=normalized_language,
        checker_pack_ids=_normalize_csv(normalized_checker_pack_ids),
        checker_ids=_normalize_csv(normalized_checker_ids) or "",
        rule_config_json=json.dumps(rule_config_payload, ensure_ascii=False),
        is_active=True,
        source="custom",
        created_by=str(getattr(current_user, "id", "") or "") or None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/yasa/rule-configs", response_model=List[YasaRuleConfigResponse])
async def list_yasa_rule_configs(
    language: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    query = select(YasaRuleConfig).where(YasaRuleConfig.source == "custom")
    if language:
        query = query.where(YasaRuleConfig.language == str(language).strip().lower())
    if is_active is not None:
        query = query.where(YasaRuleConfig.is_active.is_(is_active))
    if keyword:
        normalized_keyword = f"%{str(keyword).strip().lower()}%"
        query = query.where(
            YasaRuleConfig.name.ilike(normalized_keyword)
            | YasaRuleConfig.description.ilike(normalized_keyword)
        )
    query = query.order_by(YasaRuleConfig.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/yasa/rule-configs/{rule_config_id}", response_model=YasaRuleConfigResponse)
async def get_yasa_rule_config(
    rule_config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    result = await db.execute(
        select(YasaRuleConfig).where(
            (YasaRuleConfig.id == rule_config_id) & (YasaRuleConfig.source == "custom")
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="YASA 自定义规则配置不存在")
    return row


@router.patch("/yasa/rule-configs/{rule_config_id}", response_model=YasaRuleConfigResponse)
async def update_yasa_rule_config(
    rule_config_id: str,
    request: YasaRuleConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    result = await db.execute(
        select(YasaRuleConfig).where(
            (YasaRuleConfig.id == rule_config_id) & (YasaRuleConfig.source == "custom")
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="YASA 自定义规则配置不存在")

    if request.language is not None:
        normalized_language = str(request.language or "").strip().lower()
        if normalized_language not in _SUPPORTED_YASA_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail="language 无效，YASA 仅支持 python/javascript/typescript/golang/java",
            )
        row.language = normalized_language
    if request.name is not None:
        normalized_name = str(request.name or "").strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="name 不能为空")
        row.name = normalized_name
    if request.description is not None:
        row.description = str(request.description or "").strip() or None

    if request.checker_ids is not None or request.checker_pack_ids is not None:
        resource_dir = _resolve_resource_dir()
        if resource_dir is None:
            raise HTTPException(
                status_code=500,
                detail="未找到 YASA 资源目录，请确认 YASA_RESOURCE_DIR 或本机 yasa-engine 安装",
            )
        catalog = _load_checker_catalog(resource_dir)
        normalized_checker_ids = (
            _normalize_checker_values(request.checker_ids)
            if request.checker_ids is not None
            else _split_csv(row.checker_ids)
        )
        normalized_checker_pack_ids = (
            _normalize_checker_values(request.checker_pack_ids)
            if request.checker_pack_ids is not None
            else _split_csv(row.checker_pack_ids)
        )
        _validate_checker_bindings(
            checker_ids=normalized_checker_ids,
            checker_pack_ids=normalized_checker_pack_ids,
            catalog=catalog,
        )
        row.checker_ids = _normalize_csv(normalized_checker_ids) or row.checker_ids
        row.checker_pack_ids = _normalize_csv(normalized_checker_pack_ids)

    if request.is_active is not None:
        row.is_active = bool(request.is_active)

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/yasa/rule-configs/{rule_config_id}")
async def delete_yasa_rule_config(
    rule_config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    result = await db.execute(
        select(YasaRuleConfig).where(
            (YasaRuleConfig.id == rule_config_id) & (YasaRuleConfig.source == "custom")
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="YASA 自定义规则配置不存在")
    row.is_active = False
    await db.commit()
    return {"message": "规则配置已禁用", "id": rule_config_id}


@router.get("/yasa/rules", response_model=List[YasaRuleResponse])
async def list_yasa_rules(
    checker_pack_id: Optional[str] = Query(None, description="按 checkerPack 过滤"),
    language: Optional[str] = Query(None, description="按语言过滤"),
    keyword: Optional[str] = Query(None, description="按 checkerId/描述过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    resource_dir = _resolve_resource_dir()
    if resource_dir is None:
        raise HTTPException(
            status_code=500,
            detail="未找到 YASA 资源目录，请确认 YASA_RESOURCE_DIR 或本机 yasa-engine 安装",
        )

    rules = _extract_yasa_rules_from_resource_dir(resource_dir)
    if checker_pack_id:
        expected_pack = str(checker_pack_id).strip()
        rules = [item for item in rules if expected_pack in item.checker_packs]

    if language:
        normalized_language = str(language).strip().lower()
        if normalized_language not in _SUPPORTED_YASA_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"不支持语言: {normalized_language}，"
                    "YASA 仅支持 python/javascript/typescript/golang/java"
                ),
            )
        rules = [item for item in rules if normalized_language in item.languages]

    if keyword:
        normalized_keyword = str(keyword).strip().lower()
        if normalized_keyword:
            rules = [
                item
                for item in rules
                if normalized_keyword in item.checker_id.lower()
                or normalized_keyword in str(item.description or "").lower()
                or any(normalized_keyword in pack.lower() for pack in item.checker_packs)
            ]

    return rules[skip : skip + limit]


@router.get("/yasa/tasks/{task_id}/findings/{finding_id}", response_model=YasaFindingResponse)
async def get_yasa_finding(
    task_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    task_result = await db.execute(select(YasaScanTask).where(YasaScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    finding_result = await db.execute(
        select(YasaFinding).where(
            (YasaFinding.id == finding_id) & (YasaFinding.scan_task_id == task_id)
        )
    )
    finding = finding_result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="漏洞不存在")
    return finding


@router.post("/yasa/findings/{finding_id}/status")
async def update_yasa_finding_status(
    finding_id: str,
    status: str = Query(..., description="open, verified, false_positive"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    allowed_status = {"open", "verified", "false_positive"}
    normalized_status = str(status or "").strip().lower()
    if normalized_status not in allowed_status:
        raise HTTPException(status_code=400, detail="无效状态")

    result = await db.execute(select(YasaFinding).where(YasaFinding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="漏洞不存在")

    finding.status = normalized_status
    await db.commit()
    return {
        "message": "状态更新成功",
        "finding_id": finding_id,
        "status": normalized_status,
    }
