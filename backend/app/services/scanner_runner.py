from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Dict, Optional

import docker

from app.core.config import settings

logger = logging.getLogger(__name__)

SCANNER_MOUNT_PATH = "/scan"
MAX_RETAINED_LOG_CHARS = 12000
_CONTAINER_POLL_INTERVAL_S = 5
_PROGRESS_LOG_INTERVAL_S = 30
DOCKER_EXCEPTION = getattr(getattr(docker, "errors", None), "DockerException", Exception)
DOCKER_NOT_FOUND = getattr(getattr(docker, "errors", None), "NotFound", Exception)


class ScannerCancelledError(Exception):
    """Raised when a scanner run is cancelled via the cancel_check callback."""


def _poll_container_exit(
    container,
    timeout_seconds: int,
    *,
    cancel_check: Callable[[], bool] | None = None,
    scanner_label: str = "scanner",
) -> dict:
    """Poll container status to avoid Docker SDK HTTP ReadTimeout on long-running scans."""
    deadline = time.monotonic() + max(1, timeout_seconds)
    start = time.monotonic()
    last_progress_log = start
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"container did not exit within {timeout_seconds}s")
        if cancel_check is not None and cancel_check():
            elapsed = int(time.monotonic() - start)
            raise ScannerCancelledError(f"{scanner_label} cancelled after {elapsed}s")
        container.reload()
        if container.status in ("exited", "dead"):
            return {"StatusCode": container.attrs.get("State", {}).get("ExitCode", 1)}
        now = time.monotonic()
        if now - last_progress_log >= _PROGRESS_LOG_INTERVAL_S:
            elapsed = int(now - start)
            logger.info("%s still running (%ds elapsed, %ds remaining)", scanner_label, elapsed, int(remaining))
            last_progress_log = now
        time.sleep(min(_CONTAINER_POLL_INTERVAL_S, max(0.5, remaining)))


@dataclass
class ScannerRunSpec:
    scanner_type: str
    image: str
    workspace_dir: str
    command: list[str]
    timeout_seconds: int
    env: Dict[str, str]
    expected_exit_codes: list[int] = field(default_factory=lambda: [0])
    artifact_paths: list[str] = field(default_factory=list)
    capture_stdout_path: str | None = None
    capture_stderr_path: str | None = None
    cancel_check: Callable[[], bool] | None = field(default=None, repr=False)

    def to_serializable_dict(self) -> dict:
        d = asdict(self)
        d.pop("cancel_check", None)
        return d


@dataclass
class ScannerRunResult:
    success: bool
    container_id: str | None
    exit_code: int
    stdout_path: str | None
    stderr_path: str | None
    error: str | None


def _truncate_log_text(text: str, *, max_chars: int = MAX_RETAINED_LOG_CHARS) -> str:
    normalized = str(text or "")
    if len(normalized) <= max_chars:
        return normalized

    tail_chars = max(0, max_chars - 64)
    omitted_chars = len(normalized) - tail_chars
    return f"[truncated {omitted_chars} chars]\n{normalized[-tail_chars:]}"


def _write_retained_log(path: Path, text: str) -> str | None:
    content = _truncate_log_text(text)
    if not content.strip():
        return None

    path.write_text(content, encoding="utf-8")
    return str(path)


def _write_full_text(path: Path, text: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(text or ""), encoding="utf-8")
    return str(path)


def _ensure_workspace_artifacts(workspace_dir: str) -> tuple[Path, Path, Path]:
    workspace = Path(workspace_dir)
    logs_dir = workspace / "logs"
    meta_dir = workspace / "meta"
    logs_dir.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)
    return workspace, logs_dir, meta_dir


def _scan_workspace_root() -> Path:
    configured = str(getattr(settings, "SCAN_WORKSPACE_ROOT", "/tmp/vulhunter/scans") or "").strip()
    return Path(configured or "/tmp/vulhunter/scans")


def _scan_workspace_volume() -> str:
    configured = str(getattr(settings, "SCAN_WORKSPACE_VOLUME", "vulhunter_scan_workspace") or "").strip()
    return configured or "vulhunter_scan_workspace"


