import asyncio
from types import SimpleNamespace

import pytest

from app.services.agent.agents.base import AgentResult
from app.services.agent.tools.recon_subagent_tool import RunReconSubAgentTool


class _ScopedTool:
    def __init__(self):
        self.target_files = None


class _FakeReconSubAgent:
    def __init__(self, llm_service=None, tools=None, event_emitter=None):
        self.llm_service = llm_service
        self.tools = tools or {}
        self.event_emitter = event_emitter
        self.config = SimpleNamespace(name="ReconSubAgent")
        self.name = "ReconSubAgent"
        self._tool_runtime = None
        self._write_scope_guard = None
        self._cancel_callback = None

    def set_tool_runtime(self, runtime):
        self._tool_runtime = runtime

    def set_write_scope_guard(self, guard):
        self._write_scope_guard = guard

    def set_cancel_callback(self, callback):
        self._cancel_callback = callback

    def reset_session_memory(self):
        return None

    async def run(self, input_data):
        await asyncio.sleep(0.01)
        module = input_data.get("config", {}).get("recon_module", {})
        scoped_files = list(module.get("target_files") or [])
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
                "target_files": list(scoped_files),
                "coverage_summary": {
                    "files_read": list(scoped_files),
                    "files_discovered": list(scoped_files),
                    "directories_scanned": [
                        primary.rsplit("/", 1)[0]
                        for primary in scoped_files
                        if "/" in primary
                    ],
                },
                "summary": str(module.get("description") or primary),
            },
            iterations=1,
            tool_calls=1,
            tokens_used=10,
        )


class _FakeOrchestrator:
    def __init__(self, project_root: str):
        self.sub_agents = {
            "recon_subagent": _FakeReconSubAgent(
                llm_service=object(),
                tools={"scoped": _ScopedTool()},
                event_emitter=None,
            )
        }
        self._runtime_context = {
            "project_info": {"name": "demo", "languages": ["Python"]},
            "config": {},
            "project_root": project_root,
            "task_id": "task-1",
        }
        self._total_tokens = 0
        self._tool_calls = 0
        self._iteration = 0
        self.is_cancelled = False


@pytest.mark.asyncio
async def test_run_recon_subagent_tool_plan_accepts_minimal_modules(tmp_path):
    (tmp_path / "src" / "auth").mkdir(parents=True)
    (tmp_path / "src" / "auth" / "login.py").write_text("print('ok')\n", encoding="utf-8")
    orchestrator = _FakeOrchestrator(str(tmp_path))
    tool = RunReconSubAgentTool(orchestrator_provider=lambda: orchestrator)

    result = await tool.execute(
        action="plan",
        modules=[
            {
                "directories": ["src/auth"],
                "description": "Inspect authentication flows in src/auth",
            }
        ],
        notes="legacy host notes should be ignored",
    )

    assert result.success is True
    assert result.data["planned_modules"] == [
        {
            "module_id": "src_auth",
            "directories": ["src/auth"],
            "description": "Inspect authentication flows in src/auth",
        }
    ]
    planned_module = result.data["project_model"]["module_descriptors"][0]
    assert planned_module["paths"] == ["src/auth"]
    assert planned_module["description"] == "Inspect authentication flows in src/auth"
    assert planned_module["target_files"] == ["src/auth/login.py"]


@pytest.mark.asyncio
async def test_run_recon_subagent_tool_run_reuses_verbose_plan_payload(tmp_path):
    (tmp_path / "src" / "auth").mkdir(parents=True)
    (tmp_path / "src" / "auth" / "login.py").write_text("print('ok')\n", encoding="utf-8")
    (tmp_path / "src" / "payment").mkdir(parents=True)
    (tmp_path / "src" / "payment" / "charge.py").write_text("print('pay')\n", encoding="utf-8")
    orchestrator = _FakeOrchestrator(str(tmp_path))
    tool = RunReconSubAgentTool(orchestrator_provider=lambda: orchestrator)

    plan_result = await tool.execute(
        action="plan",
        modules=[
            {
                "name": "auth",
                "paths": ["src/auth"],
                "risk_focus": ["authentication", "session"],
            }
        ],
    )
    run_result = await tool.execute(action="run")

    assert plan_result.success is True
    assert run_result.success is True
    assert run_result.data["selected_module_count"] == 1
    assert run_result.data["selected_module_ids"] == ["src_auth"]
    assert run_result.data["module_results"][0]["target_files"] == ["src/auth/login.py"]
    assert run_result.data["module_results"][0]["summary"] == "authentication, session"


@pytest.mark.asyncio
async def test_run_recon_subagent_tool_plan_drops_extra_fields_before_validation(tmp_path):
    (tmp_path / "src" / "auth").mkdir(parents=True)
    (tmp_path / "src" / "auth" / "login.py").write_text("print('ok')\n", encoding="utf-8")
    orchestrator = _FakeOrchestrator(str(tmp_path))
    tool = RunReconSubAgentTool(orchestrator_provider=lambda: orchestrator)

    result = await tool.execute(
        action="plan",
        modules=[
            {
                "directories": ["src/auth"],
                "description": "Inspect auth handlers",
                "priority": "high",
                "entrypoints": ["src/auth/login.py"],
            }
        ],
        unexpected_top_level="should be ignored",
    )

    assert result.success is True
    assert result.data["planned_modules"] == [
        {
            "module_id": "src_auth",
            "directories": ["src/auth"],
            "description": "Inspect auth handlers",
        }
    ]
