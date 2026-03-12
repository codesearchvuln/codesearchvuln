import asyncio
import json
import logging
import os
import subprocess
import tempfile
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.static_tasks import (
    _get_project_root,
    _sync_task_scan_duration,
)
from app.db.session import async_session_factory, get_db
from app.models.bandit import BanditFinding, BanditScanTask
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

_bandit_running_processes: Dict[str, subprocess.Popen] = {}
_bandit_cancelled_scan_tasks: set[str] = set()
_bandit_process_lock = threading.Lock()


class BanditScanTaskCreate(BaseModel):
    project_id: str = Field(..., description="项目ID")
    name: Optional[str] = Field(None, description="任务名称")
    target_path: str = Field(".", description="扫描目标路径，相对于项目根目录")
    severity_level: Optional[str] = Field(
        "low", description="最低严重程度: low, medium, high"
    )
    confidence_level: Optional[str] = Field(
        "low", description="最低置信度: low, medium, high"
    )


class BanditScanTaskResponse(BaseModel):
    id: str
    project_id: str
    name: str
    status: str
    target_path: str
    total_findings: int
    high_count: int
    medium_count: int
    low_count: int
    high_confidence_count: int
    scan_duration_ms: int
    files_scanned: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BanditFindingResponse(BaseModel):
    id: str
    scan_task_id: str
    test_id: str
    test_name: Optional[str]
    issue_text: Optional[str]
    file_path: str
    line_number: Optional[int]
    issue_severity: str
    issue_confidence: str
    code: Optional[str]
    more_info: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)


def _is_bandit_task_cancelled(task_id: str) -> bool:
    with _bandit_process_lock:
        return task_id in _bandit_cancelled_scan_tasks


def _request_bandit_task_cancel(task_id: str) -> bool:
    process = None
    with _bandit_process_lock:
        _bandit_cancelled_scan_tasks.add(task_id)
        process = _bandit_running_processes.get(task_id)

    if not process:
        return False

    try:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
    except Exception as e:
        logger.warning("Failed to terminate bandit process for task %s: %s", task_id, e)
    return True


def _clear_bandit_task_cancel(task_id: str) -> None:
    with _bandit_process_lock:
        _bandit_cancelled_scan_tasks.discard(task_id)


def _run_bandit_subprocess(
    task_id: str,
    cmd: List[str],
    *,
    timeout: int = 600,
) -> subprocess.CompletedProcess[str]:
    process: Optional[subprocess.Popen] = None

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        with _bandit_process_lock:
            _bandit_running_processes[task_id] = process

        stdout, stderr = process.communicate(timeout=timeout)
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=process.returncode,
            stdout=stdout,
            stderr=stderr,
        )
    except subprocess.TimeoutExpired:
        if process:
            process.kill()
            process.communicate()
        raise
    finally:
        with _bandit_process_lock:
            _bandit_running_processes.pop(task_id, None)


def _normalize_bandit_level(raw: Optional[str], default: str = "low") -> str:
    text = str(raw or default).strip().lower()
    if text not in {"low", "medium", "high"}:
        return default
    return text


def _count_bandit_files_scanned(payload: Dict[str, Any]) -> int:
    metrics = payload.get("metrics")
    if not isinstance(metrics, dict):
        return 0
    return len([k for k in metrics.keys() if k and not str(k).startswith("_")])


