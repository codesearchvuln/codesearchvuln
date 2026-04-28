from __future__ import annotations

import json
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api import deps
from app.core.config import settings
from app.models.user import User

router = APIRouter()

MAX_CACHE_KEY_LENGTH = 255
MAX_PAYLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
DEFAULT_NEXUS_CACHE_STORAGE_PATH = "./nexus_cache"


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
