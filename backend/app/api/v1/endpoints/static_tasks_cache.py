
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.v1.endpoints.static_tasks_shared import (
    deps,
    logger,
)
from app.models.user import User
from app.services.llm_rule.repo_cache_manager import GlobalRepoCacheManager

router = APIRouter()

@router.get("/cache/repo-stats")
async def get_repo_cache_stats(
    current_user: User = Depends(deps.get_current_user),
):
    """
    获取 Git 项目缓存统计信息

    返回所有缓存的 Git 项目列表及其大小信息
    """
    stats = GlobalRepoCacheManager.get_cache_size()
    all_caches = GlobalRepoCacheManager.get_all_cached_repos()

    repos = []
    for key, cache in all_caches.items():
        if cache.cache_dir.exists():
            repo_size = sum(
                f.stat().st_size
                for f in cache.cache_dir.rglob('*')
                if f.is_file()
            )
            repos.append({
                "repo_key": key,
                "repo_owner": cache.repo_owner,
                "repo_name": cache.repo_name,
                "cache_dir": str(cache.cache_dir),
                "size_mb": round(repo_size / 1024 / 1024, 2),
                "created_at": cache.created_at,
                "last_accessed": cache.last_accessed,
                "access_count": cache.access_count,
            })

    return {
        "total_cached_repos": stats["total_cached_repos"],
        "total_size_gb": stats["total_size_gb"],
        "repos": repos,
    }


@router.post("/cache/cleanup-unused")
async def cleanup_unused_cache(
    max_age_days: int = Query(30, ge=1, description="缓存最大存在天数"),
    max_unused_days: int = Query(14, ge=1, description="缓存最大未访问天数"),
    current_user: User = Depends(deps.get_current_user),
):
    """
    清理未使用的 Git 项目缓存

    删除超过指定天数未访问或总存在时间太长的缓存

    Args:
        max_age_days: 缓存最大存在天数，超过此值的缓存将被清理（默认30天）
        max_unused_days: 缓存最大未访问天数，超过此值的缓存将被清理（默认14天）
    """
    try:
        cleaned_count = GlobalRepoCacheManager.cleanup_unused_caches(
            max_age_days=max_age_days,
            max_unused_days=max_unused_days,
        )

        stats = GlobalRepoCacheManager.get_cache_size()

        return {
            "message": f"已清理 {cleaned_count} 个过期的缓存",
            "cleaned_count": cleaned_count,
            "remaining_cached_repos": stats["total_cached_repos"],
            "remaining_size_gb": stats["total_size_gb"],
        }
    except Exception as e:
        logger.error(f"清理缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清理缓存失败: {str(e)}") from e


@router.post("/cache/clear-all")
async def clear_all_cache(
    current_user: User = Depends(deps.get_current_user),
):
    """
    清理所有 Git 项目缓存

    警告：此操作会删除所有缓存的 Git 项目，
    下次处理 Patch 文件时需要重新克隆所有项目
    """
    try:
        before_stats = GlobalRepoCacheManager.get_cache_size()
        GlobalRepoCacheManager.clear_all_caches()

        return {
            "message": "已清理所有缓存",
            "cleared_repos": before_stats["total_cached_repos"],
            "cleared_size_gb": before_stats["total_size_gb"],
        }
    except Exception as e:
        logger.error(f"清理所有缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}") from e
