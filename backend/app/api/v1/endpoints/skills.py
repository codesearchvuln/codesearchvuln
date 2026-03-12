from __future__ import annotations

from typing import List, Literal, Optional

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.v1.endpoints.agent_test import (
    QueueEventEmitter,
    _get_user_config,
    _init_llm_service,
    _run_agent_streaming,
)
from app.db.session import get_db
from app.models.user import User
from app.services.agent.skill_test_runner import SkillTestRunner
from app.services.agent.skills.scan_core import (
    get_scan_core_skill_detail,
    search_scan_core_skills,
)


router = APIRouter()


class SkillCatalogItem(BaseModel):
    skill_id: str
    name: str
    namespace: str
    summary: str
    entrypoint: str
    aliases: List[str] = Field(default_factory=list)
    has_scripts: bool = False
    has_bin: bool = False
    has_assets: bool = False


class SkillCatalogResponse(BaseModel):
    enabled: bool = True
    total: int = 0
    limit: int = 20
    offset: int = 0
    items: List[SkillCatalogItem] = Field(default_factory=list)
    error: Optional[str] = None


class SkillDetailResponse(BaseModel):
    enabled: bool = True
    skill_id: str
    name: str
    namespace: str
    summary: str
    entrypoint: str
    mirror_dir: str = ""
    source_root: str = ""
    source_dir: str = ""
    source_skill_md: str = ""
    aliases: List[str] = Field(default_factory=list)
    has_scripts: bool = False
    has_bin: bool = False
    has_assets: bool = False
    files_count: int = 0
    workflow_content: Optional[str] = None
    workflow_truncated: Optional[bool] = None
    workflow_error: Optional[str] = None
    test_supported: bool = False
    test_mode: Literal["single_skill_strict", "disabled"] = "disabled"
    test_reason: Optional[str] = None
    default_test_project_name: Literal["libplist"] = "libplist"


class SkillTestRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000, description="自然语言测试输入")
    max_iterations: int = Field(default=4, ge=1, le=20)


@router.get("/catalog", response_model=SkillCatalogResponse)
async def get_skill_catalog(
    q: str = Query(default="", description="Keyword query for skill search."),
    namespace: Optional[str] = Query(default=None, description="Filter by namespace."),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(deps.get_current_user),
) -> SkillCatalogResponse:
    _ = current_user
    payload = search_scan_core_skills(query=q, namespace=namespace, limit=limit, offset=offset)
    return SkillCatalogResponse(**payload)


@router.get("/{skill_id}", response_model=SkillDetailResponse)
async def get_skill_detail(
    skill_id: str,
    include_workflow: bool = Query(default=False, description="Include SKILL.md workflow content."),
    current_user: User = Depends(deps.get_current_user),
) -> SkillDetailResponse:
    _ = current_user
    _ = include_workflow
    detail = get_scan_core_skill_detail(skill_id=skill_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    payload = dict(detail)
    payload["enabled"] = True
    return SkillDetailResponse(**payload)


@router.post("/{skill_id}/test")
async def run_skill_test(
    skill_id: str,
    request: SkillTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    detail = get_scan_core_skill_detail(skill_id=skill_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    if not bool(detail.get("test_supported")):
        raise HTTPException(status_code=400, detail=str(detail.get("test_reason") or "当前 skill 暂不支持测试"))

    user_config = await _get_user_config(db, str(current_user.id))
    llm_service = await _init_llm_service(user_config)
    queue: asyncio.Queue = asyncio.Queue()
    emitter = QueueEventEmitter(queue)
    runner = SkillTestRunner(
        skill_id=skill_id,
        prompt=request.prompt,
        max_iterations=request.max_iterations,
        llm_service=llm_service,
        db=db,
        current_user=current_user,
        event_emitter=emitter,
    )

    return StreamingResponse(
        _run_agent_streaming(runner.run(), queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
