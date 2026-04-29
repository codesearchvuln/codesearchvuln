from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Integer, String, and_, case, cast, func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.static_tasks_shared import deps, get_db
from app.models.bandit import BanditFinding
from app.models.gitleaks import GitleaksFinding
from app.models.opengrep import OpengrepFinding, OpengrepRule
from app.models.phpstan import PhpstanFinding
from app.models.pmd_scan import PmdFinding
from app.models.user import User
from app.models.yasa import YasaFinding

router = APIRouter()


EngineLiteral = Literal["opengrep", "gitleaks", "bandit", "phpstan", "pmd", "yasa"]
SortByLiteral = Literal["severity", "confidence", "file_path", "line", "created_at"]
SortOrderLiteral = Literal["asc", "desc"]


class UnifiedFindingItemResponse(BaseModel):
    engine: EngineLiteral
    id: str
    task_id: str
    rule: str
    file_path: str
    line: Optional[int] = None
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    status: str


class UnifiedFindingsPageResponse(BaseModel):
    items: list[UnifiedFindingItemResponse]
    total: int
    page: int
    page_size: int


def _normalized_status(column):
    return func.lower(func.coalesce(cast(column, String), literal("open")))


def _normalized_severity(column):
    upper = func.upper(func.coalesce(cast(column, String), literal("")))
    return case(
        (upper == "CRITICAL", literal("CRITICAL")),
        (upper == "HIGH", literal("HIGH")),
        (upper.in_(["ERROR", "WARNING", "MEDIUM"]), literal("MEDIUM")),
        else_=literal("LOW"),
    )


def _normalized_confidence(column):
    upper = func.upper(func.coalesce(cast(column, String), literal("")))
    return case(
        (upper == "HIGH", literal("HIGH")),
        (upper == "LOW", literal("LOW")),
        else_=literal("MEDIUM"),
    )


def _normalize_blank(column):
    return func.nullif(func.trim(cast(column, String)), "")


def _build_bandit_rule_expr():
    test_id = func.coalesce(BanditFinding.test_id, literal(""))
    test_name = func.coalesce(BanditFinding.test_name, literal(""))
    delimiter = case(
        (
            and_(
                _normalize_blank(BanditFinding.test_id).is_not(None),
                _normalize_blank(BanditFinding.test_name).is_not(None),
            ),
            literal(" · "),
        ),
        else_=literal(""),
    )
    combined = func.trim(test_id + delimiter + test_name)
    return case((combined == "", literal("-")), else_=combined)


def _build_pmd_rule_expr():
    rule = func.coalesce(PmdFinding.rule, literal(""))
    ruleset = func.coalesce(PmdFinding.ruleset, literal(""))
    delimiter = case(
        (
            and_(
                _normalize_blank(PmdFinding.rule).is_not(None),
                _normalize_blank(PmdFinding.ruleset).is_not(None),
            ),
            literal(" · "),
        ),
        else_=literal(""),
    )
    combined = func.trim(rule + delimiter + ruleset)
    return case(
        (combined == "", func.coalesce(_normalize_blank(PmdFinding.message), literal("-"))),
        else_=combined,
    )


def _build_opengrep_confidence_expr():
    rule_lookup_key = _build_opengrep_check_id_expr()
    mapped_confidence = (
        select(OpengrepRule.confidence)
        .where(OpengrepRule.name == rule_lookup_key)
        .limit(1)
        .scalar_subquery()
    )
    # Prefer confidence in finding payload; fallback to MEDIUM for unknown/missing values.
    confidence = func.upper(
        func.coalesce(
            cast(OpengrepFinding.rule["confidence"].as_string(), String),
            cast(OpengrepFinding.rule["extra"]["confidence"].as_string(), String),
            cast(OpengrepFinding.rule["metadata"]["confidence"].as_string(), String),
            cast(
                OpengrepFinding.rule["extra"]["metadata"]["confidence"].as_string(),
                String,
            ),
            cast(mapped_confidence, String),
            literal("MEDIUM"),
        )
    )
    return case(
        (confidence == "HIGH", literal("HIGH")),
        (confidence == "LOW", literal("LOW")),
        else_=literal("MEDIUM"),
    )


