import asyncio
import logging
import os
import signal
import warnings
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.api.v1.api import api_router
from app.api.v1.endpoints.static_tasks_shared import prune_scan_progress_store
from app.core.config import settings
from app.core.logging_setup import configure_backend_file_logging
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.agent_task import AgentTask, AgentTaskStatus
from app.models.bandit import BanditScanTask
from app.models.gitleaks import GitleaksScanTask
from app.models.opengrep import OpengrepScanTask
from app.models.phpstan import PhpstanScanTask
from app.models.pmd_scan import PmdScanTask
from app.models.yasa import YasaScanTask
from app.runtime.db_contract import check_database_contract
from app.services.llm_rule.repo_cache_manager import GlobalRepoCacheManager
from app.services.runner_preflight import run_configured_runner_preflights
from app.services.zip_cache_manager import get_zip_cache_manager

# 配置日志
logging.basicConfig(level=logging.INFO)
configure_backend_file_logging()
logger = logging.getLogger(__name__)

# 禁用 uvicorn access log 和 LiteLLM INFO 日志
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)
logging.getLogger("litellm").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
# Reduce noisy PDF/font subsetting logs in report export paths.
logging.getLogger("weasyprint").setLevel(logging.WARNING)
logging.getLogger("fontTools").setLevel(logging.WARNING)
logging.getLogger("fontTools.subset").setLevel(logging.WARNING)
logging.getLogger("fontTools.ttLib").setLevel(logging.WARNING)
logging.getLogger("pygount").setLevel(logging.WARNING)

warnings.filterwarnings(
    "ignore",
    message=r".*enable_cleanup_closed ignored because .*",
    category=DeprecationWarning,
    module=r"aiohttp\.connector",
)


async def check_agent_services():
    """检查 Agent 必须服务的可用性"""
    issues = []

    # 检查 Docker/沙箱服务
    client = None
    try:
        import docker

        client = docker.from_env()
        client.ping()
        logger.info("  - Docker 服务可用")
    except ImportError:
        issues.append("Docker Python 库未安装 (pip install docker)")
    except Exception as e:
        issues.append(f"Docker 服务不可用: {e}")
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass

    # 检查 Redis 连接（可选警告）
    redis_client = None
    try:
        import redis

        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        redis_client = redis.from_url(redis_url)
        redis_client.ping()
        logger.info("  - Redis 服务可用")
    except ImportError:
        logger.warning("  - Redis Python 库未安装，部分功能可能受限")
    except Exception as e:
        logger.warning(f"  - Redis 服务连接失败: {e}")
    finally:
        if redis_client is not None:
            try:
                redis_client.close()
            except Exception:
                pass
            connection_pool = getattr(redis_client, "connection_pool", None)
            if connection_pool is not None:
                try:
                    connection_pool.disconnect()
                except Exception:
                    pass

    return issues


async def assert_database_schema_is_latest() -> None:
    """Fail fast when the runtime database contract is not satisfied."""
    await check_database_contract()


async def _run_cache_cleanup_once() -> dict[str, int]:
    summary = {
        "repo_caches": 0,
        "scan_progress_entries": 0,
        "zip_cache_entries": 0,
    }
    summary["repo_caches"] = GlobalRepoCacheManager.cleanup_unused_caches(
        max_age_days=30,
        max_unused_days=14,
    )
    summary["scan_progress_entries"] = prune_scan_progress_store()
    summary["zip_cache_entries"] = await get_zip_cache_manager().prune_expired()
    return summary


async def _run_daily_cache_cleanup(stop_event: asyncio.Event) -> None:
    """每日清理一次缓存，直到收到停止信号。"""
    while not stop_event.is_set():
        try:
            summary = await _run_cache_cleanup_once()
            if summary["repo_caches"] > 0:
                logger.info(f"  - 定时清理完成，已清理 {summary['repo_caches']} 个过期的 Git 项目缓存")
            if summary["scan_progress_entries"] > 0:
                logger.info(f"  - 定时清理完成，已清理 {summary['scan_progress_entries']} 个静态扫描进度残留")
            if summary["zip_cache_entries"] > 0:
                logger.info(f"  - 定时清理完成，已清理 {summary['zip_cache_entries']} 个过期 ZIP 缓存条目")
        except Exception as e:
            logger.warning(f"定时清理过期缓存失败: {e}")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=24 * 60 * 60)
        except TimeoutError:
            continue


