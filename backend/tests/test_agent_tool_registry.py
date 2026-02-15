from unittest.mock import MagicMock

import pytest

from app.api.v1.endpoints.agent_tasks import _initialize_tools


@pytest.mark.asyncio
async def test_smart_audit_tool_registry_excludes_gitleaks_scan(tmp_path):
    tools = await _initialize_tools(
        project_root=str(tmp_path),
        llm_service=MagicMock(),
        user_config=None,
        sandbox_manager=MagicMock(),
        rag_enabled=False,
        exclude_patterns=[],
        target_files=[],
        project_id=None,
        event_emitter=None,
        task_id=None,
    )

    assert "gitleaks_scan" not in tools["recon"]
    assert "gitleaks_scan" not in tools["analysis"]

