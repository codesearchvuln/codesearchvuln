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
async def test_skill_detail_endpoint_exposes_supported_test_metadata():
    response = await skills_module.get_skill_detail(
        skill_id="get_code_window",
        include_workflow=False,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.test_supported is True
    assert response.test_mode == "single_skill_strict"
    assert response.test_reason in (None, "")
    assert response.default_test_project_name == "libplist"


@pytest.mark.asyncio
async def test_skill_detail_endpoint_exposes_disabled_test_metadata():
    response = await skills_module.get_skill_detail(
        skill_id="dataflow_analysis",
        include_workflow=False,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.test_supported is True
    assert response.test_mode == "structured_tool"
    assert response.default_test_project_name == "libplist"
    assert response.test_reason in (None, "")
    assert response.tool_test_preset is not None
    assert response.tool_test_preset.project_name == "libplist"
    assert response.tool_test_preset.file_path == "src/xplist.c"
    assert response.tool_test_preset.function_name == "plist_from_xml"
    assert response.tool_test_preset.tool_input["variable_name"] == "plist_xml"


@pytest.mark.asyncio
async def test_skill_detail_endpoint_exposes_controlflow_structured_test_metadata():
    response = await skills_module.get_skill_detail(
        skill_id="controlflow_analysis_light",
        include_workflow=False,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.test_supported is True
    assert response.test_mode == "structured_tool"
    assert response.test_reason in (None, "")
    assert response.tool_test_preset is not None
    assert response.tool_test_preset.project_name == "libplist"
    assert response.tool_test_preset.file_path == "src/xplist.c"
    assert response.tool_test_preset.function_name == "plist_from_xml"
    assert response.tool_test_preset.tool_input["vulnerability_type"] == "xxe"


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
