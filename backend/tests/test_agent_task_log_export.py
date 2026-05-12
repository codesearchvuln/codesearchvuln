from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.v1.endpoints.agent_tasks import export_agent_task_logs
from app.models.agent_task import AgentEvent, AgentTask
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
