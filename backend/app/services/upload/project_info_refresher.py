import asyncio
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.projects_shared import _resolve_project_description_bundle
from app.db.session import async_session_factory
from app.models.project import Project
from app.models.project_info import ProjectInfo
from app.services.upload.upload_manager import UploadManager
from app.services.zip_storage import load_project_zip

logger = logging.getLogger(__name__)

_DEFAULT_LANGUAGE_INFO_JSON = '{"total": 0, "total_files": 0, "languages": {}}'


class ProjectInfoRefresher:
    """上传后异步刷新项目语言统计与简介。"""

    def __init__(self) -> None:
        self._running: dict[str, tuple[asyncio.Task, Optional[str]]] = {}
        self._next_expected_hash: dict[str, Optional[str]] = {}

    def enqueue(
        self,
        project_id: Optional[str],
        *,
        expected_zip_hash: Optional[str] = None,
    ) -> None:
        if not project_id:
            return

        normalized_project_id = str(project_id).strip()
        if not normalized_project_id:
            return

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                asyncio.run(
                    self._refresh(
                        normalized_project_id,
                        expected_zip_hash=expected_zip_hash,
                    )
                )
            except Exception:  # pragma: no cover - defensive logging
                logger.exception(
                    "Project info refresh failed without active event loop for %s",
                    normalized_project_id,
                )
            return

        current = self._running.get(normalized_project_id)
        if current and not current[0].done():
            self._next_expected_hash[normalized_project_id] = expected_zip_hash
            return

        self._launch(loop, normalized_project_id, expected_zip_hash)

    def _launch(
        self,
        loop: asyncio.AbstractEventLoop,
        project_id: str,
        expected_zip_hash: Optional[str],
    ) -> None:
        task_name = f"project_info_refresh:{project_id}"
        task = loop.create_task(
            self._refresh(project_id, expected_zip_hash=expected_zip_hash),
            name=task_name,
        )
        self._running[project_id] = (task, expected_zip_hash)

        def _on_done(done_task: asyncio.Task) -> None:
            _task, finished_expected_hash = self._running.pop(project_id, (done_task, None))
            try:
                done_task.exception()
            except asyncio.CancelledError:
                logger.info("Project info refresh cancelled: %s", task_name)
            except Exception:  # pragma: no cover - defensive logging
                logger.exception("Project info refresh crashed: %s", task_name)

            if project_id not in self._next_expected_hash:
                return

            next_expected_hash = self._next_expected_hash.pop(project_id)
            if next_expected_hash == finished_expected_hash:
                return
            try:
                next_loop = asyncio.get_running_loop()
            except RuntimeError:
                return
            self._launch(next_loop, project_id, next_expected_hash)

        task.add_done_callback(_on_done)

    async def _refresh(
        self,
        project_id: str,
        *,
        expected_zip_hash: Optional[str],
    ) -> None:
        initial_zip_hash = ""
        try:
            async with async_session_factory() as db:
                project = await db.get(Project, project_id)
                if not project or project.source_type != "zip":
                    return

                current_zip_hash = str(project.zip_file_hash or "")
                if expected_zip_hash and current_zip_hash != expected_zip_hash:
                    return
                initial_zip_hash = current_zip_hash

                project_info_record = await self._get_or_create_project_info(db, project_id)
                project_info_record.status = "pending"
                project_info_record.language_info = (
                    project_info_record.language_info or _DEFAULT_LANGUAGE_INFO_JSON
                )
                project_info_record.description = (
                    project_info_record.description
                    or str(project.description or "").strip()
                )
                db.add(project_info_record)
                await db.commit()
                await db.refresh(project_info_record)

                zip_path = await load_project_zip(project_id)
                if not zip_path or not os.path.exists(zip_path):
                    raise FileNotFoundError("未找到项目压缩包")

                with tempfile.TemporaryDirectory(
                    prefix="VulHunter_",
                    suffix="_project_info_refresh",
                ) as temp_dir:
                    extracted_dir = os.path.join(temp_dir, "extracted")
                    os.makedirs(extracted_dir, exist_ok=True)

                    success, extracted_files, error = await UploadManager.extract_file(
                        zip_path,
                        extracted_dir,
                        max_files=100000,
                    )
                    if not success:
                        raise RuntimeError(error or "解压失败")

                    description, language_info_json, _description_source = (
                        await _resolve_project_description_bundle(
                            extracted_dir=extracted_dir,
                            extracted_files=extracted_files,
                            project_name=project.name,
                            db=db,
                            user_id=project.owner_id,
                        )
                    )

                await db.refresh(project)
                latest_zip_hash = str(project.zip_file_hash or "")
                if expected_zip_hash and latest_zip_hash != expected_zip_hash:
                    return
                if initial_zip_hash and latest_zip_hash != initial_zip_hash:
                    return

                project.description = description
                project.updated_at = datetime.now(timezone.utc)
                project_info_record.language_info = (
                    language_info_json or _DEFAULT_LANGUAGE_INFO_JSON
                )
                project_info_record.description = description or ""
                project_info_record.status = "completed"
                db.add(project)
                db.add(project_info_record)
                await db.commit()
        except Exception as exc:
            logger.exception("Project info refresh failed for %s", project_id)
            await self._mark_failed(
                project_id,
                expected_zip_hash=expected_zip_hash,
                initial_zip_hash=initial_zip_hash,
                error=str(exc),
            )

    async def _mark_failed(
        self,
        project_id: str,
        *,
        expected_zip_hash: Optional[str],
        initial_zip_hash: str,
        error: str,
    ) -> None:
        try:
            async with async_session_factory() as db:
                project = await db.get(Project, project_id)
                if not project:
                    return

                current_zip_hash = str(project.zip_file_hash or "")
                if expected_zip_hash and current_zip_hash != expected_zip_hash:
                    return
                if initial_zip_hash and current_zip_hash != initial_zip_hash:
                    return

                project_info_record = await self._get_or_create_project_info(db, project_id)
                project_info_record.status = "failed"
                project_info_record.language_info = (
                    project_info_record.language_info or _DEFAULT_LANGUAGE_INFO_JSON
                )
                project_info_record.description = project_info_record.description or ""
                db.add(project_info_record)
                await db.commit()
        except Exception:  # pragma: no cover - defensive logging
            logger.exception(
                "Failed to persist project info failure state for %s: %s",
                project_id,
                error,
            )

    async def _get_or_create_project_info(
        self,
        db: AsyncSession,
        project_id: str,
    ) -> ProjectInfo:
        result = await db.execute(
            select(ProjectInfo).where(ProjectInfo.project_id == project_id)
        )
        project_info_record = result.scalars().first()
        if project_info_record:
            return project_info_record

        project_info_record = ProjectInfo(
            project_id=project_id,
            status="pending",
            language_info=_DEFAULT_LANGUAGE_INFO_JSON,
            description="",
            created_at=datetime.now(timezone.utc),
        )
        db.add(project_info_record)
        await db.flush()
        return project_info_record

    async def shutdown(self) -> int:
        running_tasks = [
            task
            for task, _expected_hash in list(self._running.values())
            if not task.done()
        ]
        for task in running_tasks:
            task.cancel()
        if running_tasks:
            await asyncio.gather(*running_tasks, return_exceptions=True)
        self._running.clear()
        self._next_expected_hash.clear()
        return len(running_tasks)


project_info_refresher = ProjectInfoRefresher()
