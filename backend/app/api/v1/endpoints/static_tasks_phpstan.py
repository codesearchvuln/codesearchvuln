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

class PhpstanScanTaskCreate(BaseModel):
    """创建 PHPStan 扫描任务请求"""

    project_id: str = Field(..., description="项目ID")
    name: Optional[str] = Field(None, description="任务名称")
    target_path: str = Field(".", description="扫描目标路径，相对于项目根目录")
    level: int = Field(5, ge=0, le=9, description="PHPStan 分析级别（0-9）")


class PhpstanScanTaskResponse(BaseModel):
    """PHPStan 扫描任务响应"""

    id: str
    project_id: str
    name: str
    status: str
    target_path: str
    level: int
    total_findings: int
    scan_duration_ms: int
    files_scanned: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PhpstanFindingResponse(BaseModel):
    """PHPStan 扫描发现响应"""

    id: str
    scan_task_id: str
    file_path: str
    line: Optional[int]
    message: str
    identifier: Optional[str]
    tip: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)
def _normalize_phpstan_level(value: Any, *, fallback: int = 5) -> int:
    """规范化 PHPStan level 参数，统一为 0-9。"""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(0, min(9, parsed))


def _parse_phpstan_output_payload(payload_text: str) -> Dict[str, Any]:
    """解析 PHPStan JSON 输出，容忍前缀噪声并返回统一 dict。"""
    text = str(payload_text or "").strip()
    if not text:
        return {}

    parse_targets = [text]
    first_json_match = re.search(r"[{\[]", text)
    if first_json_match and first_json_match.start() > 0:
        parse_targets.append(text[first_json_match.start() :])

    last_error: Optional[Exception] = None
    for candidate in parse_targets:
        try:
            output = json.loads(candidate)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue
        if isinstance(output, dict):
            return output
        raise ValueError("Unexpected phpstan output type")

    raise ValueError(f"Invalid phpstan JSON output: {last_error}")
async def _execute_phpstan_scan(
    task_id: str,
    project_root: str,
    target_path: str,
    level: int = 5,
) -> None:
    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(PhpstanScanTask).where(PhpstanScanTask.id == task_id)
            )
            task = result.scalar_one_or_none()
            if not task:
                logger.error(f"PHPStan task {task_id} not found")
                return

            if _is_scan_task_cancelled("phpstan", task_id) or task.status == "interrupted":
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
                logger.error(f"PHPStan target path not found: {full_target_path}")
                return

            normalized_level = _normalize_phpstan_level(level)
            cmd = [
                "phpstan",
                "analyse",
                full_target_path,
                "--error-format=json",
                "--no-progress",
                "--no-interaction",
                f"--level={normalized_level}",
            ]
            logger.info(f"Executing phpstan for task {task_id}: {' '.join(cmd)}")

            loop = asyncio.get_event_loop()
            process_result = await loop.run_in_executor(
                None,
                lambda: _run_subprocess_with_tracking(
                    "phpstan",
                    task_id,
                    cmd,
                    timeout=600,
                ),
            )

            if _is_scan_task_cancelled("phpstan", task_id):
                task.status = "interrupted"
                if not task.error_message:
                    task.error_message = "扫描任务已中止（用户操作）"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            stdout_text = process_result.stdout or ""
            stderr_text = process_result.stderr or ""
            if process_result.returncode > 1:
                task.status = "failed"
                task.error_message = (stderr_text or stdout_text or "Unknown error")[:500]
                _sync_task_scan_duration(task)
                await db.commit()
                logger.error(
                    f"PHPStan task {task_id} failed: {task.error_message}"
                )
                return

            payload: Dict[str, Any] = {}
            parse_error: Optional[Exception] = None
            try:
                payload = _parse_phpstan_output_payload(stdout_text)
            except Exception as exc:  # noqa: BLE001
                parse_error = exc
                # 部分运行时可能将输出写到 stderr，回退尝试一次。
                try:
                    payload = _parse_phpstan_output_payload(stderr_text)
                    parse_error = None
                except Exception:  # noqa: BLE001
                    payload = {}

            if parse_error is not None and process_result.returncode in {0, 1}:
                task.status = "failed"
                task.error_message = f"Failed to parse PHPStan JSON output: {parse_error}"[:500]
                _sync_task_scan_duration(task)
                await db.commit()
                logger.error(f"Failed to parse phpstan output for task {task_id}: {parse_error}")
                return

            files_payload = payload.get("files")
            files_map: Dict[str, Any] = files_payload if isinstance(files_payload, dict) else {}

            finding_count = 0
            for file_path, file_data in files_map.items():
                if not isinstance(file_data, dict):
                    continue
                messages = file_data.get("messages")
                if not isinstance(messages, list):
                    continue
                for msg in messages:
                    if not isinstance(msg, dict):
                        continue
                    finding = PhpstanFinding(
                        scan_task_id=task_id,
                        file_path=str(file_path or "")[:1000],
                        line=msg.get("line"),
                        message=str(msg.get("message") or "")[:4000],
                        identifier=(str(msg.get("identifier") or "")[:500] or None),
                        tip=(str(msg.get("tip") or "")[:2000] or None),
                        status="open",
                    )
                    db.add(finding)
                    finding_count += 1

            if _is_scan_task_cancelled("phpstan", task_id):
                task.status = "interrupted"
                if not task.error_message:
                    task.error_message = "扫描任务已中止（用户操作）"
                _sync_task_scan_duration(task)
                await db.commit()
                return

            task.status = "completed"
            task.level = normalized_level
            task.total_findings = finding_count
            task.files_scanned = len(files_map)
            _sync_task_scan_duration(task)
            await db.commit()
        except asyncio.CancelledError:
            logger.warning(f"PHPStan task {task_id} interrupted by service shutdown")
            try:
                await db.rollback()
                result = await db.execute(
                    select(PhpstanScanTask).where(PhpstanScanTask.id == task_id)
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
                    f"Failed to update PHPStan interrupted task status: {commit_error}"
                )
        except Exception as exc:
            logger.error(f"Error executing PHPStan task {task_id}: {exc}")
            try:
                await db.rollback()
                result = await db.execute(
                    select(PhpstanScanTask).where(PhpstanScanTask.id == task_id)
                )
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error_message = str(exc)[:500]
                    _sync_task_scan_duration(task)
                    await db.commit()
            except Exception as rollback_error:
                logger.error(
                    f"Failed to rollback/update failed PHPStan task {task_id}: {rollback_error}"
                )
        finally:
            _clear_scan_task_cancel("phpstan", task_id)


