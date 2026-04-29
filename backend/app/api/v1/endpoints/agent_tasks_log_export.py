"""Log export routes for agent tasks."""

import json
import re
from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.session import get_db
from app.models.agent_task import AgentEvent, AgentTask
from app.models.project import Project
from app.models.user import User
from app.services.agent_task_log_export import (
    build_agent_task_log_export_payload,
    render_agent_task_logs_markdown,
)

router = APIRouter()


def _sanitize_download_filename_segment(value: Optional[str], fallback: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return fallback
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", text).strip(" .")
    return text or fallback


def _build_download_content_disposition(filename: str) -> str:
    extension_match = re.search(r"(\.[A-Za-z0-9]+)$", filename)
    extension = extension_match.group(1) if extension_match else ""
    stem = filename[: -len(extension)] if extension else filename
    ascii_stem = re.sub(r"[^\x20-\x7E]+", "_", stem)
    ascii_stem = re.sub(r"_+", "_", ascii_stem).strip(" ._-") or "agent-task-logs"
    ascii_filename = f"{ascii_stem}{extension}"
    encoded_filename = quote(filename, safe="")
    return (
        f'attachment; filename="{ascii_filename}"; '
        f"filename*=UTF-8''{encoded_filename}"
    )


def _build_log_download_filename(task: AgentTask, extension: str) -> str:
    task_fallback = str(getattr(task, "id", "") or "task")[:8] or "task"
    task_name = _sanitize_download_filename_segment(getattr(task, "name", None), task_fallback)
    date_part = datetime.now().strftime("%Y-%m-%d")
    normalized_extension = str(extension or "").lstrip(".") or "txt"
    return f"活动日志-{task_name}-{date_part}.{normalized_extension}"


@router.get("/{task_id}/logs/export")
async def export_agent_task_logs(
    task_id: str,
    format: str = Query("json", pattern="^(json|markdown)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    del current_user

    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    project = await db.get(Project, task.project_id)
    if not project:
        raise HTTPException(status_code=403, detail="无权访问此任务")

    result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.task_id == task_id)
        .order_by(AgentEvent.sequence.asc(), AgentEvent.created_at.asc())
    )
    events = result.scalars().all()
    payload = build_agent_task_log_export_payload(task, list(events))

    if format == "markdown":
        filename = _build_log_download_filename(task, "md")
        markdown = render_agent_task_logs_markdown(task, payload)
        return Response(
            content=markdown,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": _build_download_content_disposition(filename),
            },
        )

    filename = _build_log_download_filename(task, "json")
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": _build_download_content_disposition(filename),
        },
    )
