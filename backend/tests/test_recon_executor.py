import asyncio
from types import SimpleNamespace

import pytest

from app.services.agent.agents.base import AgentResult
from app.services.agent.workflow.models import WorkflowState
from app.services.agent.workflow.recon_executor import ReconModuleExecutor
from app.services.agent.workflow.recon_models import (
    ProjectReconModel,
    ReconModuleDescriptor,
    build_project_recon_model,
)


def test_build_project_recon_model_respects_target_files(tmp_path):
    (tmp_path / "src" / "auth").mkdir(parents=True)
    (tmp_path / "src" / "billing").mkdir(parents=True)
    (tmp_path / "src" / "auth" / "login.py").write_text("print('ok')\n", encoding="utf-8")
    (tmp_path / "src" / "billing" / "payment.py").write_text("print('pay')\n", encoding="utf-8")

    model = build_project_recon_model(
        project_root=str(tmp_path),
        project_info={"languages": ["Python"]},
        config={
            "target_files": [
                "src/auth/login.py",
                "src/billing/payment.py",
            ]
        },
    )

    assert model.scope_limited is True
    assert {module.module_type for module in model.module_descriptors} >= {"auth", "payment"}
    assert sorted(model.target_files) == ["src/auth/login.py", "src/billing/payment.py"]


class _ScopedTool:
    def __init__(self):
        self.target_files = None


class _FakeReconSubAgent:
    active_runs = 0
    max_seen = 0
    seen_toolsets = []

    def __init__(self, llm_service=None, tools=None, event_emitter=None):
        self.llm_service = llm_service
        self.tools = tools or {}
        self.event_emitter = event_emitter
        self.config = SimpleNamespace(name="ReconSubAgent")
        self.name = "ReconSubAgent"
        self._tool_runtime = None
        self._write_scope_guard = None
        self._cancel_callback = None

    async def emit_event(self, event_type, message, metadata=None, **kwargs):
        if self.event_emitter is not None:
            self.event_emitter.events.append(
                {
                    "event_type": event_type,
                    "message": message,
                    "metadata": dict(metadata or {}),
                    "extra": dict(kwargs or {}),
                }
            )

    def set_tool_runtime(self, runtime):
        self._tool_runtime = runtime

    def set_write_scope_guard(self, guard):
        self._write_scope_guard = guard

    def set_cancel_callback(self, callback):
        self._cancel_callback = callback

    def reset_session_memory(self):
        return None

    async def run(self, input_data):
        type(self).active_runs += 1
        type(self).max_seen = max(type(self).max_seen, type(self).active_runs)
        type(self).seen_toolsets.append(sorted(self.tools.keys()))
        try:
            await asyncio.sleep(0.02)
            scoped_files = sorted(self.tools["scoped"].target_files or [])
            primary = scoped_files[0] if scoped_files else "unknown.py"
            return AgentResult(
                success=True,
                data={
                    "risk_points": [
                        {
                            "file_path": primary,
                            "line_start": 1,
                            "description": f"Risk in {primary}",
                            "vulnerability_type": "potential_issue",
                            "severity": "medium",
                        }
                    ],
                    "input_surfaces": [f"input:{primary}"],
                    "trust_boundaries": [f"boundary:{primary}"],
                    "target_files": scoped_files,
                    "coverage_summary": {
                        "files_read": scoped_files,
                        "files_discovered": scoped_files,
                        "directories_scanned": list(
                            {
                                primary.rsplit("/", 1)[0]
                                for primary in scoped_files
                                if "/" in primary
                            }
                        ),
                    },
                    "summary": f"module scoped to {primary}",
                },
                iterations=1,
                tool_calls=1,
                tokens_used=10,
            )
        finally:
            type(self).active_runs -= 1


class _FakeHostAgent:
    def __init__(self, event_emitter=None):
        self.name = "Recon"
        self.event_emitter = event_emitter

    async def emit_event(self, event_type, message, metadata=None, **kwargs):
        if self.event_emitter is not None:
            self.event_emitter.events.append(
                {
                    "event_type": event_type,
                    "message": message,
                    "metadata": dict(metadata or {}),
                    "extra": dict(kwargs or {}),
                }
            )


class _FakeEventEmitter:
    def __init__(self):
        self.events = []


