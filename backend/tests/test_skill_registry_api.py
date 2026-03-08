from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import skills as skills_module


@pytest.mark.asyncio
async def test_skill_catalog_endpoint_returns_scan_core_items():
    response = await skills_module.get_skill_catalog(
        q="scan",
        namespace="scan-core",
        limit=50,
        offset=0,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.total >= 1
    skill_ids = {item.skill_id for item in response.items}
    assert "smart_scan" in skill_ids or "quick_audit" in skill_ids
    assert all(item.namespace == "scan-core" for item in response.items)


@pytest.mark.asyncio
async def test_skill_detail_endpoint_returns_static_scan_core_detail():
    response = await skills_module.get_skill_detail(
        skill_id="smart_scan",
        include_workflow=True,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.skill_id == "smart_scan"
    assert response.namespace == "scan-core"
    assert response.workflow_error == "scan_core_static_catalog"
    assert response.workflow_content is None


@pytest.mark.asyncio
async def test_skill_detail_endpoint_returns_404_for_missing_skill():
    with pytest.raises(HTTPException) as exc_info:
        await skills_module.get_skill_detail(
            skill_id="missing-skill",
            include_workflow=False,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert "missing-skill" in str(exc_info.value.detail)