INTERRUPTED_ERROR_MESSAGE = "服务中断，任务被自动标记为中断"
RECOVERABLE_AGENT_TASK_STATUSES = {
    AgentTaskStatus.PENDING,
    AgentTaskStatus.INITIALIZING,
    AgentTaskStatus.RUNNING,
    AgentTaskStatus.PLANNING,
    AgentTaskStatus.INDEXING,
    AgentTaskStatus.ANALYZING,
    AgentTaskStatus.VERIFYING,
    AgentTaskStatus.REPORTING,
}
RECOVERABLE_OPENGREP_TASK_STATUSES = {"pending", "running"}
RECOVERABLE_GITLEAKS_TASK_STATUSES = {"pending", "running"}
# Bandit interrupted recovery support
RECOVERABLE_BANDIT_TASK_STATUSES = {"pending", "running"}
# PHPStan interrupted recovery support
RECOVERABLE_PHPSTAN_TASK_STATUSES = {"pending", "running"}
# YASA interrupted recovery support
RECOVERABLE_YASA_TASK_STATUSES = {"pending", "running"}
# PMD interrupted recovery support
RECOVERABLE_PMD_TASK_STATUSES = {"pending", "running"}


def _mark_task_interrupted(task) -> bool:
    changed = False
    if str(getattr(task, "status", "")).lower() != "interrupted":
        task.status = "interrupted"
        changed = True

    if hasattr(task, "completed_at") and getattr(task, "completed_at", None) is None:
        task.completed_at = datetime.now(UTC)

    if hasattr(task, "error_message") and not getattr(task, "error_message", None):
        task.error_message = INTERRUPTED_ERROR_MESSAGE

    if hasattr(task, "error_count"):
        task.error_count = int(getattr(task, "error_count", 0) or 0) + 1

    return changed


async def recover_interrupted_tasks() -> dict[str, int]:
    """
    将上次异常退出时仍处于进行中的任务统一标记为 interrupted。
    """
    async with AsyncSessionLocal() as db:
        counts = {
            "agent": 0,
            "opengrep": 0,
            "gitleaks": 0,
            "bandit": 0,
            "phpstan": 0,
            "yasa": 0,
            "pmd": 0,
        }

        recovery_specs = [
            (AgentTask, RECOVERABLE_AGENT_TASK_STATUSES, "agent"),
            (OpengrepScanTask, RECOVERABLE_OPENGREP_TASK_STATUSES, "opengrep"),
            (GitleaksScanTask, RECOVERABLE_GITLEAKS_TASK_STATUSES, "gitleaks"),
            # Bandit interrupted recovery support
            (BanditScanTask, RECOVERABLE_BANDIT_TASK_STATUSES, "bandit"),
            # PHPStan interrupted recovery support
            (PhpstanScanTask, RECOVERABLE_PHPSTAN_TASK_STATUSES, "phpstan"),
            # YASA interrupted recovery support
            (YasaScanTask, RECOVERABLE_YASA_TASK_STATUSES, "yasa"),
            # PMD interrupted recovery support
            (PmdScanTask, RECOVERABLE_PMD_TASK_STATUSES, "pmd"),
        ]

        for model, recoverable_statuses, counter_key in recovery_specs:
            result = await db.execute(
                select(model).where(model.status.in_(sorted(recoverable_statuses)))
            )
            for task in result.scalars().all():
                if _mark_task_interrupted(task):
                    counts[counter_key] += 1

        if any(counts.values()):
            await db.commit()
            logger.warning(
                "检测到上次中断遗留任务，已自动标记 interrupted：agent=%s, opengrep=%s, gitleaks=%s, bandit=%s, phpstan=%s, yasa=%s, pmd=%s",
                counts["agent"],
                counts["opengrep"],
                counts["gitleaks"],
                counts["bandit"],
                counts["phpstan"],
                counts["yasa"],
                counts["pmd"],
            )
        else:
            await db.rollback()

        return counts


