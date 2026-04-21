"""Helpers for exporting agent task activity logs."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.agent_task import AgentEvent, AgentTask

LOG_TYPE_LABELS: Dict[str, str] = {
    "thinking": "思考",
    "tool": "工具",
    "phase": "阶段",
    "finding": "漏洞",
    "dispatch": "调度",
    "info": "信息",
    "error": "错误",
    "user": "用户",
    "progress": "进度",
}

PROGRESS_PATTERNS: List[tuple[re.Pattern[str], str]] = [
    (re.compile(r"索引进度[:：]?\s*\d+\/\d+"), "index_progress"),
    (re.compile(r"克隆进度[:：]?\s*\d+%"), "clone_progress"),
    (re.compile(r"下载进度[:：]?\s*\d+%"), "download_progress"),
    (re.compile(r"上传进度[:：]?\s*\d+%"), "upload_progress"),
    (re.compile(r"扫描进度[:：]?\s*\d+"), "scan_progress"),
    (re.compile(r"分析进度[:：]?\s*\d+"), "analyze_progress"),
]

TERMINAL_STATUSES = {"completed", "failed", "cancelled", "aborted", "interrupted"}


def _sanitize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\u00A0", " ").strip()


def _sanitize_value(value: Any) -> Any:
    if isinstance(value, str):
        return _sanitize_text(value)
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    if isinstance(value, tuple):
        return [_sanitize_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _sanitize_value(item) for key, item in value.items()}
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _event_to_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
    except Exception:
        return str(value)


def _extract_tool_output_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        result_value = value.get("result")
        if isinstance(result_value, str):
            return result_value
    return _event_to_string(value)


def _to_non_empty_id(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _extract_tool_call_id(
    event: AgentEvent,
    metadata: Dict[str, Any],
) -> Optional[str]:
    return _to_non_empty_id(metadata.get("tool_call_id"))


def _build_tool_bucket_key(
    agent_raw_name: Optional[str],
    agent_name: Optional[str],
    tool_name: str,
) -> str:
    owner = _sanitize_text(agent_raw_name or agent_name or "unknown").lower() or "unknown"
    tool = _sanitize_text(tool_name or "unknown").lower() or "unknown"
    return f"{owner}|{tool}"


def _format_duration_hms(total_seconds: float) -> str:
    seconds = max(0, int(total_seconds))
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    remaining_seconds = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{remaining_seconds:02d}"


def _resolve_log_display_time(
    started_at: Optional[datetime],
    event_timestamp: Optional[datetime],
) -> str:
    if started_at is None or event_timestamp is None:
        if event_timestamp is None:
            return "00:00:00"
        return event_timestamp.strftime("%H:%M:%S")
    return _format_duration_hms((event_timestamp - started_at).total_seconds())


def _to_phase_key(raw: Any) -> str:
    return _sanitize_text(raw).lower().replace("-", "_").replace(" ", "_")


def _normalize_phase_label(
    *,
    raw_phase: Any,
    event_type: Any,
    task_status: Any,
    message: Any,
    fallback_phase_label: Optional[str] = None,
) -> Optional[str]:
    normalized_task_status = _to_phase_key(task_status)
    normalized_event_type = _to_phase_key(event_type)
    normalized_raw_phase = _to_phase_key(raw_phase)
    text = _sanitize_text(message)

    if (
        normalized_task_status == "completed"
        and normalized_event_type in {"task_complete", "complete"}
    ):
        return "完成"

    if normalized_raw_phase in {"preparation", "planning", "indexing", "init", "initialization"}:
        return "初始化"
    if normalized_raw_phase in {"orchestration", "orchestrator"}:
        return "编排"
    if normalized_raw_phase in {"recon", "reconnaissance", "business_logic_recon"}:
        return "侦查"
    if normalized_raw_phase in {"analysis", "business_logic_analysis"}:
        return "分析"
    if normalized_raw_phase == "verification":
        return "验证"
    if normalized_raw_phase in {"report", "reporting"}:
        return "完成"

    if normalized_event_type in {"info", "progress"} and re.search(
        r"任务开始执行|开始执行|执行准备|准备阶段|索引", text
    ):
        return "初始化"

    if fallback_phase_label in {"初始化", "编排", "侦查", "分析", "验证", "完成"}:
        return fallback_phase_label
    return None


def _resolve_agent_name(metadata: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    raw_name = _sanitize_text(metadata.get("agent_name") or metadata.get("agent"))
    if not raw_name:
        return None, None
    lower = raw_name.lower()
    agent_role = _sanitize_text(metadata.get("agent_role")).lower()
    module_name = _sanitize_text(metadata.get("module_name") or metadata.get("module_id"))
    bracket_match = re.search(r"\[(.+)\]", raw_name)
    module_label = module_name or (bracket_match.group(1).strip() if bracket_match else "")

    if "orchestrator" in lower:
        return "编排智能体", raw_name
    if "reconsubagent" in lower or agent_role == "recon_subagent":
        return (
            f"侦查子智能体 · {module_label}" if module_label else "侦查子智能体",
            raw_name,
        )
    if lower in {"recon", "reconagent"} or agent_role == "recon_host":
        return "侦查主智能体", raw_name
    if "reconnaissance" in lower or "recon" in lower:
        return "侦查智能体", raw_name
    if "analysis" in lower:
        return "分析智能体", raw_name
    if "verification" in lower:
        return "验证智能体", raw_name
    return raw_name, raw_name


def _normalize_tool_status(status_value: Any, fallback_event_type: str) -> str:
    normalized = _sanitize_text(status_value).lower()
    if normalized in {"failed", "error"}:
        return "failed"
    if normalized in {"cancelled", "canceled", "aborted"}:
        return "cancelled"
    if fallback_event_type == "tool_call_error":
        return "failed"
    return "completed"


def _resolve_task_source_mode(task: AgentTask) -> str:
    combined = f"{_sanitize_text(task.name).lower()} {_sanitize_text(task.description).lower()}"
    return "hybrid" if "[hybrid]" in combined or "混合扫描" in combined else "intelligent"


def _resolve_task_log_title(task: AgentTask) -> str:
    return "混合扫描活动日志" if _resolve_task_source_mode(task) == "hybrid" else "智能扫描活动日志"


def _match_progress_key(message: str) -> Optional[str]:
    for pattern, key in PROGRESS_PATTERNS:
        if pattern.search(message):
            return key
    return None


def _build_tool_title(status_label: str, tool_name: str) -> str:
    return f"{status_label}：{tool_name}"


def _append_log(
    logs: List[Dict[str, Any]],
    log_by_id: Dict[str, Dict[str, Any]],
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    logs.append(payload)
    log_by_id[str(payload["id"])] = payload
    return payload


def _reconcile_terminal_logs(logs: List[Dict[str, Any]], final_status: str) -> None:
    normalized = _sanitize_text(final_status).lower()
    if normalized not in TERMINAL_STATUSES:
        return

    if normalized == "completed":
        next_tool_status = "completed"
        next_tool_label = "已完成"
    elif normalized == "failed":
        next_tool_status = "failed"
        next_tool_label = "失败"
    else:
        next_tool_status = "cancelled"
        next_tool_label = "已取消"

    for item in logs:
        if item.get("type") == "tool":
            tool = item.get("tool")
            if isinstance(tool, dict) and tool.get("status") == "running":
                tool["status"] = next_tool_status
                tool_name = _sanitize_text(tool.get("name"))
                if tool_name and _sanitize_text(item.get("title")).startswith("运行中："):
                    item["title"] = f"{next_tool_label}：{tool_name}"
        if item.get("type") == "progress" and item.get("progressStatus") == "running":
            item["progressStatus"] = "completed"


def build_agent_task_export_logs(
    task: AgentTask,
    events: List[AgentEvent],
) -> List[Dict[str, Any]]:
    logs: List[Dict[str, Any]] = []
    log_by_id: Dict[str, Dict[str, Any]] = {}
    tool_log_id_by_call_id: Dict[str, str] = {}
    pending_tool_buckets: Dict[str, List[str]] = {}
    progress_log_id_by_key: Dict[str, str] = {}
    current_phase_label: Optional[str] = None

    for event in events:
        event_type = _sanitize_text(event.event_type).lower()
        metadata = _sanitize_value(event.event_metadata or {})
        if not isinstance(metadata, dict):
            metadata = {}
        message = _sanitize_text(event.message)
        raw_phase = event.phase or metadata.get("phase")
        phase_label = _normalize_phase_label(
            raw_phase=raw_phase,
            event_type=event_type,
            task_status=task.status,
            message=message,
            fallback_phase_label=current_phase_label,
        )
        if phase_label:
            current_phase_label = phase_label

        event_timestamp = event.created_at
        display_time = _resolve_log_display_time(task.started_at, event_timestamp)
        agent_name, agent_raw_name = _resolve_agent_name(metadata)
        base_detail: Dict[str, Any] = {
            "event_type": event_type,
            "message": message,
            "metadata": metadata,
            "sequence": int(event.sequence or 0),
            "tool_name": _sanitize_text(event.tool_name) or None,
            "tool_input": _sanitize_value(event.tool_input),
            "tool_output": _sanitize_value(event.tool_output),
            "tool_duration_ms": event.tool_duration_ms,
            "event_timestamp": event_timestamp.isoformat() if event_timestamp else None,
        }

        if event_type == "heartbeat":
            continue
        if event_type == "llm_observation" and metadata.get("deduped") is True:
            continue
        if event_type in {"thinking_start", "thinking_end", "thinking_token"}:
            continue

        if event_type.startswith("llm_") or event_type == "thinking":
            thought = _sanitize_text(metadata.get("thought"))
            content = thought or message
            if not content:
                continue
            title = content if len(content) <= 100 else f"{content[:100]}..."
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "thinking",
                    "phaseLabel": phase_label,
                    "title": title,
                    "content": content,
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type in {"tool_call", "tool_call_start"}:
            tool_name = _sanitize_text(event.tool_name or "未知") or "未知"
            tool_call_id = _extract_tool_call_id(event, metadata)
            running_content = ""
            input_text = _sanitize_text(_event_to_string(event.tool_input))
            if input_text:
                running_content = f"输入：\n{input_text}"
            log_id = f"tool-{tool_call_id}" if tool_call_id else f"tool-{event.id}"
            payload = {
                "id": log_id,
                "time": display_time,
                "eventTimestamp": base_detail["event_timestamp"],
                "type": "tool",
                "phaseLabel": phase_label,
                "title": _build_tool_title("运行中", tool_name),
                "content": running_content,
                "tool": {
                    "name": tool_name,
                    "status": "running",
                    "callId": tool_call_id,
                },
                "agentName": agent_name,
                "agentRawName": agent_raw_name,
                "detail": base_detail,
            }
            existing_id = tool_log_id_by_call_id.get(tool_call_id or "") if tool_call_id else None
            if existing_id and existing_id in log_by_id:
                existing = log_by_id[existing_id]
                existing.update(payload)
            else:
                _append_log(logs, log_by_id, payload)
                if tool_call_id:
                    tool_log_id_by_call_id[tool_call_id] = log_id
                else:
                    bucket_key = _build_tool_bucket_key(agent_raw_name, agent_name, tool_name)
                    pending_tool_buckets.setdefault(bucket_key, []).append(log_id)
            continue

        if event_type in {"tool_result", "tool_call_end", "tool_call_error"}:
            tool_name = _sanitize_text(event.tool_name or "未知") or "未知"
            tool_status = _normalize_tool_status(metadata.get("tool_status"), event_type)
            status_label = "已完成" if tool_status == "completed" else "失败" if tool_status == "failed" else "已取消"
            tool_call_id = _extract_tool_call_id(event, metadata)
            target_log: Optional[Dict[str, Any]] = None

            if tool_call_id:
                existing_id = tool_log_id_by_call_id.get(tool_call_id)
                if existing_id:
                    target_log = log_by_id.get(existing_id)

            if target_log is None and not tool_call_id:
                bucket_key = _build_tool_bucket_key(agent_raw_name, agent_name, tool_name)
                queue = pending_tool_buckets.get(bucket_key, [])
                while queue and target_log is None:
                    candidate_id = queue.pop(0)
                    target_log = log_by_id.get(candidate_id)
                if queue:
                    pending_tool_buckets[bucket_key] = queue
                elif bucket_key in pending_tool_buckets:
                    pending_tool_buckets.pop(bucket_key, None)

            if target_log is None:
                for candidate in reversed(logs):
                    if candidate.get("type") != "tool":
                        continue
                    tool_data = candidate.get("tool")
                    if not isinstance(tool_data, dict):
                        continue
                    if tool_data.get("status") != "running":
                        continue
                    if _sanitize_text(tool_data.get("name")) != tool_name:
                        continue
                    if agent_name and _sanitize_text(candidate.get("agentName")) not in {"", agent_name}:
                        continue
                    target_log = candidate
                    break

            output_text = _sanitize_text(_extract_tool_output_text(event.tool_output))
            if target_log is not None:
                previous_content = _sanitize_text(target_log.get("content"))
                output_block = f"输出：\n{output_text}" if output_text else ""
                content = previous_content
                if output_block:
                    content = f"{previous_content}\n\n{output_block}".strip() if previous_content else output_block
                target_log.update(
                    {
                        "time": display_time,
                        "eventTimestamp": base_detail["event_timestamp"],
                        "phaseLabel": phase_label or target_log.get("phaseLabel"),
                        "title": _build_tool_title(status_label, tool_name),
                        "content": content,
                        "agentName": agent_name or target_log.get("agentName"),
                        "agentRawName": agent_raw_name or target_log.get("agentRawName"),
                        "detail": {
                            **(target_log.get("detail") or {}),
                            **base_detail,
                        },
                    }
                )
                tool_data = target_log.get("tool")
                if not isinstance(tool_data, dict):
                    tool_data = {}
                    target_log["tool"] = tool_data
                tool_data.update(
                    {
                        "name": tool_name,
                        "duration": int(event.tool_duration_ms or tool_data.get("duration") or 0),
                        "status": tool_status,
                        "callId": tool_call_id or tool_data.get("callId"),
                    }
                )
                if tool_call_id:
                    tool_log_id_by_call_id[tool_call_id] = str(target_log["id"])
                continue

            log_id = f"tool-{tool_call_id}" if tool_call_id else f"tool-{event.id}"
            payload = {
                "id": log_id,
                "time": display_time,
                "eventTimestamp": base_detail["event_timestamp"],
                "type": "tool",
                "phaseLabel": phase_label,
                "title": _build_tool_title(status_label, tool_name),
                "content": f"输出：\n{output_text}" if output_text else "",
                "tool": {
                    "name": tool_name,
                    "duration": int(event.tool_duration_ms or 0),
                    "status": tool_status,
                    "callId": tool_call_id,
                },
                "agentName": agent_name,
                "agentRawName": agent_raw_name,
                "detail": base_detail,
            }
            _append_log(logs, log_by_id, payload)
            if tool_call_id:
                tool_log_id_by_call_id[tool_call_id] = log_id
            continue

        if event_type in {"finding", "finding_new", "finding_verified", "finding_update"}:
            title = _sanitize_text(
                metadata.get("display_title") or metadata.get("title") or message or "发现漏洞"
            ) or "发现漏洞"
            severity = _sanitize_text(metadata.get("severity")).lower() or None
            false_positive = any(
                _sanitize_text(metadata.get(key)).lower() == "false_positive"
                for key in ("status", "authenticity", "verdict")
            )
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "finding",
                    "phaseLabel": phase_label,
                    "title": title,
                    "severity": "invalid" if false_positive else severity,
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type == "todo_update":
            todo_scope = _sanitize_text(metadata.get("todo_scope")).lower()
            todo_list = metadata.get("todo_list")
            if not isinstance(todo_list, list):
                todo_list = []

            if todo_scope == "verification":
                verified_count = sum(1 for item in todo_list if isinstance(item, dict) and item.get("status") == "verified")
                pending_count = sum(
                    1
                    for item in todo_list
                    if isinstance(item, dict) and item.get("status") in {"pending", "running"}
                )
                false_positive_count = sum(
                    1 for item in todo_list if isinstance(item, dict) and item.get("status") == "false_positive"
                )
                status_preview = " / ".join(
                    _sanitize_text((item or {}).get("status"))
                    for item in todo_list[:3]
                    if isinstance(item, dict)
                )
                content = message
                if status_preview:
                    content = f"{message}\n状态样例：{status_preview}".strip()
                _append_log(
                    logs,
                    log_by_id,
                    {
                        "id": f"log-{event.id}",
                        "time": display_time,
                        "eventTimestamp": base_detail["event_timestamp"],
                        "type": "progress",
                        "phaseLabel": phase_label,
                        "title": (
                            f"逐漏洞验证进度：确报 {verified_count}，"
                            f"待确认 {pending_count}，误报 {false_positive_count}"
                        ),
                        "content": content,
                        "agentName": agent_name,
                        "agentRawName": agent_raw_name,
                        "detail": base_detail,
                    },
                )
                continue

            if todo_scope == "finding_table":
                context_pending = int(metadata.get("context_pending") or 0)
                context_ready = int(metadata.get("context_ready") or 0)
                context_failed = int(metadata.get("context_failed") or 0)
                verify_unverified = int(metadata.get("verify_unverified") or 0)
                verified = int(metadata.get("verified") or 0)
                false_positive = int(metadata.get("false_positive") or 0)
                round_number = int(metadata.get("round") or 0)
                _append_log(
                    logs,
                    log_by_id,
                    {
                        "id": f"log-{event.id}",
                        "time": display_time,
                        "eventTimestamp": base_detail["event_timestamp"],
                        "type": "progress",
                        "phaseLabel": phase_label,
                        "title": (
                            f"漏洞表收敛进度（第 {round_number} 轮）："
                            f"上下文待收集 {context_pending}，已就绪 {context_ready}，失败 {context_failed}；"
                            f"待确认 {verify_unverified}，确报 {verified}，误报 {false_positive}"
                        ),
                        "content": message,
                        "agentName": agent_name,
                        "agentRawName": agent_raw_name,
                        "detail": base_detail,
                    },
                )
                continue

        if event_type in {
            "dispatch",
            "dispatch_complete",
            "node_start",
            "node_complete",
            "node_end",
            "phase_start",
            "phase_complete",
            "phase_end",
        }:
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "dispatch",
                    "phaseLabel": phase_label,
                    "title": message or f"事件：{event_type}",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type in {"task_complete", "complete"}:
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "info",
                    "phaseLabel": phase_label or "完成",
                    "title": message or "任务已完成",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type == "task_error":
            error_message = message or _sanitize_text(metadata.get("error")) or "任务执行出错"
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "error",
                    "phaseLabel": phase_label,
                    "title": error_message,
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type == "task_cancel":
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "info",
                    "phaseLabel": phase_label,
                    "title": message or "任务已取消",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type == "task_end":
            terminal_status = _sanitize_text(metadata.get("status") or task.status).lower()
            suffix = f"（{terminal_status}）" if terminal_status else ""
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "info",
                    "phaseLabel": phase_label,
                    "title": message or f"任务流已结束{suffix}",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if event_type in {"progress", "info", "warning", "error"}:
            fallback = message or event_type
            progress_key = _match_progress_key(fallback)
            if progress_key:
                existing_id = progress_log_id_by_key.get(progress_key)
                payload = {
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "progress",
                    "phaseLabel": phase_label,
                    "title": fallback,
                    "progressKey": progress_key,
                    "progressStatus": "running",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                }
                if existing_id and existing_id in log_by_id:
                    log_by_id[existing_id].update(payload)
                else:
                    log_id = f"log-{event.id}"
                    progress_log_id_by_key[progress_key] = log_id
                    payload["id"] = log_id
                    _append_log(logs, log_by_id, payload)
                continue

            if re.search(r"索引.*完成", fallback) or re.search(r"index(?:ing)?\s+(?:complete|completed)", fallback, re.I):
                progress_key = "index_progress"
                existing_id = progress_log_id_by_key.get(progress_key)
                payload = {
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "progress",
                    "phaseLabel": phase_label,
                    "title": fallback,
                    "progressKey": progress_key,
                    "progressStatus": "completed",
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                }
                if existing_id and existing_id in log_by_id:
                    log_by_id[existing_id].update(payload)
                else:
                    log_id = f"log-{event.id}"
                    progress_log_id_by_key[progress_key] = log_id
                    payload["id"] = log_id
                    _append_log(logs, log_by_id, payload)
                continue

            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "error" if event_type == "error" else "info",
                    "phaseLabel": phase_label,
                    "title": fallback,
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )
            continue

        if message:
            _append_log(
                logs,
                log_by_id,
                {
                    "id": f"log-{event.id}",
                    "time": display_time,
                    "eventTimestamp": base_detail["event_timestamp"],
                    "type": "info",
                    "phaseLabel": phase_label,
                    "title": message,
                    "agentName": agent_name,
                    "agentRawName": agent_raw_name,
                    "detail": base_detail,
                },
            )

    _reconcile_terminal_logs(logs, _sanitize_text(task.status).lower())
    return logs


def build_agent_task_log_export_payload(
    task: AgentTask,
    events: List[AgentEvent],
    exported_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    safe_exported_at = exported_at or datetime.utcnow()
    logs = build_agent_task_export_logs(task, events)
    return {
        "meta": {
            "task_id": task.id,
            "task_name": task.name,
            "project_id": task.project_id,
            "exported_at": safe_exported_at.isoformat(),
            "status": task.status,
            "current_phase": task.current_phase,
            "current_step": task.current_step,
            "source_mode": _resolve_task_source_mode(task),
            "source_event_count": len(events),
            "export_log_count": len(logs),
        },
        "logs": logs,
    }


def render_agent_task_logs_markdown(
    task: AgentTask,
    payload: Dict[str, Any],
) -> str:
    logs = payload.get("logs") if isinstance(payload, dict) else []
    meta = payload.get("meta") if isinstance(payload, dict) else {}
    if not isinstance(logs, list):
        logs = []
    if not isinstance(meta, dict):
        meta = {}

    lines: List[str] = []
    lines.append(f"# {_resolve_task_log_title(task)}")
    lines.append(f"- task_id: {_sanitize_text(meta.get('task_id') or task.id) or '-'}")
    lines.append(f"- task_name: {_sanitize_text(meta.get('task_name') or task.name) or '-'}")
    lines.append(f"- project_id: {_sanitize_text(meta.get('project_id') or task.project_id) or '-'}")
    lines.append(f"- status: {_sanitize_text(meta.get('status') or task.status) or '-'}")
    lines.append(f"- phase: {_sanitize_text(meta.get('current_phase') or task.current_phase) or '-'}")
    lines.append(f"- step: {_sanitize_text(meta.get('current_step') or task.current_step) or '-'}")
    lines.append(f"- exported_at: {_sanitize_text(meta.get('exported_at')) or '-'}")
    lines.append("")

    for item in logs:
        if not isinstance(item, dict):
            continue
        type_key = _sanitize_text(item.get("type")).lower()
        type_label = LOG_TYPE_LABELS.get(type_key, type_key or "日志")
        heading_parts = [f"[{_sanitize_text(item.get('time')) or '00:00:00'}]", f"[{type_label}]"]
        agent_name = _sanitize_text(item.get("agentName"))
        if agent_name:
            heading_parts.append(f"【{agent_name}】")
        title = _sanitize_text(item.get("title")) or "-"
        heading_parts.append(title)
        lines.append(f"## {' '.join(heading_parts)}")

        phase_label = _sanitize_text(item.get("phaseLabel"))
        if phase_label:
            lines.append(f"- phase_label: {phase_label}")

        tool = item.get("tool")
        if isinstance(tool, dict) and _sanitize_text(tool.get("name")):
            tool_line = f"- tool: {_sanitize_text(tool.get('name'))} ({_sanitize_text(tool.get('status')) or '-'})"
            duration = tool.get("duration")
            if isinstance(duration, (int, float)) and duration > 0:
                tool_line += f", {int(duration)}ms"
            lines.append(tool_line)

        content = _sanitize_text(item.get("content"))
        if content:
            lines.append("")
            lines.append("```text")
            lines.append(content)
            lines.append("```")

        detail = item.get("detail")
        if detail:
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(detail, ensure_ascii=False, indent=2, default=str))
            lines.append("```")

        lines.append("")

    return "\n".join(lines).rstrip() + "\n"
