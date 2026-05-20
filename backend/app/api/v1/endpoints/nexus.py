from __future__ import annotations

import asyncio
import base64
import json
import logging
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.config import settings
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.services.zip_storage import load_project_zip

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_CACHE_KEY_LENGTH = 255
MAX_PAYLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
DEFAULT_NEXUS_CACHE_STORAGE_PATH = "./nexus_cache"

# === 缓存预热相关 ===
DEFAULT_NEXUS_WEB_URL = "http://localhost:5175"
WARMUP_TIMEOUT_MILLIS = 600_000  # 单个项目预热超时（10 分钟）
_WARMUP_CONCURRENCY = 2  # 批量预热时的最大并发数
# nexus-web 中暴露 window.startPipeline 的页面路径
_PIPELINE_RUNNER_PATH = "/pipeline-runner"


class NexusCacheCreateRequest(BaseModel):
    cache_key: str = Field(..., min_length=1, max_length=MAX_CACHE_KEY_LENGTH)
    payload_json: str = Field(..., min_length=1)
    meta: dict[str, Any] | None = None


class NexusCacheUpdateRequest(BaseModel):
    payload_json: str = Field(..., min_length=1)
    meta: dict[str, Any] | None = None


class NexusCacheResponse(BaseModel):
    cache_key: str
    payload_json: str
    meta: dict[str, Any] | None = None
    size_bytes: int
    created_at: datetime
    updated_at: datetime


class NexusCacheListItem(BaseModel):
    cache_key: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime


class NexusCacheListResponse(BaseModel):
    items: list[NexusCacheListItem]
    total: int
    skip: int
    limit: int


class WarmupResponse(BaseModel):
    status: str
    project_id: str
    message: str


class WarmupAllResponse(BaseModel):
    status: str
    total: int
    project_ids: list[str]
    message: str


def _normalize_cache_key(cache_key: str) -> str:
    normalized = cache_key.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="cache_key 不能为空")
    if len(normalized) > MAX_CACHE_KEY_LENGTH:
        raise HTTPException(status_code=422, detail="cache_key 超过长度限制")
    if any(ord(char) < 32 for char in normalized):
        raise HTTPException(status_code=422, detail="cache_key 包含非法控制字符")
    return normalized


def _validate_payload_json(payload_json: str) -> int:
    try:
        json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="payload_json 必须是合法 JSON 字符串") from exc

    size_bytes = len(payload_json.encode("utf-8"))
    if size_bytes > MAX_PAYLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"payload_json 过大，最大允许 {MAX_PAYLOAD_SIZE_BYTES} 字节",
        )
    return size_bytes


def _cache_storage_root() -> Path:
    base_path = Path(
        getattr(settings, "NEXUS_CACHE_STORAGE_PATH", DEFAULT_NEXUS_CACHE_STORAGE_PATH)
        or DEFAULT_NEXUS_CACHE_STORAGE_PATH
    )
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path


def _cache_user_dir(user_id: str) -> Path:
    user_bucket = sha256(user_id.encode("utf-8")).hexdigest()
    user_dir = _cache_storage_root() / user_bucket
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def _cache_file_path(user_id: str, cache_key: str) -> Path:
    filename = f"{sha256(cache_key.encode('utf-8')).hexdigest()}.json"
    return _cache_user_dir(user_id) / filename


def _write_cache_file(path: Path, payload: dict[str, Any]) -> None:
    temp_path = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    try:
        with temp_path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False)
        temp_path.replace(path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="写入缓存文件失败") from exc
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


def _read_cache_file(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="缓存不存在") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="读取缓存文件失败") from exc

    required_keys = {
        "cache_key",
        "payload_json",
        "meta",
        "size_bytes",
        "created_at",
        "updated_at",
    }
    if not required_keys.issubset(payload.keys()):
        raise HTTPException(status_code=500, detail="缓存文件格式不正确")
    return payload


