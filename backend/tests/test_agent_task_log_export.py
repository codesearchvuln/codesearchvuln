import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.v1.endpoints.agent_tasks import export_agent_task_logs
from app.api.v1.endpoints import agent_tasks_log_export as log_export_endpoint
from app.models.agent_task import AgentEvent, AgentTask
from app.services import agent_task_local_log_export
from app.services.agent_task_log_export import (
    build_agent_task_log_export_payload,
    render_agent_task_logs_markdown,
)


class _ScalarListResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _make_tool_events(task_id: str, started_at: datetime) -> list[AgentEvent]:
    return [
        AgentEvent(
            id="event-tool-call",
            task_id=task_id,
            event_type="tool_call",
            phase="analysis",
            tool_name="read_file",
            tool_input={"path": "src/demo.py"},
            event_metadata={
                "tool_call_id": "call-1",
                "agent_name": "AnalysisAgent",
            },
            sequence=1,
            created_at=started_at + timedelta(seconds=2),
        ),
        AgentEvent(
            id="event-tool-result",
            task_id=task_id,
            event_type="tool_result",
            phase="analysis",
            tool_name="read_file",
            tool_output={"result": "print('ok')"},
            tool_duration_ms=128,
            event_metadata={
                "tool_call_id": "call-1",
                "tool_status": "completed",
                "agent_name": "AnalysisAgent",
            },
            sequence=2,
            created_at=started_at + timedelta(seconds=5),
        ),
    ]


def test_build_agent_task_log_export_payload_merges_tool_events():
    started_at = datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC)
    task = AgentTask(
        id="task-export-1",
        project_id="project-1",
        name="[hybrid] Demo Scan",
        description="混合扫描导出测试",
        status="completed",
        current_phase="reporting",
        current_step="done",
        started_at=started_at,
    )
    events = _make_tool_events(task.id, started_at)

    payload = build_agent_task_log_export_payload(task, events)

    assert payload["meta"]["source_mode"] == "hybrid"
    assert payload["meta"]["source_event_count"] == 2

    tool_logs = [item for item in payload["logs"] if item["type"] == "tool"]
    assert len(tool_logs) == 1

    tool_log = tool_logs[0]
    assert tool_log["title"] == "已完成：read_file"
    assert tool_log["tool"]["status"] == "completed"
    assert tool_log["tool"]["duration"] == 128
    assert tool_log["agentName"] == "分析智能体"
    assert tool_log["time"] == "00:00:05"
    assert "输入：" in tool_log["content"]
    assert "输出：" in tool_log["content"]

    markdown = render_agent_task_logs_markdown(task, payload)
    assert markdown.startswith("# 混合扫描活动日志")
    assert "已完成：read_file" in markdown


def test_build_agent_task_log_export_payload_keeps_thinking_and_llm_events():
    started_at = datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC)
    task = AgentTask(
        id="task-export-thinking",
        project_id="project-1",
        name="[agent] Demo Thinking",
        description="日志导出恢复测试",
        status="completed",
        current_phase="analysis",
        current_step="done",
        started_at=started_at,
    )
    events = [
        AgentEvent(
            id="event-thinking-start",
            task_id=task.id,
            event_type="thinking_start",
            phase="analysis",
            message="开始思考",
            sequence=1,
            created_at=started_at + timedelta(seconds=1),
        ),
        AgentEvent(
            id="event-llm-thought",
            task_id=task.id,
            event_type="llm_thought",
            phase="analysis",
            message="LLM 思考内容",
            event_metadata={"thought": "完整思考内容", "agent_name": "AnalysisAgent"},
            sequence=2,
            created_at=started_at + timedelta(seconds=2),
        ),
        AgentEvent(
            id="event-llm-observation",
            task_id=task.id,
            event_type="llm_observation",
            phase="analysis",
            message="观察结果",
            event_metadata={"deduped": True, "agent_name": "AnalysisAgent"},
            sequence=3,
            created_at=started_at + timedelta(seconds=3),
        ),
    ]

    payload = build_agent_task_log_export_payload(task, events)
    titles = [item["title"] for item in payload["logs"]]

    assert "开始思考" in titles
    assert "LLM 思考内容" in titles
    assert "观察结果" in titles


