from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Dict, Optional

import docker


SCANNER_MOUNT_PATH = "/scan"


@dataclass
class ScannerRunSpec:
    scanner_type: str
    image: str
    workspace_dir: str
    command: list[str]
    timeout_seconds: int
    env: Dict[str, str]


@dataclass
class ScannerRunResult:
    success: bool
    container_id: str | None
    exit_code: int
    stdout_path: str | None
    stderr_path: str | None
    error: str | None


def _ensure_workspace_artifacts(workspace_dir: str) -> tuple[Path, Path, Path]:
    workspace = Path(workspace_dir)
    logs_dir = workspace / "logs"
    meta_dir = workspace / "meta"
    logs_dir.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)
    return workspace, logs_dir, meta_dir


def run_scanner_container_sync(
    spec: ScannerRunSpec,
    *,
    on_container_started: Callable[[str], None] | None = None,
) -> ScannerRunResult:
    workspace, logs_dir, meta_dir = _ensure_workspace_artifacts(spec.workspace_dir)
    stdout_path = logs_dir / "stdout.log"
    stderr_path = logs_dir / "stderr.log"
    runner_meta_path = meta_dir / "runner.json"
    container = None
    container_id: Optional[str] = None

    try:
        client = docker.from_env()
        container = client.containers.run(
            spec.image,
            spec.command,
            detach=True,
            auto_remove=False,
            volumes={str(workspace): {"bind": SCANNER_MOUNT_PATH, "mode": "rw"}},
            environment=dict(spec.env),
            working_dir=SCANNER_MOUNT_PATH,
        )
        container_id = getattr(container, "id", None)
        if container_id and on_container_started is not None:
            on_container_started(container_id)
        wait_result = container.wait(timeout=max(1, int(spec.timeout_seconds)))
        exit_code = int((wait_result or {}).get("StatusCode", 1))
        stdout_text = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        stderr_text = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        stdout_path.write_text(stdout_text, encoding="utf-8")
        stderr_path.write_text(stderr_text, encoding="utf-8")
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": asdict(spec),
                    "container_id": container_id,
                    "exit_code": exit_code,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return ScannerRunResult(
            success=exit_code == 0,
            container_id=container_id,
            exit_code=exit_code,
            stdout_path=str(stdout_path),
            stderr_path=str(stderr_path),
            error=None if exit_code == 0 else f"scanner container exited with code {exit_code}",
        )
    except docker.errors.DockerException as exc:
        stderr_path.write_text(str(exc), encoding="utf-8")
        runner_meta_path.write_text(
            json.dumps(
                {
                    "spec": asdict(spec),
                    "container_id": container_id,
                    "error": str(exc),
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
            stdout_path=str(stdout_path),
            stderr_path=str(stderr_path),
            error=str(exc),
        )
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except docker.errors.DockerException:
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
    except docker.errors.NotFound:
        return False

    container.stop(timeout=2)
    container.remove(force=True)
    return True


async def stop_scanner_container(container_id: str) -> bool:
    return await asyncio.to_thread(stop_scanner_container_sync, container_id)