class _FakeOrchestrator:
    def __init__(self):
        event_emitter = _FakeEventEmitter()
        self.sub_agents = {
            "recon": _FakeHostAgent(event_emitter=event_emitter),
            "recon_subagent": _FakeReconSubAgent(
                llm_service=object(),
                tools={
                    "scoped": _ScopedTool(),
                    "run_recon_subagent": object(),
                    "push_risk_point_to_queue": object(),
                },
                event_emitter=event_emitter,
            )
        }
        self._runtime_context = {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {},
            "project_root": "/tmp/demo",
            "task_id": "task-1",
        }
        self._total_tokens = 0
        self._tool_calls = 0
        self._iteration = 0
        self.is_cancelled = False
        self.event_emitter = event_emitter


@pytest.mark.asyncio
async def test_recon_executor_respects_max_workers():
    _FakeReconSubAgent.active_runs = 0
    _FakeReconSubAgent.max_seen = 0
    _FakeReconSubAgent.seen_toolsets = []
    orchestrator = _FakeOrchestrator()
    executor = ReconModuleExecutor(
        orchestrator=orchestrator,
        max_workers=2,
        enable_parallel=True,
    )
    state = WorkflowState()
    model = ProjectReconModel(
        project_root="/tmp/demo",
        module_descriptors=[
            ReconModuleDescriptor(
                module_id="auth",
                name="src/auth",
                module_type="auth",
                paths=["src/auth"],
                risk_focus=["authentication"],
                target_files=["src/auth/login.py"],
            ),
            ReconModuleDescriptor(
                module_id="payment",
                name="src/payment",
                module_type="payment",
                paths=["src/payment"],
                risk_focus=["amount_tampering"],
                target_files=["src/payment/pay.py"],
            ),
            ReconModuleDescriptor(
                module_id="admin",
                name="src/admin",
                module_type="admin",
                paths=["src/admin"],
                risk_focus=["authorization"],
                target_files=["src/admin/panel.py"],
            ),
        ],
    )

    results = await executor.run_parallel_recon(
        state=state,
        task_id="task-1",
        project_model=model,
    )

    assert len(results) == 3
    assert _FakeReconSubAgent.max_seen <= 2
    assert state.recon_modules_total == 3
    assert state.recon_modules_processed == 3
    assert state.recon_modules_failed == 0
    assert [result.target_files for result in results] == [
        ["src/auth/login.py"],
        ["src/payment/pay.py"],
        ["src/admin/panel.py"],
    ]


@pytest.mark.asyncio
async def test_recon_executor_emits_host_and_subagent_lifecycle_and_filters_host_tools():
    _FakeReconSubAgent.active_runs = 0
    _FakeReconSubAgent.max_seen = 0
    _FakeReconSubAgent.seen_toolsets = []
    orchestrator = _FakeOrchestrator()
    executor = ReconModuleExecutor(
        orchestrator=orchestrator,
        max_workers=2,
        enable_parallel=True,
    )
    state = WorkflowState()
    model = ProjectReconModel(
        project_root="/tmp/demo",
        module_descriptors=[
            ReconModuleDescriptor(
                module_id="auth",
                name="src/auth",
                module_type="auth",
                paths=["src/auth"],
                description="Inspect auth",
                risk_focus=["authentication"],
                target_files=["src/auth/login.py"],
            ),
            ReconModuleDescriptor(
                module_id="admin",
                name="src/admin",
                module_type="admin",
                paths=["src/admin"],
                description="Inspect admin",
                risk_focus=["authorization"],
                target_files=["src/admin/panel.py"],
            ),
        ],
    )

    results = await executor.run_parallel_recon(
        state=state,
        task_id="task-1",
        project_model=model,
    )

    assert len(results) == 2
    assert _FakeReconSubAgent.seen_toolsets
    for toolset in _FakeReconSubAgent.seen_toolsets:
        assert "run_recon_subagent" not in toolset
        assert "push_risk_point_to_queue" not in toolset

    messages = [event["message"] for event in orchestrator.event_emitter.events]
    assert any("派发 2 个 ReconSubAgent" in message for message in messages)
    assert any("已加入 ReconSubAgent 队列" in message for message in messages)
    assert any("开始侦查模块 src/auth" in message for message in messages)
    assert any("等待 ReconAgent 汇总结果" in message for message in messages)

    subagent_names = [
        event["metadata"].get("agent_name")
        for event in orchestrator.event_emitter.events
        if event["metadata"].get("agent_role") == "recon_subagent"
    ]
    assert any(str(name).startswith("ReconSubAgent[") for name in subagent_names)
