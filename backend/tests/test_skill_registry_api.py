from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import skills as skills_module


class _FakeRegistry:
    def __init__(self):
        self.enabled = True
        self.search_calls = []
        self.detail_calls = []
        self._detail = {
            "skill_id": "using-superpowers@agents",
            "name": "using-superpowers",
            "namespace": "agents",
            "summary": "Use when starting a conversation.",
            "entrypoint": "skills/using-superpowers@agents/SKILL.md",
            "mirror_dir": "skills/using-superpowers@agents",
            "source_root": "/tmp/.agents/skills",
            "source_dir": "/tmp/.agents/skills/using-superpowers",
            "source_skill_md": "/tmp/.agents/skills/using-superpowers/SKILL.md",
            "aliases": ["using-superpowers"],
            "has_scripts": True,
            "has_bin": False,
            "has_assets": False,
            "files_count": 3,
            "workflow_content": "# demo workflow",
            "workflow_truncated": False,
        }

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
            "total": 1,
            "limit": limit,
            "offset": offset,
            "items": [
                {
                    "skill_id": "using-superpowers@agents",
                    "name": "using-superpowers",
                    "namespace": "agents",
                    "summary": "Use when starting a conversation.",
                    "entrypoint": "skills/using-superpowers@agents/SKILL.md",
                    "aliases": ["using-superpowers"],
                    "has_scripts": True,
                    "has_bin": False,
                    "has_assets": False,
                }
            ],
        }

    def get_detail(self, *, skill_id: str, include_workflow: bool):
        self.detail_calls.append({"skill_id": skill_id, "include_workflow": include_workflow})
        if skill_id == "missing@agents":
            return None
        payload = dict(self._detail)
        if not include_workflow:
            payload.pop("workflow_content", None)
            payload.pop("workflow_truncated", None)
        return payload


@pytest.mark.asyncio
async def test_skill_catalog_endpoint_supports_filters_and_pagination(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skills_module, "get_skill_registry_service", lambda: fake_registry)

    response = await skills_module.get_skill_catalog(
        q="using",
        namespace="agents",
        limit=5,
        offset=2,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.total == 1
    assert response.limit == 5
    assert response.offset == 2
    assert response.items[0].skill_id == "using-superpowers@agents"
    assert fake_registry.search_calls == [
        {"query": "using", "namespace": "agents", "limit": 5, "offset": 2}
    ]


@pytest.mark.asyncio
async def test_skill_detail_endpoint_returns_workflow_content(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skills_module, "get_skill_registry_service", lambda: fake_registry)

    response = await skills_module.get_skill_detail(
        skill_id="using-superpowers@agents",
        include_workflow=True,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.skill_id == "using-superpowers@agents"
    assert response.workflow_content == "# demo workflow"
    assert response.workflow_truncated is False
    assert fake_registry.detail_calls == [
        {"skill_id": "using-superpowers@agents", "include_workflow": True}
    ]


@pytest.mark.asyncio
async def test_skill_detail_endpoint_returns_404_for_missing_skill(monkeypatch):
    fake_registry = _FakeRegistry()
    monkeypatch.setattr(skills_module, "get_skill_registry_service", lambda: fake_registry)

    with pytest.raises(HTTPException) as exc_info:
        await skills_module.get_skill_detail(
            skill_id="missing@agents",
            include_workflow=False,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert "missing@agents" in str(exc_info.value.detail)
