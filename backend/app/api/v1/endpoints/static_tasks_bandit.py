import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError, ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.bandit import BanditFinding, BanditScanTask
from app.db.static_finding_paths import normalize_static_scan_file_path
from app.models.gitleaks import GitleaksFinding, GitleaksRule, GitleaksScanTask
from app.models.opengrep import OpengrepFinding, OpengrepRule, OpengrepScanTask
from app.models.phpstan import PhpstanFinding, PhpstanScanTask
from app.models.project import Project
from app.models.user import User
from app.schemas.gitleaks_rules import (
    GitleaksRuleBatchUpdateRequest,
    GitleaksRuleCreateRequest,
    GitleaksRuleResponse,
    GitleaksRuleUpdateRequest,
)
from app.schemas.opengrep import (
    OpengrepRuleCreateRequest,
    OpengrepRulePatchResponse,
    OpengrepRuleTextCreateRequest,
    OpengrepRuleTextResponse,
    OpengrepRuleUpdateRequest,
)
from app.services.gitleaks_rules_seed import ensure_builtin_gitleaks_rules
from app.services.llm_rule.repo_cache_manager import GlobalRepoCacheManager
from app.services.opengrep_confidence import (
    count_high_confidence_findings_by_task_ids as shared_count_high_confidence_findings_by_task_ids,
    extract_finding_payload_confidence as shared_extract_finding_payload_confidence,
    extract_rule_lookup_keys as shared_extract_rule_lookup_keys,
    normalize_confidence as shared_normalize_confidence,
)
from app.services.rule import get_rule_by_patch, validate_generic_rule
from app.services.upload.upload_manager import UploadManager

from app.api.v1.endpoints.static_tasks_shared import (
    _cleanup_incorrect_rules,
    _clear_scan_task_cancel,
    _dt_to_iso,
    _ensure_opengrep_xdg_dirs,
    _get_project_root,
    _get_user_config,
    _is_scan_task_cancelled,
    _is_test_like_directory,
    _normalize_llm_config_error_message,
    _record_scan_progress,
    _request_scan_task_cancel,
    _run_subprocess_with_tracking,
    _sync_task_scan_duration,
    _utc_now_iso,
    _validate_user_llm_config,
    async_session_factory,
    deps,
    get_db,
    logger,
    settings,
)

router = APIRouter()

class BanditScanTaskCreate(BaseModel):
    """创建 Bandit 扫描任务请求"""

    project_id: str = Field(..., description="项目ID")
    name: Optional[str] = Field(None, description="任务名称")
    target_path: str = Field(".", description="扫描目标路径，相对于项目根目录")
    severity_level: str = Field("medium", description="最低严重程度: low, medium, high")
    confidence_level: str = Field("medium", description="最低置信度: low, medium, high")


class BanditScanTaskResponse(BaseModel):
    """Bandit 扫描任务响应"""

    id: str
    project_id: str
    name: str
    status: str
    target_path: str
    severity_level: str
    confidence_level: str
    total_findings: int
    high_count: int
    medium_count: int
    low_count: int
    scan_duration_ms: int
    files_scanned: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BanditFindingResponse(BaseModel):
    """Bandit 扫描发现响应"""

    id: str
    scan_task_id: str
    test_id: str
    test_name: str
    issue_severity: str
    issue_confidence: str
    file_path: str
    line_number: Optional[int]
    code_snippet: Optional[str]
    issue_text: Optional[str]
    more_info: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)
def _normalize_bandit_level(value: Any, *, fallback: str = "medium") -> str:
    """规范化 bandit 等级参数，统一为 low/medium/high。"""
    normalized = str(value or "").strip().lower()
    if normalized in {"low", "medium", "high"}:
        return normalized
    return fallback


