"""Shared access and response helpers for agent task routes."""

from datetime import datetime, timezone
import re
from typing import Any, Dict, Mapping, Optional

from fastapi import HTTPException

from app.models.agent_task import AgentTask, AgentTaskStatus
from app.models.project import Project
from .agent_tasks_contracts import AgentTaskDefectSummary, AgentTaskResponse
from .agent_tasks_runtime import _collect_orchestrator_stats, _running_orchestrators

_HYBRID_STATIC_SCAN_STEP_PATTERN = re.compile(r"静态预扫|内嵌预扫|bootstrap", re.IGNORECASE)


def _normalize_token(value: Any) -> str:
    return str(value or "").strip().lower()


def _resolve_agent_task_source_mode(task: AgentTask) -> str:
    combined = f"{str(task.name or '').strip().lower()} {str(task.description or '').strip().lower()}"
    return "hybrid" if "[hybrid]" in combined or "混合扫描" in combined else "intelligent"


def _resolve_runtime_workflow_phase(
    task: AgentTask,
    orchestrator: Any = None,
) -> Optional[str]:
    phase = ""
    if orchestrator is not None and hasattr(orchestrator, "get_current_workflow_phase"):
        try:
            phase = str(orchestrator.get_current_workflow_phase() or "").strip().lower()
        except Exception:
            phase = ""
    if phase:
        return phase

    audit_plan = task.audit_plan if isinstance(task.audit_plan, dict) else {}
    phase = str(audit_plan.get("workflow_phase") or "").strip().lower()
    if phase:
        return phase

    if _normalize_token(task.status) == AgentTaskStatus.COMPLETED:
        return "complete"

    phase = _normalize_token(task.current_phase)
    return phase or None


def _resolve_display_phase(
    task: AgentTask,
    workflow_phase: Optional[str],
) -> Optional[str]:
    status = _normalize_token(task.status)
    source_mode = _resolve_agent_task_source_mode(task)
    current_step = str(task.current_step or "").strip()
    phase = _normalize_token(workflow_phase)
    if phase in {"failed", "cancelled"}:
        phase = _normalize_token(task.current_phase)

    if status == AgentTaskStatus.COMPLETED:
        return "complete"

    if (
        source_mode == "hybrid"
        and status in {AgentTaskStatus.PENDING, AgentTaskStatus.INITIALIZING, AgentTaskStatus.RUNNING}
        and _HYBRID_STATIC_SCAN_STEP_PATTERN.search(current_step)
    ):
        return "static_scan"

    if phase in {"planning", "indexing", "reconnaissance", "recon", "business_logic_recon"}:
        return "recon"
    if phase in {"analysis", "business_logic_analysis"}:
        return "analysis"
    if phase == "verification":
        return "verification"
    if phase in {"reporting", "report", "complete"}:
        return "complete"

    if status in {AgentTaskStatus.PENDING, AgentTaskStatus.INITIALIZING, AgentTaskStatus.RUNNING}:
        return "recon"

    return None


def ensure_project_access(task: AgentTask, project: Project | None) -> Project:
    if project is None:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    return project


def build_agent_task_response(
    task: AgentTask,
    verified_severity_counts: Mapping[str, int] | None = None,
    defect_summary: Dict[str, Any] | AgentTaskDefectSummary | None = None,
) -> AgentTaskResponse:
    progress = float(task.progress_percentage) if hasattr(task, "progress_percentage") else 0.0
    total_iterations = int(task.total_iterations or 0)
    tool_calls_count = int(task.tool_calls_count or 0)
    tokens_used = int(task.tokens_used or 0)
    verified_counts = dict(verified_severity_counts or {})
    agent_config = task.agent_config if isinstance(task.agent_config, dict) else {}
    tool_evidence_protocol = (
        "native_v1"
        if agent_config.get("tool_evidence_protocol") == "native_v1"
        else "legacy"
    )

    orchestrator = _running_orchestrators.get(task.id)
    if orchestrator and task.status in (
        AgentTaskStatus.RUNNING,
        AgentTaskStatus.CANCELLED,
        AgentTaskStatus.FAILED,
    ):
        runtime_stats = _collect_orchestrator_stats(orchestrator)
        total_iterations = max(total_iterations, int(runtime_stats["iterations"]))
        tool_calls_count = max(tool_calls_count, int(runtime_stats["tool_calls"]))
        tokens_used = max(tokens_used, int(runtime_stats["tokens_used"]))

    workflow_phase = _resolve_runtime_workflow_phase(task, orchestrator)
    display_phase = _resolve_display_phase(task, workflow_phase)

    return AgentTaskResponse(
        id=task.id,
        project_id=task.project_id,
        name=task.name,
        description=task.description,
        task_type=task.task_type or "agent_audit",
        status=task.status,
        current_phase=task.current_phase,
        current_step=task.current_step,
        workflow_phase=workflow_phase,
        display_phase=display_phase,
        total_files=task.total_files or 0,
        indexed_files=task.indexed_files or 0,
        analyzed_files=task.analyzed_files or 0,
        total_chunks=task.total_chunks or 0,
        total_iterations=total_iterations,
        tool_calls_count=tool_calls_count,
        tokens_used=tokens_used,
        findings_count=task.findings_count or 0,
        total_findings=task.findings_count or 0,
        verified_count=task.verified_count or 0,
        verified_findings=task.verified_count or 0,
        false_positive_count=task.false_positive_count or 0,
        critical_count=task.critical_count or 0,
        high_count=task.high_count or 0,
        medium_count=task.medium_count or 0,
        low_count=task.low_count or 0,
        verified_critical_count=int(verified_counts.get("critical", 0) or 0),
        verified_high_count=int(verified_counts.get("high", 0) or 0),
        verified_medium_count=int(verified_counts.get("medium", 0) or 0),
        verified_low_count=int(verified_counts.get("low", 0) or 0),
        defect_summary=(
            defect_summary
            if isinstance(defect_summary, AgentTaskDefectSummary)
            else AgentTaskDefectSummary(**defect_summary)
            if isinstance(defect_summary, dict)
            else None
        ),
        quality_score=float(task.quality_score or 0.0),
        security_score=float(task.security_score) if task.security_score is not None else None,
        progress_percentage=progress,
        created_at=task.created_at or datetime.now(timezone.utc),
        started_at=task.started_at,
        completed_at=task.completed_at,
        error_message=task.error_message,
        audit_scope=task.audit_scope,
        target_vulnerabilities=task.target_vulnerabilities,
        verification_level=task.verification_level,
        tool_evidence_protocol=tool_evidence_protocol,
        exclude_patterns=task.exclude_patterns,
        target_files=task.target_files,
        report=task.report,
    )