def _build_opengrep_check_id_expr():
    check_id = cast(OpengrepFinding.rule["check_id"].as_string(), String)
    legacy_id = cast(OpengrepFinding.rule["id"].as_string(), String)
    return func.coalesce(_normalize_blank(check_id), _normalize_blank(legacy_id))


def _build_opengrep_rule_expr():
    return func.coalesce(_build_opengrep_check_id_expr(), literal("-"))


def _build_unified_union_subquery(
    *,
    opengrep_task_id: Optional[str],
    gitleaks_task_id: Optional[str],
    bandit_task_id: Optional[str],
    phpstan_task_id: Optional[str],
    yasa_task_id: Optional[str],
    pmd_task_id: Optional[str],
):
    statements = []

    if opengrep_task_id:
        statements.append(
            select(
                literal("opengrep").label("engine"),
                cast(OpengrepFinding.id, String).label("id"),
                cast(OpengrepFinding.scan_task_id, String).label("task_id"),
                _build_opengrep_rule_expr().label("rule"),
                cast(OpengrepFinding.file_path, String).label("file_path"),
                cast(OpengrepFinding.start_line, Integer).label("line"),
                _normalized_severity(OpengrepFinding.severity).label("severity"),
                _build_opengrep_confidence_expr().label("confidence"),
                _normalized_status(OpengrepFinding.status).label("status"),
                literal(None).label("created_at"),
            ).where(OpengrepFinding.scan_task_id == opengrep_task_id)
        )

    if gitleaks_task_id:
        statements.append(
            select(
                literal("gitleaks").label("engine"),
                cast(GitleaksFinding.id, String).label("id"),
                cast(GitleaksFinding.scan_task_id, String).label("task_id"),
                func.coalesce(_normalize_blank(GitleaksFinding.rule_id), literal("-")).label("rule"),
                cast(GitleaksFinding.file_path, String).label("file_path"),
                cast(GitleaksFinding.start_line, Integer).label("line"),
                literal("LOW").label("severity"),
                literal("MEDIUM").label("confidence"),
                _normalized_status(GitleaksFinding.status).label("status"),
                GitleaksFinding.created_at.label("created_at"),
            ).where(GitleaksFinding.scan_task_id == gitleaks_task_id)
        )

    if bandit_task_id:
        statements.append(
            select(
                literal("bandit").label("engine"),
                cast(BanditFinding.id, String).label("id"),
                cast(BanditFinding.scan_task_id, String).label("task_id"),
                _build_bandit_rule_expr().label("rule"),
                cast(BanditFinding.file_path, String).label("file_path"),
                cast(BanditFinding.line_number, Integer).label("line"),
                _normalized_severity(BanditFinding.issue_severity).label("severity"),
                _normalized_confidence(BanditFinding.issue_confidence).label("confidence"),
                _normalized_status(BanditFinding.status).label("status"),
                BanditFinding.created_at.label("created_at"),
            ).where(BanditFinding.scan_task_id == bandit_task_id)
        )

    if phpstan_task_id:
        statements.append(
            select(
                literal("phpstan").label("engine"),
                cast(PhpstanFinding.id, String).label("id"),
                cast(PhpstanFinding.scan_task_id, String).label("task_id"),
                func.coalesce(
                    _normalize_blank(PhpstanFinding.identifier),
                    _normalize_blank(PhpstanFinding.message),
                    literal("-"),
                ).label("rule"),
                cast(PhpstanFinding.file_path, String).label("file_path"),
                cast(PhpstanFinding.line, Integer).label("line"),
                literal("LOW").label("severity"),
                literal("MEDIUM").label("confidence"),
                _normalized_status(PhpstanFinding.status).label("status"),
                PhpstanFinding.created_at.label("created_at"),
            ).where(PhpstanFinding.scan_task_id == phpstan_task_id)
        )

    if pmd_task_id:
        priority = cast(PmdFinding.priority, Integer)
        pmd_severity = case(
            (and_(priority.is_not(None), priority <= 2), literal("HIGH")),
            (priority == 3, literal("MEDIUM")),
            else_=literal("LOW"),
        )
        statements.append(
            select(
                literal("pmd").label("engine"),
                cast(PmdFinding.id, String).label("id"),
                cast(PmdFinding.scan_task_id, String).label("task_id"),
                _build_pmd_rule_expr().label("rule"),
                cast(PmdFinding.file_path, String).label("file_path"),
                cast(PmdFinding.begin_line, Integer).label("line"),
                pmd_severity.label("severity"),
                literal("MEDIUM").label("confidence"),
                _normalized_status(PmdFinding.status).label("status"),
                PmdFinding.created_at.label("created_at"),
            ).where(PmdFinding.scan_task_id == pmd_task_id)
        )

    if yasa_task_id:
        yasa_level = func.lower(func.coalesce(cast(YasaFinding.level, String), literal("warning")))
        yasa_severity = case(
            (yasa_level == "error", literal("MEDIUM")),
            else_=literal("LOW"),
        )
        statements.append(
            select(
                literal("yasa").label("engine"),
                cast(YasaFinding.id, String).label("id"),
                cast(YasaFinding.scan_task_id, String).label("task_id"),
                func.coalesce(
                    _normalize_blank(YasaFinding.rule_id),
                    _normalize_blank(YasaFinding.rule_name),
                    _normalize_blank(YasaFinding.message),
                    literal("-"),
                ).label("rule"),
                cast(YasaFinding.file_path, String).label("file_path"),
                cast(YasaFinding.start_line, Integer).label("line"),
                yasa_severity.label("severity"),
                literal("MEDIUM").label("confidence"),
                _normalized_status(YasaFinding.status).label("status"),
                YasaFinding.created_at.label("created_at"),
            ).where(YasaFinding.scan_task_id == yasa_task_id)
        )

    if not statements:
        return None

    return union_all(*statements).subquery("unified_findings")