@router.post("/phpstan/scan", response_model=PhpstanScanTaskResponse)
async def create_phpstan_scan(
    request: PhpstanScanTaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """创建 PHPStan 静态扫描任务。"""
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_root = await _get_project_root(request.project_id)
    if not project_root:
        raise HTTPException(
            status_code=400,
            detail="找不到项目的 zip 文件，请先上传项目 ZIP 文件到 uploads/zip_files 目录",
        )

    scan_task = PhpstanScanTask(
        project_id=request.project_id,
        name=request.name or f"PHPStan_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        status="pending",
        target_path=request.target_path,
        level=_normalize_phpstan_level(request.level),
    )
    db.add(scan_task)
    await db.commit()
    await db.refresh(scan_task)

    background_tasks.add_task(
        _execute_phpstan_scan,
        scan_task.id,
        project_root,
        request.target_path,
        scan_task.level,
    )
    return scan_task


@router.get("/phpstan/tasks", response_model=List[PhpstanScanTaskResponse])
async def list_phpstan_tasks(
    project_id: Optional[str] = Query(None, description="按项目ID过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 PHPStan 扫描任务列表。"""
    query = select(PhpstanScanTask)
    if project_id:
        query = query.where(PhpstanScanTask.project_id == project_id)
    query = query.order_by(PhpstanScanTask.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/phpstan/tasks/{task_id}", response_model=PhpstanScanTaskResponse)
async def get_phpstan_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 PHPStan 扫描任务详情。"""
    result = await db.execute(select(PhpstanScanTask).where(PhpstanScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/phpstan/tasks/{task_id}/interrupt")
async def interrupt_phpstan_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """中止运行中的 PHPStan 扫描任务。"""
    result = await db.execute(select(PhpstanScanTask).where(PhpstanScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in {"completed", "failed", "interrupted"}:
        return {
            "message": f"任务当前状态为 {task.status}，无需中止",
            "task_id": task_id,
            "status": task.status,
        }

    _request_scan_task_cancel("phpstan", task_id)
    task.status = "interrupted"
    if not task.error_message:
        task.error_message = "扫描任务已中止（用户操作）"
    _sync_task_scan_duration(task)
    await db.commit()
    return {"message": "任务已中止", "task_id": task_id, "status": "interrupted"}


@router.delete("/phpstan/tasks/{task_id}")
async def delete_phpstan_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """删除 PHPStan 扫描任务及其发现。"""
    result = await db.execute(select(PhpstanScanTask).where(PhpstanScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    await db.delete(task)
    await db.commit()
    return {"message": "任务已删除", "task_id": task_id}


@router.get("/phpstan/tasks/{task_id}/findings", response_model=List[PhpstanFindingResponse])
async def get_phpstan_findings(
    task_id: str,
    status: Optional[str] = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取 PHPStan 扫描发现列表。"""
    task_result = await db.execute(select(PhpstanScanTask).where(PhpstanScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    query = select(PhpstanFinding).where(PhpstanFinding.scan_task_id == task_id)
    if status:
        query = query.where(PhpstanFinding.status == status)
    query = query.order_by(PhpstanFinding.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get(
    "/phpstan/tasks/{task_id}/findings/{finding_id}",
    response_model=PhpstanFindingResponse,
)
async def get_phpstan_finding(
    task_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """获取单条 PHPStan 扫描发现详情。"""
    task_result = await db.execute(select(PhpstanScanTask).where(PhpstanScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    finding_result = await db.execute(
        select(PhpstanFinding).where(
            (PhpstanFinding.id == finding_id) & (PhpstanFinding.scan_task_id == task_id)
        )
    )
    finding = finding_result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="PHPStan 问题不存在")
    return finding


@router.post("/phpstan/findings/{finding_id}/status")
async def update_phpstan_finding_status(
    finding_id: str,
    status: str = Query(..., description="状态: open, verified, false_positive, fixed"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """更新 PHPStan 扫描发现状态。"""
    normalized_status = str(status or "").strip().lower()
    if normalized_status not in {"open", "verified", "false_positive", "fixed"}:
        raise HTTPException(status_code=400, detail="status 必须为 open/verified/false_positive/fixed")

    result = await db.execute(select(PhpstanFinding).where(PhpstanFinding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="PHPStan 问题不存在")

    finding.status = normalized_status
    await db.commit()
    return {"message": "状态已更新", "finding_id": finding_id, "status": normalized_status}
