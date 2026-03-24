import subprocess
import threading
import time

import pytest

from app.api.v1.endpoints import static_tasks_shared
from app.api.v1.endpoints.static_tasks_opengrep import get_static_task_progress


def test_build_backend_venv_env_prefixes_backend_venv_bin(monkeypatch):
    monkeypatch.setattr(static_tasks_shared.settings, "BACKEND_VENV_PATH", "/opt/backend-venv")

    env = static_tasks_shared._build_backend_venv_env({"PATH": "/usr/local/bin:/usr/bin"})

    assert env["VIRTUAL_ENV"] == "/opt/backend-venv"
    assert env["PYTHONNOUSERSITE"] == "1"
    assert env["PATH"].startswith("/opt/backend-venv/bin:")


def test_resolve_backend_venv_executable_uses_configured_dir(tmp_path, monkeypatch):
    venv_dir = tmp_path / "backend-venv"
    bin_dir = venv_dir / "bin"
    bin_dir.mkdir(parents=True)
    bandit_bin = bin_dir / "bandit"
    bandit_bin.write_text("#!/bin/sh\n", encoding="utf-8")

    monkeypatch.setattr(static_tasks_shared.settings, "BACKEND_VENV_PATH", str(venv_dir))

    resolved = static_tasks_shared._resolve_backend_venv_executable("bandit")

    assert resolved == str(bandit_bin)


def test_record_scan_progress_initializes_shared_store():
    task_id = "task-progress-1"
    static_tasks_shared._scan_progress_store.clear()

    static_tasks_shared._record_scan_progress(
        task_id,
        status="pending",
        progress=5,
        stage="pending",
        message="queued",
    )

    state = static_tasks_shared._scan_progress_store[task_id]
    assert state["status"] == "pending"
    assert state["progress"] == 5
    assert state["current_stage"] == "pending"
    assert state["message"] == "queued"
    assert len(state["logs"]) == 1


async def test_get_static_task_progress_reads_shared_progress_store():
    task_id = "task-progress-2"
    static_tasks_shared._scan_progress_store.clear()
    static_tasks_shared._record_scan_progress(
        task_id,
        status="running",
        progress=42,
        stage="scan",
        message="scanning",
    )

    class _Result:
        def scalar_one_or_none(self):
            return type(
                "Task",
                (),
                {
                    "id": task_id,
                    "status": "running",
                    "created_at": None,
                    "updated_at": None,
                },
            )()

    class _Db:
        async def execute(self, _statement):
            return _Result()

    payload = await get_static_task_progress(
        task_id=task_id,
        include_logs=True,
        db=_Db(),
        current_user=type("User", (), {"id": "u-1"})(),
    )

    assert payload["task_id"] == task_id
    assert payload["status"] == "running"
    assert payload["progress"] == 42
    assert payload["logs"][0]["message"] == "scanning"


def test_scan_process_active_and_cancel_uses_shared_tracking():
    task_id = "shared-cancel-1"
    result_holder: dict[str, object] = {}

    def _runner():
        result_holder["result"] = static_tasks_shared._run_subprocess_with_tracking(
            "yasa",
            task_id,
            ["bash", "-lc", "sleep 5"],
            timeout=10,
        )

    worker = threading.Thread(target=_runner, daemon=True)
    worker.start()
    time.sleep(0.2)

    assert static_tasks_shared._is_scan_process_active("yasa", task_id) is True
    assert static_tasks_shared._request_scan_task_cancel("yasa", task_id) is True

    worker.join(timeout=5)
    assert worker.is_alive() is False
    assert static_tasks_shared._is_scan_process_active("yasa", task_id) is False
    assert "result" in result_holder
    completed = result_holder["result"]
    assert isinstance(completed, subprocess.CompletedProcess)
    assert completed.returncode != 0


def test_scan_process_timeout_cleans_tracking_state():
    task_id = "shared-timeout-1"
    with pytest.raises(subprocess.TimeoutExpired):
        static_tasks_shared._run_subprocess_with_tracking(
            "yasa",
            task_id,
            ["bash", "-lc", "sleep 3"],
            timeout=1,
        )

    assert static_tasks_shared._is_scan_process_active("yasa", task_id) is False


def test_collect_yasa_process_pids_filters_by_task_id(monkeypatch):
    output = "\n".join(
        [
            "101 /home/jy/.local/bin/yasa-engine.real --report /tmp/yasa_report_task-a_123",
            "102 /home/jy/.local/bin/yasa-engine.real --report /tmp/yasa_report_task-b_456",
            "103 /usr/bin/python other_script.py",
        ]
    )
    monkeypatch.setattr(static_tasks_shared.subprocess, "check_output", lambda *args, **kwargs: output)
    monkeypatch.setattr(static_tasks_shared.os, "getpid", lambda: 999999)

    matched = static_tasks_shared._collect_yasa_process_pids(task_id="task-a")
    assert matched == [101]


def test_force_cleanup_yasa_processes_terminates_and_kills(monkeypatch):
    monkeypatch.setattr(
        static_tasks_shared,
        "_collect_yasa_process_pids",
        lambda **kwargs: [201, 202],
    )
    monkeypatch.setattr(static_tasks_shared.os, "name", "posix")
    monkeypatch.setattr(static_tasks_shared.os, "getpgid", lambda pid: pid)
    monkeypatch.setattr(static_tasks_shared.time, "sleep", lambda _seconds: None)

    alive = {201, 202}
    term_calls: list[tuple[int, int]] = []
    kill_calls: list[tuple[int, int]] = []

    def _kill(pid: int, sig: int):
        # os.kill(pid, 0) used as liveness probe
        if sig == 0:
            if pid in alive:
                return
            raise ProcessLookupError
        if sig == static_tasks_shared.signal.SIGTERM:
            term_calls.append((pid, sig))
        elif sig == static_tasks_shared.signal.SIGKILL:
            kill_calls.append((pid, sig))
            alive.discard(pid)

    def _killpg(pgid: int, sig: int):
        if sig == static_tasks_shared.signal.SIGTERM:
            term_calls.append((pgid, sig))
        elif sig == static_tasks_shared.signal.SIGKILL:
            kill_calls.append((pgid, sig))
            alive.discard(pgid)

    monkeypatch.setattr(static_tasks_shared.os, "kill", _kill)
    monkeypatch.setattr(static_tasks_shared.os, "killpg", _killpg)

    result = static_tasks_shared._force_cleanup_yasa_processes(task_id="task-any", grace_seconds=0)
    assert result["matched"] == 2
    assert result["terminated"] == 2
    assert result["killed"] == 2
    assert len(term_calls) >= 2
    assert len(kill_calls) >= 2
