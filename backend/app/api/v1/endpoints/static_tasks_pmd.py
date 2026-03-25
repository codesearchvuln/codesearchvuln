from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.v1.endpoints.static_tasks_shared import deps, get_db
from app.models.pmd import PmdRuleConfig
from app.models.user import User
from app.services.pmd_rulesets import (
    PMD_PRESET_SUMMARIES,
    PMD_RULESET_ALIASES,
    get_builtin_pmd_ruleset_detail as service_get_builtin_pmd_ruleset_detail,
    list_builtin_pmd_rulesets as service_list_builtin_pmd_rulesets,
    parse_pmd_ruleset_xml,
)

router = APIRouter()


class PmdPresetResponse(BaseModel):
    id: str
    name: str
    alias: str
    description: str
    categories: list[str] = Field(default_factory=list)


class PmdRuleDetailResponse(BaseModel):
    name: Optional[str] = None
    ref: Optional[str] = None
    language: Optional[str] = None
    message: Optional[str] = None
    class_name: Optional[str] = None
    priority: Optional[int] = None
    since: Optional[str] = None
    external_info_url: Optional[str] = None
    description: Optional[str] = None


class PmdRulesetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    filename: str
    is_active: bool
    source: str
    ruleset_name: str
    rule_count: int
    languages: list[str] = Field(default_factory=list)
    priorities: list[int] = Field(default_factory=list)
    external_info_urls: list[str] = Field(default_factory=list)
    rules: list[PmdRuleDetailResponse] = Field(default_factory=list)
    raw_xml: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PmdRuleConfigUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(extra="ignore")


def _build_pmd_preset_responses() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for preset_id, summary in PMD_PRESET_SUMMARIES.items():
        rows.append(
            {
                "id": preset_id,
                "name": summary["name"],
                "alias": summary["alias"],
                "description": summary["description"],
                "categories": list(summary.get("categories", [])),
            }
        )
    return rows


def _build_pmd_ruleset_response(
    payload: dict[str, Any],
    *,
    id: str,
    filename: str,
    source: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_active: bool,
    created_by: Optional[str] = None,
    created_at: Optional[datetime] = None,
    updated_at: Optional[datetime] = None,
) -> dict[str, Any]:
    resolved_description = description if description is not None else payload.get("description")
    return {
        "id": id,
        "name": name or payload["ruleset_name"],
        "description": resolved_description,
        "filename": filename,
        "is_active": is_active,
        "source": source,
        "ruleset_name": payload["ruleset_name"],
        "rule_count": int(payload["rule_count"]),
        "languages": list(payload.get("languages", [])),
        "priorities": list(payload.get("priorities", [])),
        "external_info_urls": list(payload.get("external_info_urls", [])),
        "rules": list(payload.get("rules", [])),
        "raw_xml": payload["raw_xml"],
        "created_by": created_by,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _build_builtin_pmd_ruleset_response(payload: dict[str, Any]) -> dict[str, Any]:
    return _build_pmd_ruleset_response(
        payload,
        id=str(payload["id"]),
        filename=str(payload.get("filename") or payload["id"]),
        source="builtin",
        is_active=True,
    )


def _build_custom_pmd_ruleset_response(row: PmdRuleConfig) -> dict[str, Any]:
    try:
        payload = parse_pmd_ruleset_xml(str(row.xml_content or ""))
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=f"PMD 自定义规则配置解析失败: {exc}") from exc

    return _build_pmd_ruleset_response(
        payload,
        id=str(row.id),
        filename=str(row.filename),
        source="custom",
        name=str(row.name),
        description=row.description,
        is_active=bool(row.is_active),
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _normalize_rule_config_name(value: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="name 不能为空")
    return normalized


def _normalize_upload_filename(filename: Optional[str]) -> str:
    normalized = str(filename or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="xml_file 文件名不能为空")
    if not normalized.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="PMD ruleset 文件必须是 .xml")
    return normalized


