from __future__ import annotations

from typing import Any, Dict, List

import pytest

from app.services.agent.agents.business_logic_recon import BLReconStep, BusinessLogicReconAgent


class _FakeQueueService:
    def __init__(self):
        self._size = 0

    def size(self, task_id: str) -> int:
        return self._size

    def grow(self, count: int = 1) -> None:
        self._size += max(0, int(count))


class _FakePushTool:
    def __init__(self, queue_service: _FakeQueueService, task_id: str):
        self.queue_service = queue_service
        self.task_id = task_id


@pytest.mark.asyncio
async def test_business_logic_recon_counts_only_confirmed_queue_pushes():
    queue = _FakeQueueService()
    agent = BusinessLogicReconAgent(
        llm_service=object(),
        tools={"push_bl_risk_point_to_queue": _FakePushTool(queue, "task-1")},
        event_emitter=None,
    )

    emitted_thoughts: List[str] = []
    emitted_events: List[Dict[str, Any]] = []
    steps = [
        BLReconStep(
            thought="准备推送 1 个业务逻辑风险点",
            action="push_bl_risk_point_to_queue",
            action_input={
                "file_path": "pdns/ws-auth.cc",
                "line_start": 88,
                "description": "api-key 为空时鉴权 fail-open",
                "vulnerability_type": "auth_bypass",
            },
        ),
        BLReconStep(
            thought="已推送 3 个风险点",
            is_final=True,
            final_answer="已推送 3 个风险点",
        ),
    ]

    async def fake_stream_llm_call(_history):
        return "ok", 0

    def fake_parse(_response):
        return steps.pop(0)

    async def fake_execute_tool(_tool_name, _tool_input):
        return "业务逻辑风险点重复，已跳过重复入队"

    async def fake_emit_thinking(message: str):
        emitted_thoughts.append(str(message))

    async def fake_emit_event(event_type: str, message: str, metadata=None, **kwargs):
        emitted_events.append(
            {
                "event_type": event_type,
                "message": str(message),
                "metadata": dict(metadata or {}),
                "extra": dict(kwargs or {}),
            }
        )

    agent.stream_llm_call = fake_stream_llm_call
    agent._parse_llm_response = fake_parse
    agent.execute_tool = fake_execute_tool
    agent.emit_thinking = fake_emit_thinking
    agent.emit_event = fake_emit_event
    agent.emit_llm_action = fake_emit_event
    agent.emit_llm_observation = fake_emit_thinking

    result = await agent.run({"project_root": "/tmp/project", "project_info": {}, "config": {}})

    assert result.success is True
    assert result.data["risk_points_pushed"] == 0
    assert emitted_thoughts[-1] == "业务逻辑侦察完成，但未成功入队任何业务逻辑风险点。"
    assert all("已推送 3 个风险点" not in item for item in emitted_thoughts)
    assert any("共推送 0 个业务逻辑风险点" in item["message"] for item in emitted_events)


@pytest.mark.asyncio
async def test_business_logic_recon_tracks_queue_growth_as_confirmed_push():
    queue = _FakeQueueService()
    agent = BusinessLogicReconAgent(
        llm_service=object(),
        tools={"push_bl_risk_point_to_queue": _FakePushTool(queue, "task-1")},
        event_emitter=None,
    )

    steps = [
        BLReconStep(
            thought="准备推送 1 个业务逻辑风险点",
            action="push_bl_risk_point_to_queue",
            action_input={
                "file_path": "pdns/ws-auth.cc",
                "line_start": 88,
                "description": "api-key 为空时鉴权 fail-open",
                "vulnerability_type": "auth_bypass",
            },
        ),
        BLReconStep(
            thought="全部完成",
            is_final=True,
            final_answer="全部完成",
        ),
    ]

    async def fake_stream_llm_call(_history):
        return "ok", 0

    def fake_parse(_response):
        return steps.pop(0)

    async def fake_execute_tool(_tool_name, _tool_input):
        queue.grow(1)
        return "业务逻辑风险点已入队"

    async def _noop(*_args, **_kwargs):
        return None

    agent.stream_llm_call = fake_stream_llm_call
    agent._parse_llm_response = fake_parse
    agent.execute_tool = fake_execute_tool
    agent.emit_thinking = _noop
    agent.emit_event = _noop
    agent.emit_llm_action = _noop
    agent.emit_llm_observation = _noop

    result = await agent.run({"project_root": "/tmp/project", "project_info": {}, "config": {}})

    assert result.success is True
    assert result.data["risk_points_pushed"] == 1
    assert result.data["risk_points"][0]["file_path"] == "pdns/ws-auth.cc"