def _resolve_shared_workspace(workspace: Path) -> tuple[Path, Path]:
    workspace_root = _scan_workspace_root()
    resolved_workspace = workspace.resolve()
    resolved_root = workspace_root.resolve()
    try:
        resolved_workspace.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError(
            f"workspace_dir must stay inside shared workspace root: workspace={resolved_workspace} root={resolved_root}"
        ) from exc
    return resolved_root, resolved_workspace


def _rewrite_mount_path(value: str, workspace: Path) -> str:
    if value == SCANNER_MOUNT_PATH:
        return str(workspace)
    if value.startswith(f"{SCANNER_MOUNT_PATH}/"):
        return str(workspace / value[len(f'{SCANNER_MOUNT_PATH}/'):])
    return value


def _rewrite_runner_command(command: list[str], workspace: Path) -> list[str]:
    return [_rewrite_mount_path(part, workspace) for part in command]


def _rewrite_runner_env(env: Dict[str, str], workspace: Path) -> Dict[str, str]:
    return {key: _rewrite_mount_path(str(value), workspace) for key, value in dict(env).items()}


def run_scanner_container_sync(
    spec: ScannerRunSpec,
    *,
    on_container_started: Callable[[str], None] | None = None,
) -> ScannerRunResult:
    workspace, logs_dir, meta_dir = _ensure_workspace_artifacts(spec.workspace_dir)
    stdout_log_path = logs_dir / "stdout.log"
    stderr_log_path = logs_dir / "stderr.log"
    runner_meta_path = meta_dir / "runner.json"
    container = None
    container_id: Optional[str] = None
    expected_exit_codes = {int(code) for code in (spec.expected_exit_codes or [0])}

    try:
        workspace_root, runner_workspace = _resolve_shared_workspace(workspace)
        rewritten_command = _rewrite_runner_command(spec.command, runner_workspace)
        rewritten_env = _rewrite_runner_env(spec.env, runner_workspace)
        workspace_volume = _scan_workspace_volume()
        client = docker.from_env()
        container = client.containers.run(
            spec.image,
            rewritten_command,
            detach=True,
            auto_remove=False,
            volumes={workspace_volume: {"bind": str(workspace_root), "mode": "rw"}},
            environment=rewritten_env,
            working_dir=str(runner_workspace),
        )
        container_id = getattr(container, "id", None)
        if container_id and on_container_started is not None:
            on_container_started(container_id)
        wait_result = _poll_container_exit(
            container,
            spec.timeout_seconds,
            cancel_check=spec.cancel_check,
            scanner_label=spec.scanner_type,
        )
        exit_code = int((wait_result or {}).get("StatusCode", 1))
        stdout_text = ""
        stderr_text = ""
        if spec.capture_stdout_path is not None or exit_code != 0:
            stdout_text = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        if spec.capture_stderr_path is not None or exit_code != 0:
            stderr_text = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        retained_stdout_path: str | None = None
        retained_stderr_path: str | None = None
        captured_stdout_path: str | None = None
        captured_stderr_path: str | None = None
        if spec.capture_stdout_path:
            captured_stdout_path = _write_full_text(workspace / spec.capture_stdout_path, stdout_text)
        if spec.capture_stderr_path:
            captured_stderr_path = _write_full_text(workspace / spec.capture_stderr_path, stderr_text)
        keep_logs = exit_code != 0
        if keep_logs:
            retained_stdout_path = _write_retained_log(stdout_log_path, stdout_text)
            retained_stderr_path = _write_retained_log(stderr_log_path, stderr_text)
        log_retention = "nonzero_exit" if keep_logs else "dropped"
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": spec.to_serializable_dict(),
                    "runner_command": rewritten_command,
                    "runner_environment": rewritten_env,
                    "workspace_volume": workspace_volume,
                    "workspace_root": str(workspace_root),
                    "container_id": container_id,
                    "exit_code": exit_code,
                    "success": exit_code in expected_exit_codes,
                    "stdout_path": captured_stdout_path or retained_stdout_path,
                    "stderr_path": captured_stderr_path or retained_stderr_path,
                    "log_retention": log_retention,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=exit_code in expected_exit_codes,
            container_id=container_id,
            exit_code=exit_code,
            stdout_path=captured_stdout_path or retained_stdout_path,
            stderr_path=captured_stderr_path or retained_stderr_path,
            error=None if exit_code in expected_exit_codes else f"scanner container exited with code {exit_code}",
        )
    except TimeoutError:
        error_msg = f"scanner container timed out after {spec.timeout_seconds}s"
        stdout_text = ""
        stderr_text = ""
        if container is not None:
            try:
                container.stop(timeout=5)
            except Exception:
                pass
            try:
                stdout_text = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            except Exception:
                pass
            try:
                stderr_text = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
            except Exception:
                pass
        captured_stdout_path: str | None = None
        captured_stderr_path: str | None = None
        if spec.capture_stdout_path and stdout_text:
            try:
                captured_stdout_path = _write_full_text(workspace / spec.capture_stdout_path, stdout_text)
            except Exception:
                pass
        retained_stderr_path = _write_retained_log(stderr_log_path, f"{error_msg}\n{stderr_text}")
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": spec.to_serializable_dict(),
                    "workspace_volume": _scan_workspace_volume(),
                    "container_id": container_id,
                    "error": error_msg,
                    "success": False,
                    "stdout_path": captured_stdout_path,
                    "stderr_path": retained_stderr_path,
                    "log_retention": "timeout",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=False,
            container_id=container_id,
            exit_code=124,
            stdout_path=captured_stdout_path,
            stderr_path=retained_stderr_path,
            error=error_msg,
        )
    except ScannerCancelledError as exc:
        error_msg = str(exc)
        stdout_text = ""
        stderr_text = ""
        if container is not None:
            try:
                container.stop(timeout=5)
            except Exception:
                pass
            try:
                stdout_text = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            except Exception:
                pass
            try:
                stderr_text = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
            except Exception:
                pass
        captured_stdout_path: str | None = None
        captured_stderr_path: str | None = None
        if spec.capture_stdout_path and stdout_text:
            try:
                captured_stdout_path = _write_full_text(workspace / spec.capture_stdout_path, stdout_text)
            except Exception:
                pass
        retained_stderr_path = _write_retained_log(stderr_log_path, f"{error_msg}\n{stderr_text}")
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": spec.to_serializable_dict(),
                    "workspace_volume": _scan_workspace_volume(),
                    "container_id": container_id,
                    "error": error_msg,
                    "success": False,
                    "stdout_path": captured_stdout_path,
                    "stderr_path": retained_stderr_path,
                    "log_retention": "cancelled",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=False,
            container_id=container_id,
            exit_code=130,
            stdout_path=captured_stdout_path,
            stderr_path=retained_stderr_path,
            error=error_msg,
        )
    except DOCKER_EXCEPTION as exc:
        retained_stderr_path = _write_retained_log(stderr_log_path, str(exc))
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": spec.to_serializable_dict(),
                    "workspace_volume": _scan_workspace_volume(),
                    "container_id": container_id,
                    "error": str(exc),
                    "success": False,
                    "stdout_path": None,
                    "stderr_path": retained_stderr_path,
                    "log_retention": "failure_only",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=False,
            container_id=container_id,
            exit_code=1,
            stdout_path=None,
            stderr_path=retained_stderr_path,
            error=str(exc),
        )
    except ValueError as exc:
        retained_stderr_path = _write_retained_log(stderr_log_path, str(exc))
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": spec.to_serializable_dict(),
                    "workspace_volume": _scan_workspace_volume(),
                    "error": str(exc),
                    "success": False,
                    "stdout_path": None,
                    "stderr_path": retained_stderr_path,
                    "log_retention": "failure_only",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=False,
            container_id=None,
            exit_code=1,
            stdout_path=None,
            stderr_path=retained_stderr_path,
            error=str(exc),
        )
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except DOCKER_EXCEPTION:
                pass


async def run_scanner_container(
    spec: ScannerRunSpec,
    *,
    on_container_started: Callable[[str], None] | None = None,
) -> ScannerRunResult:
    return await asyncio.to_thread(
        run_scanner_container_sync,
        spec,
        on_container_started=on_container_started,
    )


def stop_scanner_container_sync(container_id: str) -> bool:
    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
    except DOCKER_NOT_FOUND:
        return False

    container.stop(timeout=2)
    container.remove(force=True)
    return True


async def stop_scanner_container(container_id: str) -> bool:
    return await asyncio.to_thread(stop_scanner_container_sync, container_id)
