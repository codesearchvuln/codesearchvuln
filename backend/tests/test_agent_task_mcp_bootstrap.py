from types import SimpleNamespace

import pytest

from app.api.v1.endpoints.agent_tasks import _bootstrap_task_mcp_runtime, _build_task_mcp_runtime
from app.services.agent.mcp.runtime import MCPExecutionResult


class _Emitter:
    def __init__(self):
        self.infos = []
        self.errors = []

    async def emit_info(self, message: str, metadata=None):
        self.infos.append((message, metadata or {}))

    async def emit_error(self, message: str, metadata=None):
        self.errors.append((message, metadata or {}))


class _Runtime:
    def __init__(
        self,
        *,
        project_root: str,
        build_success: bool = True,
        extra_domain_registered: bool = False,
    ):
        self.project_root = project_root
        self.build_success = build_success
        self.calls = []
        self.domain_adapters = {"legacy_backend": {"backend": object()}} if extra_domain_registered else {}

    async def call_mcp_tool(self, *, mcp_name: str, tool_name: str, arguments, agent_name=None, alias_used=None):
        self.calls.append(
            {
                "mcp_name": mcp_name,
                "tool_name": tool_name,
                "arguments": dict(arguments or {}),
                "agent_name": agent_name,
                "alias_used": alias_used,
            }
        )
        if mcp_name == "filesystem" and tool_name == "list_allowed_directories":
            return MCPExecutionResult(
                handled=True,
                success=True,
                data=f"Allowed directories:\\n{self.project_root}",
                metadata={"mcp_runtime_domain": "stdio"},
            )
        return MCPExecutionResult(
            handled=False,
            success=False,
            error=f"unexpected:{mcp_name}:{tool_name}",
            metadata={"mcp_runtime_domain": "stdio"},
        )


@pytest.mark.asyncio
async def test_bootstrap_task_mcp_runtime_only_binds_filesystem_root(tmp_path):
    emitter = _Emitter()
    runtime = _Runtime(project_root=str(tmp_path), build_success=True)

    result = await _bootstrap_task_mcp_runtime(
        runtime,
        project_root=str(tmp_path),
        event_emitter=emitter,
    )

    assert result["filesystem"]["project_root_allowed"] is True
    assert [call["tool_name"] for call in runtime.calls] == [
        "list_allowed_directories",
    ]
    assert not any("code_index" in message for message, _ in emitter.infos)
    assert all("filesystem" in message or "绑定" in message for message, _ in emitter.infos)


@pytest.mark.asyncio
async def test_bootstrap_task_mcp_runtime_does_not_touch_code_index_on_bootstrap(tmp_path):
    emitter = _Emitter()
    runtime = _Runtime(project_root=str(tmp_path), build_success=False)

    result = await _bootstrap_task_mcp_runtime(
        runtime,
        project_root=str(tmp_path),
        event_emitter=emitter,
    )
    assert result["filesystem"]["project_root_allowed"] is True
    assert [call["tool_name"] for call in runtime.calls] == [
        "list_allowed_directories",
    ]


@pytest.mark.asyncio
async def test_bootstrap_task_mcp_runtime_ignores_unrelated_runtime_domains(tmp_path):
    emitter = _Emitter()
    runtime = _Runtime(
        project_root=str(tmp_path),
        build_success=True,
        extra_domain_registered=True,
    )

    result = await _bootstrap_task_mcp_runtime(
        runtime,
        project_root=str(tmp_path),
        event_emitter=emitter,
    )

    assert [call["tool_name"] for call in runtime.calls] == [
        "list_allowed_directories",
    ]
    assert "legacy_backend" not in result
    assert all("filesystem" in message or "绑定" in message for message, _ in emitter.infos)


def test_build_task_mcp_runtime_only_registers_required_domains(monkeypatch, tmp_path):
    monkeypatch.setattr("app.core.config.settings.MCP_ENABLED", True)
    monkeypatch.setattr("app.core.config.settings.MCP_FILESYSTEM_ENABLED", True)

    runtime = _build_task_mcp_runtime(
        project_root=str(tmp_path),
        user_config=None,
        target_files=None,
    )

    assert runtime.domain_adapters == {}
    assert runtime.runtime_modes == {"filesystem": "stdio_only"}
    assert runtime.required_mcps == ["filesystem"]
