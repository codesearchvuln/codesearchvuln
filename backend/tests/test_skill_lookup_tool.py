import pytest

from app.services.agent.tools import skill_lookup_tool as skill_lookup_module
from app.services.agent.tools.skill_lookup_tool import SkillLookupTool


class _FakeRegistry:
    enabled = True

    def __init__(self):
        self.search_calls = []
        self.detail_calls = []

    def search(self, *, query: str, namespace: str | None, limit: int, offset: int):
        self.search_calls.append(
            {
                "query": query,
                "namespace": namespace,
                "limit": limit,
                "offset": offset,
            }
        )
        return {
            "enabled": True,
            "total": 2,
            "limit": limit,
            "offset": offset,
            "items": [
                {"skill_id": "using-superpowers@agents", "summary": "agents variant"},
                {"skill_id": "using-superpowers@codex", "summary": "codex variant"},
            ],
        }

    def get_detail(self, *, skill_id: str, include_workflow: bool):
        self.detail_calls.append({"skill_id": skill_id, "include_workflow": include_workflow})
        if skill_id == "missing@agents":
            return None
        payload = {
            "skill_id": skill_id,
            "name": "using-superpowers",
            "namespace": "agents",
            "summary": "Use when starting a conversation.",
            "entrypoint": f"skills/{skill_id}/SKILL.md",
        }
        if include_workflow:
            payload["workflow_content"] = "# step1\n# step2\n"
            payload["workflow_truncated"] = False
        return payload


@pytest.mark.asyncio
async def test_skill_lookup_returns_catalog_hits(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skill_lookup_module, "get_skill_registry_service", lambda: fake_registry)
    tool = SkillLookupTool()

    result = await tool.execute(query="using-superpowers", namespace="agents", limit=3, offset=1)

    assert result.success is True
    assert result.data["mode"] == "catalog"
    assert result.data["total"] == 2
    assert result.data["items"][0]["skill_id"] == "using-superpowers@agents"
    assert fake_registry.search_calls == [
        {
            "query": "using-superpowers",
            "namespace": "agents",
            "limit": 3,
            "offset": 1,
        }
    ]


@pytest.mark.asyncio
async def test_skill_lookup_returns_workflow_preview_for_detail(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skill_lookup_module, "get_skill_registry_service", lambda: fake_registry)
    tool = SkillLookupTool()

    result = await tool.execute(
        skill_id="using-superpowers@agents",
        include_workflow=True,
    )

    assert result.success is True
    assert result.data["mode"] == "detail"
    assert result.data["skill"]["skill_id"] == "using-superpowers@agents"
    assert "workflow_preview" in result.data["skill"]
    assert fake_registry.detail_calls == [
        {"skill_id": "using-superpowers@agents", "include_workflow": True}
    ]


@pytest.mark.asyncio
async def test_skill_lookup_returns_error_for_missing_skill_id(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skill_lookup_module, "get_skill_registry_service", lambda: fake_registry)
    tool = SkillLookupTool()

    result = await tool.execute(skill_id="missing@agents", include_workflow=True)

    assert result.success is False
    assert "skill_not_found:missing@agents" in str(result.error)
    assert result.data["mode"] == "detail"