def _build_sort_expressions(unified_subquery, sort_by: SortByLiteral, sort_order: SortOrderLiteral):
    severity_rank = case(
        (unified_subquery.c.severity == "CRITICAL", 4),
        (unified_subquery.c.severity == "HIGH", 3),
        (unified_subquery.c.severity == "MEDIUM", 2),
        else_=1,
    )
    confidence_rank = case(
        (unified_subquery.c.confidence == "HIGH", 3),
        (unified_subquery.c.confidence == "MEDIUM", 2),
        else_=1,
    )
    line_nulls_last = case((unified_subquery.c.line.is_(None), 1), else_=0)

    def _line_order(desc: bool):
        return [
            line_nulls_last.asc(),
            unified_subquery.c.line.desc() if desc else unified_subquery.c.line.asc(),
        ]

    order_by = []
    descending = sort_order == "desc"

    if sort_by == "severity":
        order_by.append(severity_rank.desc() if descending else severity_rank.asc())
    elif sort_by == "confidence":
        order_by.append(confidence_rank.desc() if descending else confidence_rank.asc())
    elif sort_by == "file_path":
        order_by.append(
            func.lower(unified_subquery.c.file_path).desc()
            if descending
            else func.lower(unified_subquery.c.file_path).asc()
        )
    elif sort_by == "line":
        order_by.extend(_line_order(descending))
    elif sort_by == "created_at":
        order_by.append(
            unified_subquery.c.created_at.desc()
            if descending
            else unified_subquery.c.created_at.asc()
        )

    if sort_by != "severity":
        order_by.append(severity_rank.desc())
    if sort_by != "confidence":
        order_by.append(confidence_rank.desc())
    if sort_by != "file_path":
        order_by.append(func.lower(unified_subquery.c.file_path).asc())
    if sort_by != "line":
        order_by.extend(_line_order(False))

    order_by.append(unified_subquery.c.id.asc())
    return order_by