@pytest.mark.asyncio
async def test_export_agent_task_logs_uses_task_based_download_filename():
    started_at = datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC)
    task = SimpleNamespace(
        id="task-export-2",
        project_id="project-1",
        name="演示任务",
        description="智能扫描",
        status="completed",
        current_phase="reporting",
        current_step="done",
        started_at=started_at,
    )
    project = SimpleNamespace(id="project-1", name="Demo 项目")
    events = _make_tool_events(task.id, started_at)

    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])
    db.execute = AsyncMock(return_value=_ScalarListResult(events))

    response = await export_agent_task_logs(
        task_id=task.id,
        format="json",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    content_disposition = response.headers.get("content-disposition", "")
    assert 'filename="' in content_disposition
    assert "filename*=UTF-8''" in content_disposition
    assert "filename*=UTF-8''%E6%B4%BB%E5%8A%A8%E6%97%A5%E5%BF%97-%E6%BC%94%E7%A4%BA%E4%BB%BB%E5%8A%A1-" in content_disposition
    assert content_disposition.endswith(".json")
    assert '"task_id": "task-export-2"' in response.body.decode("utf-8")


def _install_local_log_dirs(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    *,
    task_id: str,
    include_agent_runs: bool,
    include_verification: bool,
) -> dict[str, Path]:
    safe_task_id = agent_task_local_log_export.sanitize_task_log_token(task_id, "no_task")
    dirs = {
        "agent_runs": tmp_path / "agent_runs" / safe_task_id,
        "verification": tmp_path / "verification" / safe_task_id,
    }
    fallback_agent_runs = tmp_path / "fallback-agent-runs" / safe_task_id
    fallback_verification = tmp_path / "fallback-verification" / safe_task_id

    if include_agent_runs:
        dirs["agent_runs"].mkdir(parents=True, exist_ok=True)
        (dirs["agent_runs"] / "agent.log").write_text("agent-run-log", encoding="utf-8")
        (dirs["agent_runs"] / "nested").mkdir(parents=True, exist_ok=True)
        (dirs["agent_runs"] / "nested" / "worker.log").write_text("worker", encoding="utf-8")
        (dirs["agent_runs"] / "nested" / "step.txt").write_text("step", encoding="utf-8")
    if include_verification:
        dirs["verification"].mkdir(parents=True, exist_ok=True)
        (dirs["verification"] / "verify.log").write_text("verification-log", encoding="utf-8")

    monkeypatch.setattr(
        agent_task_local_log_export,
        "get_agent_runs_task_log_dir",
        lambda task_id, create=False: dirs["agent_runs"],
    )
    monkeypatch.setattr(
        agent_task_local_log_export,
        "get_verification_task_log_dir",
        lambda task_id, create=False: dirs["verification"],
    )
    monkeypatch.setattr(
        agent_task_local_log_export,
        "get_agent_runs_fallback_task_log_dir",
        lambda task_id, create=False: fallback_agent_runs,
    )
    monkeypatch.setattr(
        agent_task_local_log_export,
        "get_verification_fallback_task_log_dir",
        lambda task_id, create=False: fallback_verification,
    )
    return dirs


@pytest.mark.asyncio
async def test_export_agent_task_logs_local_zip_includes_agent_and_verification_logs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    task_id = "task-local-1"
    _install_local_log_dirs(
        monkeypatch,
        tmp_path,
        task_id=task_id,
        include_agent_runs=True,
        include_verification=True,
    )

    task = SimpleNamespace(
        id=task_id,
        project_id="project-1",
        name="本地日志任务",
        description="[HYBRID]混合扫描",
        status="completed",
        current_phase="reporting",
        current_step="done",
        started_at=datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC),
    )
    project = SimpleNamespace(id="project-1", name="Demo 项目")
    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])
    db.execute = AsyncMock()

    response = await export_agent_task_logs(
        task_id=task_id,
        format="local_zip",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.media_type == "application/zip"
    content_disposition = response.headers.get("content-disposition", "")
    assert "filename*=UTF-8''%E6%9C%AC%E5%9C%B0%E6%97%A5%E5%BF%97-" in content_disposition
    assert content_disposition.endswith(".zip")
    assert db.execute.await_count == 0

    archive_path = Path(response.path)
    assert archive_path.exists()
    with zipfile.ZipFile(archive_path, "r") as archive:
        assert sorted(archive.namelist()) == [
            "agent.log",
            "verify.log",
            "worker.log",
        ]
        assert archive.read("agent.log").decode("utf-8") == "agent-run-log"
        assert "step.txt" not in archive.namelist()

    assert response.background is not None
    await response.background()
    assert not archive_path.exists()


@pytest.mark.asyncio
async def test_export_agent_task_logs_local_zip_supports_partial_export(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    task_id = "task-local-2"
    _install_local_log_dirs(
        monkeypatch,
        tmp_path,
        task_id=task_id,
        include_agent_runs=True,
        include_verification=False,
    )

    task = SimpleNamespace(
        id=task_id,
        project_id="project-1",
        name="Partial Logs",
        description="智能扫描",
        status="completed",
        current_phase="reporting",
        current_step="done",
        started_at=datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC),
    )
    project = SimpleNamespace(id="project-1", name="Demo 项目")
    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])

    response = await export_agent_task_logs(
        task_id=task_id,
        format="local_zip",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    archive_path = Path(response.path)
    with zipfile.ZipFile(archive_path, "r") as archive:
        assert sorted(archive.namelist()) == ["agent.log", "worker.log"]
        assert "verify.log" not in archive.namelist()
        assert "step.txt" not in archive.namelist()

    if response.background is not None:
        await response.background()


@pytest.mark.asyncio
async def test_export_agent_task_logs_local_zip_raises_when_no_local_logs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    task_id = "task-local-3"
    _install_local_log_dirs(
        monkeypatch,
        tmp_path,
        task_id=task_id,
        include_agent_runs=False,
        include_verification=False,
    )

    task = SimpleNamespace(
        id=task_id,
        project_id="project-1",
        name="No Logs",
        description="智能扫描",
        status="completed",
        current_phase="reporting",
        current_step="done",
        started_at=datetime(2026, 4, 21, 9, 0, 0, tzinfo=UTC),
    )
    project = SimpleNamespace(id="project-1", name="Demo 项目")
    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])

    with pytest.raises(log_export_endpoint.HTTPException) as exc_info:
        await export_agent_task_logs(
            task_id=task_id,
            format="local_zip",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "未找到任务本地日志"