def _parse_bandit_output_payload(payload: Any) -> List[Dict[str, Any]]:
    """解析 Bandit JSON 输出并统一返回 issue 列表。"""
    if payload is None:
        return []
    if isinstance(payload, dict):
        results = payload.get("results")
        if isinstance(results, list):
            return [item for item in results if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    raise ValueError("Unexpected bandit output type")
# Bandit integration: 后台执行 Bandit 扫描任务并持久化结果。
async def _execute_bandit_scan(
    task_id: str,
    project_root: str,
    target_path: str,
    severity_level: str = "medium",
    confidence_level: str = "medium",
) -> None:
    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(BanditScanTask).where(BanditScanTask.id == task_id)
            )
            task = result.scalar_one_or_none()
            if not task:
                logger.error(f"Bandit task {task_id} not found")
                return

            if _is_scan_task_cancelled("bandit", task_id) or task.status == "interrupted":
                task.status = "interrupted"
                if not task.error_message:
                    task.error_message = "扫描任务已中止（用户操作）"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            task.status = "running"
            await db.commit()

            full_target_path = os.path.join(project_root, target_path)
            if not os.path.exists(full_target_path):
                task.status = "failed"
                task.error_message = f"Target path {full_target_path} not found"
                _sync_task_scan_duration(task)
                await db.commit()
                logger.error(f"Bandit target path not found: {full_target_path}")
                return

            normalized_severity = _normalize_bandit_level(severity_level, fallback="medium")
            normalized_confidence = _normalize_bandit_level(
                confidence_level, fallback="medium"
            )

            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
                report_file = tf.name

            try:
                cmd = [
                    "bandit",
                    "-r",
                    full_target_path,
                    "-f",
                    "json",
                    "-o",
                    report_file,
                    "--severity-level",
                    normalized_severity,
                    "--confidence-level",
                    normalized_confidence,
                    "-q",
                ]

                logger.info(f"Executing bandit for task {task_id}: {' '.join(cmd)}")
                loop = asyncio.get_event_loop()
                process_result = await loop.run_in_executor(
                    None,
                    lambda: _run_subprocess_with_tracking(
                        "bandit",
                        task_id,
                        cmd,
                        timeout=600,
                    ),
                )

                if _is_scan_task_cancelled("bandit", task_id):
                    task.status = "interrupted"
                    if not task.error_message:
                        task.error_message = "扫描任务已中止（用户操作）"
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return

                if process_result.returncode > 1:
                    error_msg = process_result.stderr or process_result.stdout or "Unknown error"
                    task.status = "failed"
                    task.error_message = str(error_msg)[:500]
                    _sync_task_scan_duration(task)
                    await db.commit()
                    logger.error(f"Bandit task {task_id} failed: {error_msg}")
                    return

                raw_payload: Any = {}
                if os.path.exists(report_file):
                    with open(report_file, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read().strip()
                    if content:
                        try:
                            raw_payload = json.loads(content)
                        except json.JSONDecodeError as exc:
                            task.status = "failed"
                            task.error_message = f"Failed to parse Bandit JSON output: {exc}"
                            _sync_task_scan_duration(task)
                            await db.commit()
                            logger.error(
                                f"Failed to parse Bandit output for task {task_id}: {exc}"
                            )
                            return

                findings = _parse_bandit_output_payload(raw_payload)
                high_count = 0
                medium_count = 0
                low_count = 0
                scanned_files: set[str] = set()

                for finding in findings:
                    try:
                        severity = str(finding.get("issue_severity") or "LOW").strip().upper()
                        confidence = str(finding.get("issue_confidence") or "LOW").strip().upper()
                        file_path = normalize_static_scan_file_path(
                            str(finding.get("filename") or "").strip(),
                            project_root,
                        )
                        if file_path:
                            scanned_files.add(file_path)

                        if severity == "HIGH":
                            high_count += 1
                        elif severity == "MEDIUM":
                            medium_count += 1
                        else:
                            low_count += 1

                        bandit_finding = BanditFinding(
                            scan_task_id=task_id,
                            test_id=str(finding.get("test_id") or "unknown"),
                            test_name=str(finding.get("test_name") or "unknown"),
                            issue_severity=severity if severity in {"HIGH", "MEDIUM", "LOW"} else "LOW",
                            issue_confidence=(
                                confidence if confidence in {"HIGH", "MEDIUM", "LOW"} else "LOW"
                            ),
                            file_path=file_path or "",
                            line_number=finding.get("line_number"),
                            code_snippet=str(finding.get("code") or "")[:2000] or None,
                            issue_text=str(finding.get("issue_text") or "")[:4000] or None,
                            more_info=str(finding.get("more_info") or "")[:1000] or None,
                            status="open",
                        )
                        db.add(bandit_finding)
                    except Exception as exc:
                        logger.error(f"Error processing Bandit finding for task {task_id}: {exc}")

                if _is_scan_task_cancelled("bandit", task_id):
                    task.status = "interrupted"
                    if not task.error_message:
                        task.error_message = "扫描任务已中止（用户操作）"
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return

                task.status = "completed"
                task.severity_level = normalized_severity
                task.confidence_level = normalized_confidence
                task.total_findings = len(findings)
                task.high_count = high_count
                task.medium_count = medium_count
                task.low_count = low_count
                task.files_scanned = len(scanned_files)
                _sync_task_scan_duration(task)
                await db.commit()
            finally:
                try:
                    if os.path.exists(report_file):
                        os.unlink(report_file)
                except Exception as exc:
                    logger.warning(f"Failed to delete temporary Bandit report file: {exc}")
        except asyncio.CancelledError:
            logger.warning(f"Bandit task {task_id} interrupted by service shutdown")
            try:
                await db.rollback()
                result = await db.execute(
                    select(BanditScanTask).where(BanditScanTask.id == task_id)
                )
                task = result.scalar_one_or_none()
                if task and task.status in {"pending", "running"}:
                    task.status = "interrupted"
                    if not task.error_message:
                        task.error_message = "扫描任务因服务中断被标记为中止"
                    _sync_task_scan_duration(task)
                    await db.commit()
            except Exception as commit_error:
                logger.error(
                    f"Failed to update Bandit interrupted task status: {commit_error}"
                )
        except Exception as exc:
            logger.error(f"Error executing Bandit task {task_id}: {exc}")
            try:
                await db.rollback()
                result = await db.execute(
                    select(BanditScanTask).where(BanditScanTask.id == task_id)
                )
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error_message = str(exc)[:500]
                    _sync_task_scan_duration(task)
                    await db.commit()
            except Exception as rollback_error:
                logger.error(
                    f"Failed to rollback/update failed Bandit task {task_id}: {rollback_error}"
                )
        finally:
            _clear_scan_task_cancel("bandit", task_id)


@router.post("/bandit/scan", response_model=BanditScanTaskResponse)
async def create_bandit_scan(
    request: BanditScanTaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """创建 Bandit 静态扫描任务。"""
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_root = await _get_project_root(request.project_id)
    if not project_root:
        raise HTTPException(
            status_code=400,
            detail="找不到项目的 zip 文件，请先上传项目 ZIP 文件到 uploads/zip_files 目录",
        )

    scan_task = BanditScanTask(
        project_id=request.project_id,
        name=request.name or f"Bandit_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        status="pending",
        target_path=request.target_path,
        severity_level=_normalize_bandit_level(request.severity_level),
        confidence_level=_normalize_bandit_level(request.confidence_level),
    )
    db.add(scan_task)
    await db.commit()
    await db.refresh(scan_task)

    background_tasks.add_task(
        _execute_bandit_scan,
        scan_task.id,
        project_root,
        request.target_path,
        scan_task.severity_level,
        scan_task.confidence_level,
    )
    return scan_task


@router.get("/bandit/tasks", response_model=List[BanditScanTaskResponse])
async def list_bandit_tasks(
    project_id: Optional[str] = Query(None, description="按项目ID过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 Bandit 扫描任务列表。"""
    query = select(BanditScanTask)
    if project_id:
        query = query.where(BanditScanTask.project_id == project_id)
    query = query.order_by(BanditScanTask.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/bandit/tasks/{task_id}", response_model=BanditScanTaskResponse)
async def get_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 Bandit 扫描任务详情。"""
    result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/bandit/tasks/{task_id}/interrupt")
async def interrupt_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """中止运行中的 Bandit 扫描任务。"""
    result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in {"completed", "failed", "interrupted"}:
        return {
            "message": f"任务当前状态为 {task.status}，无需中止",
            "task_id": task_id,
            "status": task.status,
        }

    _request_scan_task_cancel("bandit", task_id)
    task.status = "interrupted"
    if not task.error_message:
        task.error_message = "扫描任务已中止（用户操作）"
    _sync_task_scan_duration(task)
    await db.commit()
    return {"message": "任务已中止", "task_id": task_id, "status": "interrupted"}


@router.delete("/bandit/tasks/{task_id}")
async def delete_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """删除 Bandit 扫描任务及其发现。"""
    result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    await db.delete(task)
    await db.commit()
    return {"message": "任务已删除", "task_id": task_id}


@router.get("/bandit/tasks/{task_id}/findings", response_model=List[BanditFindingResponse])
async def get_bandit_findings(
    task_id: str,
    status: Optional[str] = Query(None, description="按状态过滤"),
    severity: Optional[str] = Query(None, description="按严重度过滤: HIGH, MEDIUM, LOW"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 Bandit 扫描发现列表。"""
    task_result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    query = select(BanditFinding).where(BanditFinding.scan_task_id == task_id)
    if status:
        query = query.where(BanditFinding.status == status)
    if severity:
        normalized_severity = str(severity).strip().upper()
        if normalized_severity in {"HIGH", "MEDIUM", "LOW"}:
            query = query.where(BanditFinding.issue_severity == normalized_severity)
    query = query.order_by(BanditFinding.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get(
    "/bandit/tasks/{task_id}/findings/{finding_id}",
    response_model=BanditFindingResponse,
)
async def get_bandit_finding(
    task_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取单条 Bandit 扫描发现详情。"""
    task_result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    finding_result = await db.execute(
        select(BanditFinding).where(
            (BanditFinding.id == finding_id) & (BanditFinding.scan_task_id == task_id)
        )
    )
    finding = finding_result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="Bandit 漏洞不存在")
    return finding


@router.post("/bandit/findings/{finding_id}/status")
async def update_bandit_finding_status(
    finding_id: str,
    status: str = Query(..., description="状态: open, verified, false_positive, fixed"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """更新 Bandit 扫描发现状态。"""
    normalized_status = str(status or "").strip().lower()
    if normalized_status not in {"open", "verified", "false_positive", "fixed"}:
        raise HTTPException(status_code=400, detail="status 必须为 open/verified/false_positive/fixed")

    result = await db.execute(select(BanditFinding).where(BanditFinding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="Bandit 漏洞不存在")

    finding.status = normalized_status
    await db.commit()
    return {"message": "状态已更新", "finding_id": finding_id, "status": normalized_status}