@router.get("/findings/unified", response_model=UnifiedFindingsPageResponse)
async def list_unified_findings(
    opengrep_task_id: Optional[str] = Query(None),
    gitleaks_task_id: Optional[str] = Query(None),
    bandit_task_id: Optional[str] = Query(None),
    phpstan_task_id: Optional[str] = Query(None),
    yasa_task_id: Optional[str] = Query(None),
    pmd_task_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    engine: Optional[EngineLiteral] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    confidence: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    sort_by: SortByLiteral = Query("severity"),
    sort_order: SortOrderLiteral = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    del current_user

    unified_subquery = _build_unified_union_subquery(
        opengrep_task_id=opengrep_task_id,
        gitleaks_task_id=gitleaks_task_id,
        bandit_task_id=bandit_task_id,
        phpstan_task_id=phpstan_task_id,
        yasa_task_id=yasa_task_id,
        pmd_task_id=pmd_task_id,
    )
    if unified_subquery is None:
        raise HTTPException(status_code=400, detail="至少提供一个引擎 task_id")

    filtered_stmt = select(unified_subquery)

    if engine:
        filtered_stmt = filtered_stmt.where(unified_subquery.c.engine == engine)

    if status:
        normalized_status = str(status).strip().lower()
        if normalized_status not in {"open", "verified", "false_positive"}:
            raise HTTPException(status_code=400, detail="status 必须为 open/verified/false_positive")
        filtered_stmt = filtered_stmt.where(unified_subquery.c.status == normalized_status)

    if severity:
        normalized_severity = str(severity).strip().upper()
        if normalized_severity not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
            raise HTTPException(status_code=400, detail="severity 必须为 CRITICAL/HIGH/MEDIUM/LOW")
        filtered_stmt = filtered_stmt.where(unified_subquery.c.severity == normalized_severity)

    if confidence:
        normalized_confidence = str(confidence).strip().upper()
        if normalized_confidence not in {"HIGH", "MEDIUM", "LOW"}:
            raise HTTPException(status_code=400, detail="confidence 必须为 HIGH/MEDIUM/LOW")
        filtered_stmt = filtered_stmt.where(unified_subquery.c.confidence == normalized_confidence)

    if keyword:
        normalized_keyword = str(keyword).strip().lower()
        if normalized_keyword:
            like_pattern = f"%{normalized_keyword}%"
            filtered_stmt = filtered_stmt.where(
                or_(
                    func.lower(unified_subquery.c.rule).like(like_pattern),
                    func.lower(unified_subquery.c.file_path).like(like_pattern),
                )
            )

    filtered_subquery = filtered_stmt.subquery("filtered_unified_findings")
    count_stmt = select(func.count()).select_from(filtered_subquery)
    total_result = await db.execute(count_stmt)
    total = int(total_result.scalar() or 0)

    offset = (page - 1) * page_size
    paged_stmt = (
        select(filtered_subquery)
        .order_by(*_build_sort_expressions(filtered_subquery, sort_by, sort_order))
        .offset(offset)
        .limit(page_size)
    )
    rows_result = await db.execute(paged_stmt)
    rows = rows_result.mappings().all()

    items = [
        UnifiedFindingItemResponse(
            engine=str(row["engine"]),
            id=str(row["id"]),
            task_id=str(row["task_id"]),
            rule=str(row["rule"] or "-"),
            file_path=str(row["file_path"] or "-"),
            line=int(row["line"]) if row["line"] is not None else None,
            severity=str(row["severity"]),
            confidence=str(row["confidence"]),
            status=str(row["status"] or "open").lower(),
        )
        for row in rows
    ]

    return UnifiedFindingsPageResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