def _collect_stale_yasa_pids() -> list[int]:
    """识别命中 /tmp/yasa_report_ 的遗留 YASA 进程。"""
    try:
        output = subprocess.check_output(
            ["ps", "-eo", "pid=,cmd="],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return []

    stale_pids: list[int] = []
    for line in output.splitlines():
        raw = line.strip()
        if not raw:
            continue
        parts = raw.split(maxsplit=1)
        if len(parts) != 2:
            continue
        pid_text, cmd = parts
        lower_cmd = cmd.lower()
        if (
            "yasa" not in lower_cmd
            and "yasa-engine.real" not in lower_cmd
            and "yasa-engine" not in lower_cmd
        ):
            continue
        if "/tmp/yasa_report_" not in cmd:
            continue
        try:
            pid = int(pid_text)
        except ValueError:
            continue
        if pid > 1 and pid != os.getpid():
            stale_pids.append(pid)
    return stale_pids


async def cleanup_stale_yasa_processes() -> dict[str, int]:
    if not bool(getattr(settings, "YASA_STARTUP_FORCE_CLEANUP", True)):
        return {"matched": 0, "terminated": 0, "killed": 0}

    grace_seconds = max(
        1, int(getattr(settings, "YASA_PROCESS_KILL_GRACE_SECONDS", 2) or 2)
    )
    pids = _collect_stale_yasa_pids()
    if not pids:
        return {"matched": 0, "terminated": 0, "killed": 0}

    terminated = 0
    killed = 0
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
            terminated += 1
        except ProcessLookupError:
            continue
        except Exception:
            continue

    await asyncio.sleep(grace_seconds)

    for pid in pids:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        except Exception:
            continue
        try:
            os.kill(pid, signal.SIGKILL)
            killed += 1
        except ProcessLookupError:
            continue
        except Exception:
            continue

    return {"matched": len(pids), "terminated": terminated, "killed": killed}



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    启动时初始化数据库（创建默认账户等）和全局缓存管理
    """
    logger.info("VulHunter 后端服务启动中...")

    # 初始化全局 Git 项目缓存管理器
    try:
        cache_dir = Path(settings.CACHE_DIR) / "repos"
        GlobalRepoCacheManager.set_cache_dir(cache_dir)
        logger.info(f"  - Git 项目缓存初始化完成: {cache_dir}")
    except Exception as e:
        logger.warning(f"Git 项目缓存初始化失败: {e}")

    # 初始化 tiktoken 缓存目录，并按需预热。
    try:
        from app.services.llm.tokenizer import ensure_tiktoken_cache_dir, prewarm_tiktoken

        tiktoken_cache_dir = ensure_tiktoken_cache_dir()
        if tiktoken_cache_dir:
            logger.info(f"  - tiktoken 缓存目录就绪: {tiktoken_cache_dir}")

        if getattr(settings, "LLM_TOKENIZER_PREWARM", False):
            prewarm_tiktoken(settings.LLM_MODEL or "gpt-4o-mini")
    except Exception as e:
        logger.warning(f"tiktoken 启动预热初始化失败: {e}")

    # 数据库契约检查：不一致时拒绝启动，避免运行时因缺表导致 500。
    await assert_database_schema_is_latest()
    logger.info("  - 数据库契约检查通过")

    # 初始化数据库（创建默认账户）
    try:
        async with AsyncSessionLocal() as db:
            await init_db(db)
        logger.info("  - 数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        raise

    try:
        cleanup_summary = await cleanup_stale_yasa_processes()
        if cleanup_summary["matched"] > 0:
            logger.warning(
                "启动时已清理遗留 YASA 进程：matched=%s, terminated=%s, killed=%s",
                cleanup_summary["matched"],
                cleanup_summary["terminated"],
                cleanup_summary["killed"],
            )
    except Exception as e:
        logger.warning(f"清理遗留 YASA 进程失败: {e}")

    try:
        await recover_interrupted_tasks()
    except Exception as e:
        logger.warning(f"恢复中断任务失败: {e}")

    try:
        await run_configured_runner_preflights()
    except Exception as e:
        logger.error(f"runner preflight 失败: {e}")
        raise

    # 检查 Agent 服务
    logger.info("检查 Agent 核心服务...")
    issues = await check_agent_services()
    if issues:
        logger.warning("=" * 50)
        logger.warning("Agent 服务检查发现问题:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        logger.warning("部分功能可能不可用，请检查配置")
        logger.warning("=" * 50)
    else:
        logger.info("  - Agent 核心服务检查通过")

    logger.info("=" * 50)
    logger.info("VulHunter 后端服务已启动")
    logger.info("API 文档: http://localhost:8000/docs")
    logger.info("=" * 50)
    # logger.info("演示账户: demo@example.com / demo123")
    logger.info("无需账号即可使用")
    logger.info("=" * 50)

    app.state.tool_runtime_daemon_status = {}
    # logger.info("工具运行时已切换为任务内按需 stdio 调用，跳过启动期常驻守护进程")

    # 启动每日定时清理任务
    stop_event = asyncio.Event()
    app.state.cache_cleanup_stop = stop_event
    app.state.cache_cleanup_task = asyncio.create_task(
        _run_daily_cache_cleanup(stop_event)
    )

    yield

    # 清理资源
    logger.info("清理资源...")
    try:
        from app.api.v1.endpoints.agent_tasks_runtime import _running_asyncio_tasks
        from app.api.v1.endpoints.static_tasks_shared import _shutdown_static_background_jobs
        from app.services.upload.project_info_refresher import project_info_refresher

        active_agent_tasks = [
            task for task in list(_running_asyncio_tasks.values()) if task and not task.done()
        ]
        for task in active_agent_tasks:
            task.cancel()
        if active_agent_tasks:
            await asyncio.gather(*active_agent_tasks, return_exceptions=True)

        cancelled_static_jobs = await _shutdown_static_background_jobs()
        cancelled_project_info_jobs = await project_info_refresher.shutdown()
        if active_agent_tasks or cancelled_static_jobs or cancelled_project_info_jobs:
            logger.info(
                "  - 已取消后台任务: agent=%s static=%s project_info=%s",
                len(active_agent_tasks),
                cancelled_static_jobs,
                cancelled_project_info_jobs,
            )
    except Exception as e:
        logger.warning(f"停止后台任务失败: {e}")

    # 停止每日清理任务
    try:
        stop_event = getattr(app.state, "cache_cleanup_stop", None)
        task = getattr(app.state, "cache_cleanup_task", None)
        if stop_event and task:
            stop_event.set()
            await task
    except Exception as e:
        logger.warning(f"停止定时清理任务失败: {e}")

    # 清理未关闭的 aiohttp ClientSession（修复资源泄漏警告）
    try:
        import gc

        # 等待一小段时间让所有 pending 的异步任务完成
        await asyncio.sleep(0.1)

        # 强制垃圾回收，触发并清理未关闭的资源
        gc.collect()

        # 再等待一点时间让清理完成
        await asyncio.sleep(0.05)

        logger.info("  - 异步资源清理完成")
    except Exception as e:
        logger.warning(f"清理异步资源失败: {e}")

    try:
        summary = await _run_cache_cleanup_once()
        if summary["repo_caches"] > 0:
            logger.info(f"  - 已清理 {summary['repo_caches']} 个过期的 Git 项目缓存")
        if summary["scan_progress_entries"] > 0:
            logger.info(f"  - 已清理 {summary['scan_progress_entries']} 个静态扫描进度残留")
        if summary["zip_cache_entries"] > 0:
            logger.info(f"  - 已清理 {summary['zip_cache_entries']} 个过期 ZIP 缓存条目")
    except Exception as e:
        logger.warning(f"清理过期缓存失败: {e}")

    logger.info("VulHunter 后端服务已关闭")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Configure CORS - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "message": "Welcome to VulHunter API",
        "docs": "/docs",
        # "demo_account": {"email": "demo@example.com", "password": "demo123"},
    }