async def _execute_bandit_scan(
    task_id: str,
    project_root: str,
    target_path: str,
    severity_level: str,
    confidence_level: str,
) -> None:
    async with async_session_factory() as db:
        try:
            task_result = await db.execute(
                select(BanditScanTask).where(BanditScanTask.id == task_id)
            )
            task = task_result.scalar_one_or_none()
            if not task:
                logger.error("Bandit task %s not found", task_id)
                return

            if _is_bandit_task_cancelled(task_id) or task.status == "interrupted":
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
                return

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
                    "--exit-zero",
                    "-lll" if severity_level == "high" else "-ll" if severity_level == "medium" else "-l",
                    "-iii" if confidence_level == "high" else "-ii" if confidence_level == "medium" else "-i",
                ]

                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: _run_bandit_subprocess(task_id, cmd, timeout=900),
                )

                if _is_bandit_task_cancelled(task_id):
                    task.status = "interrupted"
                    if not task.error_message:
                        task.error_message = "扫描任务已中止（用户操作）"
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return

                if result.returncode not in {0}:
                    error_msg = (result.stderr or result.stdout or "Unknown error").strip()
                    task.status = "failed"
                    task.error_message = error_msg[:500]
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return

                if not os.path.exists(report_file):
                    task.status = "completed"
                    task.total_findings = 0
                    _sync_task_scan_duration(task)
                    await db.commit()
                    return

                with open(report_file, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read().strip()
                    payload = json.loads(content) if content else {}

                findings = payload.get("results") if isinstance(payload, dict) else []
                if not isinstance(findings, list):
                    findings = []

                high_count = 0
                medium_count = 0
                low_count = 0
                high_confidence_count = 0

                for finding in findings:
                    if not isinstance(finding, dict):
                        continue

                    sev = str(finding.get("issue_severity") or "LOW").upper()
                    conf = str(finding.get("issue_confidence") or "LOW").upper()
                    if sev == "HIGH":
                        high_count += 1
                    elif sev == "MEDIUM":
                        medium_count += 1
                    else:
                        low_count += 1
                    if conf == "HIGH":
                        high_confidence_count += 1

                    db.add(
                        BanditFinding(
                            scan_task_id=task_id,
                            test_id=str(finding.get("test_id") or "BANDIT_UNKNOWN"),
                            test_name=str(finding.get("test_name") or "") or None,
                            issue_text=str(finding.get("issue_text") or "") or None,
                            file_path=str(finding.get("filename") or ""),
                            line_number=finding.get("line_number"),
                            issue_severity=sev,
                            issue_confidence=conf,
                            code=str(finding.get("code") or "") or None,
                            more_info=str(finding.get("more_info") or "") or None,
                            status="open",
                        )
                    )

                task.status = "completed"
                task.total_findings = len(findings)
                task.high_count = high_count
                task.medium_count = medium_count
                task.low_count = low_count
                task.high_confidence_count = high_confidence_count
                task.files_scanned = _count_bandit_files_scanned(payload if isinstance(payload, dict) else {})
                _sync_task_scan_duration(task)
                await db.commit()
            finally:
                try:
                    if os.path.exists(report_file):
                        os.unlink(report_file)
                except Exception:
                    pass
        except asyncio.CancelledError:
            logger.warning("Bandit scan task %s interrupted by service shutdown", task_id)
            try:
                await db.rollback()
                task_result = await db.execute(
                    select(BanditScanTask).where(BanditScanTask.id == task_id)
                )
                task = task_result.scalar_one_or_none()
                if task:
                    task.status = "interrupted"
                    if not task.error_message:
                        task.error_message = "扫描任务已中断（服务关闭或沙箱停止）"
                    _sync_task_scan_duration(task)
                    await db.commit()
            except Exception as commit_error:
                logger.error("Failed to update bandit interrupted task status: %s", commit_error)
        except Exception as e:
            logger.error("Error executing bandit scan for task %s: %s", task_id, e)
            try:
                await db.rollback()
                task_result = await db.execute(
                    select(BanditScanTask).where(BanditScanTask.id == task_id)
                )
                task = task_result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error_message = str(e)[:500]
                    _sync_task_scan_duration(task)
                    await db.commit()
            except Exception as commit_error:
                logger.error("Failed to update bandit task status after error: %s", commit_error)
        finally:
            _clear_bandit_task_cancel(task_id)
            if project_root and project_root.startswith("/tmp") and os.path.exists(project_root):
                try:
                    import shutil

                    shutil.rmtree(project_root, ignore_errors=True)
                except Exception as e:
                    logger.warning("Failed to clean up temporary directory %s: %s", project_root, e)


@router.post("/scan", response_model=BanditScanTaskResponse)
async def create_bandit_scan(
    request: BanditScanTaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    project_result = await db.execute(select(Project).where(Project.id == request.project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_root = await _get_project_root(request.project_id)
    if not project_root:
        raise HTTPException(status_code=404, detail="未找到项目文件")

    task_name = request.name or f"Bandit 扫描 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    scan_task = BanditScanTask(
        project_id=request.project_id,
        name=task_name,
        target_path=request.target_path,
        status="pending",
    )
    db.add(scan_task)
    await db.commit()
    await db.refresh(scan_task)

    background_tasks.add_task(
        _execute_bandit_scan,
        scan_task.id,
        project_root,
        request.target_path,
        _normalize_bandit_level(request.severity_level, "low"),
        _normalize_bandit_level(request.confidence_level, "low"),
    )

    return scan_task


@router.get("/tasks", response_model=List[BanditScanTaskResponse])
async def list_bandit_tasks(
    project_id: Optional[str] = Query(None, description="按项目ID过滤"),
    status: Optional[str] = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    query = select(BanditScanTask)
    if project_id:
        query = query.where(BanditScanTask.project_id == project_id)
    if status:
        query = query.where(BanditScanTask.status == status)

    query = query.order_by(BanditScanTask.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/tasks/{task_id}", response_model=BanditScanTaskResponse)
async def get_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/tasks/{task_id}/interrupt")
async def interrupt_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
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

    _request_bandit_task_cancel(task_id)
    task.status = "interrupted"
    if not task.error_message:
        task.error_message = "扫描任务已中止（用户操作）"
    _sync_task_scan_duration(task)
    await db.commit()

    return {"message": "任务已中止", "task_id": task_id, "status": "interrupted"}


@router.delete("/tasks/{task_id}")
async def delete_bandit_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    await db.delete(task)
    await db.commit()
    return {"message": "任务已删除", "task_id": task_id}


@router.get("/tasks/{task_id}/findings", response_model=List[BanditFindingResponse])
async def get_bandit_findings(
    task_id: str,
    status: Optional[str] = Query(
        None, description="按状态过滤: open, verified, false_positive, fixed"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    task_result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    query = select(BanditFinding).where(BanditFinding.scan_task_id == task_id)
    if status:
        query = query.where(BanditFinding.status == status)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/tasks/{task_id}/findings/{finding_id}", response_model=BanditFindingResponse)
async def get_bandit_finding(
    task_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    task_result = await db.execute(select(BanditScanTask).where(BanditScanTask.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="任务不存在")

    finding_result = await db.execute(
        select(BanditFinding).where(
            BanditFinding.id == finding_id,
            BanditFinding.scan_task_id == task_id,
        )
    )
    finding = finding_result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="扫描记录不存在")
    return finding


@router.post("/findings/{finding_id}/status")
async def update_bandit_finding_status(
    finding_id: str,
    status: str = Query(
        ...,
        pattern="^(open|verified|false_positive|fixed)$",
        description="新状态: open, verified, false_positive, fixed",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(select(BanditFinding).where(BanditFinding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="扫描记录不存在")

    finding.status = status
    await db.commit()
    return {"message": "状态已更新", "finding_id": finding_id, "status": status}
