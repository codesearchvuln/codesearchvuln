"""Shared task-local log path helpers for agent trace exports."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path


def sanitize_task_log_token(value: str | None, default: str) -> str:
    raw = str(value or "").strip().lower()
    safe = re.sub(r"[^a-z0-9._-]+", "_", raw)
    return safe or default


def get_backend_log_root() -> Path:
    return Path(__file__).resolve().parents[3] / "log"


def get_agent_runs_task_log_dir(task_id: str | None, *, create: bool = False) -> Path:
    safe_task_id = sanitize_task_log_token(task_id, "no_task")
    log_dir = get_backend_log_root() / "agent_runs" / safe_task_id
    if create:
        log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_agent_runs_fallback_task_log_dir(task_id: str | None, *, create: bool = False) -> Path:
    safe_task_id = sanitize_task_log_token(task_id, "no_task")
    log_dir = Path(tempfile.gettempdir()) / "audittool-agent-runs" / safe_task_id
    if create:
        log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_verification_task_log_dir(task_id: str | None, *, create: bool = False) -> Path:
    safe_task_id = sanitize_task_log_token(task_id, "no_task")
    log_dir = get_backend_log_root() / "verification" / safe_task_id
    if create:
        log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_verification_fallback_task_log_dir(task_id: str | None, *, create: bool = False) -> Path:
    safe_task_id = sanitize_task_log_token(task_id, "no_task")
    log_dir = Path(tempfile.gettempdir()) / "vulhunter" / "verification" / safe_task_id
    if create:
        log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir
