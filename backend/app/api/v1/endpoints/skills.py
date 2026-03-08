from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api import deps
from app.models.user import User
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