async def _read_xml_upload(xml_file: UploadFile) -> tuple[str, str]:
    filename = _normalize_upload_filename(xml_file.filename)
    raw_xml = (await xml_file.read()).decode("utf-8", errors="replace").strip()
    if not raw_xml:
        raise HTTPException(status_code=400, detail="xml_file 不能为空")
    return filename, raw_xml


async def _get_custom_rule_config_or_404(db: AsyncSession, rule_config_id: str) -> PmdRuleConfig:
    result = await db.execute(select(PmdRuleConfig).where(PmdRuleConfig.id == rule_config_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="PMD 自定义规则配置不存在")
    return row


@router.get("/pmd/presets", response_model=list[PmdPresetResponse])
async def list_pmd_presets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = db
    _ = current_user
    return _build_pmd_preset_responses()


@router.get("/pmd/builtin-rulesets", response_model=list[PmdRulesetResponse])
async def list_builtin_pmd_rulesets(
    keyword: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = db
    _ = current_user
    rows = service_list_builtin_pmd_rulesets(keyword=keyword, language=language, limit=limit)
    return [_build_builtin_pmd_ruleset_response(row) for row in rows]


@router.get("/pmd/builtin-rulesets/{ruleset_id}", response_model=PmdRulesetResponse)
async def get_builtin_pmd_ruleset(
    ruleset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = db
    _ = current_user
    try:
        payload = service_get_builtin_pmd_ruleset_detail(ruleset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _build_builtin_pmd_ruleset_response(payload)


@router.post("/pmd/rule-configs/import", response_model=PmdRulesetResponse)
async def import_pmd_rule_config(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    xml_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    normalized_name = _normalize_rule_config_name(name)
    filename, raw_xml = await _read_xml_upload(xml_file)

    try:
        parse_pmd_ruleset_xml(raw_xml)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row = PmdRuleConfig(
        name=normalized_name,
        description=str(description or "").strip() or None,
        filename=filename,
        xml_content=raw_xml,
        is_active=True,
        created_by=str(getattr(current_user, "id", "") or "") or None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _build_custom_pmd_ruleset_response(row)


@router.get("/pmd/rule-configs", response_model=list[PmdRulesetResponse])
async def list_pmd_rule_configs(
    is_active: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    query = select(PmdRuleConfig)
    if is_active is not None:
        query = query.where(PmdRuleConfig.is_active.is_(is_active))
    if keyword:
        normalized_keyword = f"%{str(keyword).strip()}%"
        query = query.where(
            PmdRuleConfig.name.ilike(normalized_keyword)
            | PmdRuleConfig.description.ilike(normalized_keyword)
            | PmdRuleConfig.filename.ilike(normalized_keyword)
        )
    query = query.order_by(PmdRuleConfig.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [_build_custom_pmd_ruleset_response(row) for row in result.scalars().all()]


@router.get("/pmd/rule-configs/{rule_config_id}", response_model=PmdRulesetResponse)
async def get_pmd_rule_config(
    rule_config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    row = await _get_custom_rule_config_or_404(db, rule_config_id)
    return _build_custom_pmd_ruleset_response(row)


@router.patch("/pmd/rule-configs/{rule_config_id}", response_model=PmdRulesetResponse)
async def update_pmd_rule_config(
    rule_config_id: str,
    request: PmdRuleConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    row = await _get_custom_rule_config_or_404(db, rule_config_id)

    if request.name is not None:
        row.name = _normalize_rule_config_name(request.name)
    if request.description is not None:
        row.description = str(request.description or "").strip() or None
    if request.is_active is not None:
        row.is_active = bool(request.is_active)

    await db.commit()
    await db.refresh(row)
    return _build_custom_pmd_ruleset_response(row)


@router.delete("/pmd/rule-configs/{rule_config_id}")
async def delete_pmd_rule_config(
    rule_config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    _ = current_user
    row = await _get_custom_rule_config_or_404(db, rule_config_id)
    await db.delete(row)
    await db.commit()
    return {"message": "规则配置已删除", "id": rule_config_id}