def _build_cache_payload(
    *,
    cache_key: str,
    payload_json: str,
    meta: dict[str, Any] | None,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    size_bytes = _validate_payload_json(payload_json)
    return {
        "cache_key": cache_key,
        "payload_json": payload_json,
        "meta": meta,
        "size_bytes": size_bytes,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
    }


@router.post("/cache", response_model=NexusCacheResponse, status_code=201)
async def create_cache(
    request: NexusCacheCreateRequest,
    current_user: User = Depends(deps.get_current_user),
) -> NexusCacheResponse:
    cache_key = _normalize_cache_key(request.cache_key)
    path = _cache_file_path(str(current_user.id), cache_key)
    if path.exists():
        raise HTTPException(status_code=409, detail="缓存已存在")

    now = datetime.now(UTC)
    payload = _build_cache_payload(
        cache_key=cache_key,
        payload_json=request.payload_json,
        meta=request.meta,
        created_at=now,
        updated_at=now,
    )
    _write_cache_file(path, payload)
    return NexusCacheResponse.model_validate(payload)


@router.get("/cache", response_model=NexusCacheListResponse)
async def list_cache(
    prefix: str | None = Query(None, max_length=MAX_CACHE_KEY_LENGTH),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(deps.get_current_user),
) -> NexusCacheListResponse:
    normalized_prefix = _normalize_cache_key(prefix) if prefix is not None and prefix.strip() else None
    user_dir = _cache_user_dir(str(current_user.id))
    records: list[NexusCacheListItem] = []

    for file_path in user_dir.glob("*.json"):
        payload = _read_cache_file(file_path)
        cache_key = str(payload["cache_key"])
        if normalized_prefix and not cache_key.startswith(normalized_prefix):
            continue
        records.append(
            NexusCacheListItem(
                cache_key=cache_key,
                size_bytes=int(payload["size_bytes"]),
                created_at=payload["created_at"],
                updated_at=payload["updated_at"],
            )
        )

    records.sort(key=lambda item: item.updated_at, reverse=True)
    total = len(records)
    items = records[skip : skip + limit]
    return NexusCacheListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/cache/{cache_key:path}", response_model=NexusCacheResponse)
async def get_cache(
    cache_key: str,
    current_user: User = Depends(deps.get_current_user),
) -> NexusCacheResponse:
    normalized_key = _normalize_cache_key(cache_key)
    path = _cache_file_path(str(current_user.id), normalized_key)
    payload = _read_cache_file(path)
    return NexusCacheResponse.model_validate(payload)


@router.put("/cache/{cache_key:path}", response_model=NexusCacheResponse)
async def update_cache(
    cache_key: str,
    request: NexusCacheUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
) -> NexusCacheResponse:
    normalized_key = _normalize_cache_key(cache_key)
    path = _cache_file_path(str(current_user.id), normalized_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="缓存不存在")

    existing_payload = _read_cache_file(path)
    created_at = datetime.fromisoformat(str(existing_payload["created_at"]))
    updated_at = datetime.now(UTC)

    payload = _build_cache_payload(
        cache_key=normalized_key,
        payload_json=request.payload_json,
        meta=request.meta,
        created_at=created_at,
        updated_at=updated_at,
    )
    _write_cache_file(path, payload)
    return NexusCacheResponse.model_validate(payload)


@router.delete("/cache/{cache_key:path}")
async def delete_cache(
    cache_key: str,
    current_user: User = Depends(deps.get_current_user),
) -> dict[str, str]:
    normalized_key = _normalize_cache_key(cache_key)
    path = _cache_file_path(str(current_user.id), normalized_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="缓存不存在")

    try:
        path.unlink()
    except OSError as exc:
        raise HTTPException(status_code=500, detail="删除缓存文件失败") from exc

    return {"message": "缓存已删除", "cache_key": normalized_key}


# ==================== 缓存预热端点 ====================

def _run_warmup_sync(project_id: str, zip_path: str, nexus_url: str) -> dict[str, Any]:
    """通过 Playwright 打开 nexus-web /pipeline-runner 页面，调用 window.startPipeline 触发预热"""
    # 读取 ZIP 文件并转为 base64（浏览器无法直接访问后端文件系统）
    try:
        with open(zip_path, "rb") as fh:
            zip_bytes = fh.read()
    except OSError as exc:
        return {"success": False, "error": f"读取 ZIP 失败: {exc}", "projectId": project_id}

    zip_base64 = base64.b64encode(zip_bytes).decode("ascii")
    filename = Path(zip_path).name

    # 延迟导入，避免未安装 playwright 时影响模块加载
    from playwright.sync_api import sync_playwright  # type: ignore[import-untyped]

    browser = None
    try:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        page = browser.new_page()

        # 1. 打开 nexus-web 的 pipeline-runner 页面
        target_url = f"{nexus_url.rstrip('/')}{_PIPELINE_RUNNER_PATH}"
        page.goto(target_url, wait_until="networkidle", timeout=30_000)

        # 2. 等待 React 组件挂载并暴露 window.startPipeline
        page.wait_for_function(
            "typeof window.startPipeline === 'function'",
            timeout=30_000,
        )

        # 3. 调用 startPipeline，Playwright 自动等待 async 函数返回的 Promise
        result = page.evaluate(
            """
            (args) => window.startPipeline(args)
            """,
            {
                "projectId": project_id,
                "zipBase64": zip_base64,
                "filename": filename,
            },
        )

        logger.info("预热完成: project=%s result=%s", project_id, result)
        return {"success": True, "data": result, "projectId": project_id}

    except Exception as exc:
        logger.error("Playwright 预热异常: project=%s error=%s", project_id, exc)
        return {"success": False, "error": str(exc), "projectId": project_id}

    finally:
        if browser is not None:
            browser.close()
        # sync_playwright() 的上下文管理器会自动清理，但手动 start() 需要手动 stop()
        # 这里用 try-finally 外层的逻辑；如果用了 with sync_playwright() as p 则自动清理
        # 由于上面是手动 start()，这里用 __exit__ 方式确保清理
        try:
            playwright.stop()
        except Exception:
            pass


async def _warmup_one(project_id: str, nexus_url: str) -> dict[str, Any]:
    """预热单个项目（在线程池中运行 Playwright，避免阻塞事件循环）"""
    zip_path = await load_project_zip(project_id)
    if not zip_path:
        logger.warning("项目 %s 无压缩包，跳过预热", project_id)
        return {"success": False, "error": "无压缩包", "projectId": project_id}
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _run_warmup_sync, project_id, zip_path, nexus_url)


