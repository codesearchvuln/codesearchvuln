"""Helpers for packaging task-local agent logs as a zip download."""

from __future__ import annotations

import os
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from app.services.agent.log_paths import (
    get_agent_runs_fallback_task_log_dir,
    get_agent_runs_task_log_dir,
    get_verification_fallback_task_log_dir,
    get_verification_task_log_dir,
    sanitize_task_log_token,
)


@dataclass(slots=True)
class AgentTaskLocalLogArchive:
    path: str
    file_count: int


def _iter_task_log_roots(task_id: str) -> list[tuple[str, str, Path]]:
    safe_task_id = sanitize_task_log_token(task_id, "no_task")
    return [
        ("agent_runs", safe_task_id, get_agent_runs_task_log_dir(task_id, create=False)),
        ("agent_runs", safe_task_id, get_agent_runs_fallback_task_log_dir(task_id, create=False)),
        ("verification", safe_task_id, get_verification_task_log_dir(task_id, create=False)),
        ("verification", safe_task_id, get_verification_fallback_task_log_dir(task_id, create=False)),
    ]


def build_agent_task_local_log_archive(task_id: str) -> AgentTaskLocalLogArchive:
    normalized_task_id = str(task_id or "").strip()
    if not normalized_task_id:
        raise FileNotFoundError("missing_task_id")

    roots_by_label: dict[str, tuple[str, Path]] = {}
    for label, safe_task_id, candidate in _iter_task_log_roots(normalized_task_id):
        if label in roots_by_label:
            continue
        if candidate.is_dir():
            roots_by_label[label] = (safe_task_id, candidate)

    if not roots_by_label:
        raise FileNotFoundError("task_local_logs_not_found")

    with tempfile.NamedTemporaryFile(prefix="agent-task-local-logs-", suffix=".zip", delete=False) as tmp_file:
        archive_path = tmp_file.name

    file_count = 0
    try:
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for label in ("agent_runs", "verification"):
                root_info = roots_by_label.get(label)
                if root_info is None:
                    continue
                _, root_dir = root_info
                for current_root, _, filenames in os.walk(root_dir):
                    for filename in filenames:
                        file_path = Path(current_root) / filename
                        if not file_path.is_file() or file_path.suffix.lower() != ".log":
                            continue
                        arcname = file_path.name
                        bundle.write(file_path, arcname)
                        file_count += 1
        if file_count <= 0:
            raise FileNotFoundError("task_local_logs_empty")
        return AgentTaskLocalLogArchive(path=archive_path, file_count=file_count)
    except Exception:
        try:
            os.unlink(archive_path)
        except FileNotFoundError:
            pass
        raise


def cleanup_local_log_archive(path: str) -> None:
    try:
        os.unlink(path)
    except FileNotFoundError:
        return