async def _warmup_all_background(project_ids: list[str], nexus_url: str) -> None:
    """后台任务：逐项目预热，并发数受 _WARMUP_CONCURRENCY 控制"""
    sem = asyncio.Semaphore(_WARMUP_CONCURRENCY)

    async def _warmup_with_sem(pid: str) -> None:
        async with sem:
            try:
                result = await _warmup_one(pid, nexus_url)
                if result.get("success"):
                    logger.info("预热成功: %s", pid)
                else:
                    logger.warning("预热失败: %s reason=%s", pid, result.get("error"))
            except Exception as exc:
                logger.error("预热异常: %s error=%s", pid, exc)
            await asyncio.sleep(2)  # 项目之间短暂间隔

    tasks = [asyncio.create_task(_warmup_with_sem(pid)) for pid in project_ids]
    await asyncio.gather(*tasks)
    logger.info("批量预热完毕，共 %s 个项目", len(project_ids))


@router.post("/warmup/{project_id}", response_model=WarmupResponse)
async def warmup_project_cache(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> WarmupResponse:
    """触发单个项目的 Nexus 缓存预热（后台异步执行）"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    zip_path = await load_project_zip(project_id)
    if not zip_path:
        raise HTTPException(status_code=400, detail="项目无压缩包，无法预热")

    nexus_url = getattr(settings, "NEXUS_WEB_URL", None) or DEFAULT_NEXUS_WEB_URL
    asyncio.create_task(_warmup_one(project_id, nexus_url))
    logger.info("预热任务已启动: project_id=%s", project_id)

    return WarmupResponse(
        status="started",
        project_id=project_id,
        message="预热任务已启动",
    )


@router.post("/warmup", response_model=WarmupAllResponse)
async def warmup_all_projects_cache(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> WarmupAllResponse:
    """触发所有活跃 ZIP 项目的 Nexus 缓存预热（后台异步执行）"""
    result = await db.execute(
        select(Project.id).where(
            Project.source_type == "zip",
            Project.is_active == True,
        )
    )
    project_ids = [row[0] for row in result.fetchall()]

    if not project_ids:
        return WarmupAllResponse(
            status="completed",
            total=0,
            project_ids=[],
            message="无活跃 ZIP 项目",
        )

    nexus_url = getattr(settings, "NEXUS_WEB_URL", None) or DEFAULT_NEXUS_WEB_URL
    asyncio.create_task(_warmup_all_background(project_ids, nexus_url))
    logger.info("批量预热任务已启动: %s 个项目", len(project_ids))

    return WarmupAllResponse(
        status="started",
        total=len(project_ids),
        project_ids=project_ids,
        message=f"已启动 {len(project_ids)} 个项目的预热任务",
    )
