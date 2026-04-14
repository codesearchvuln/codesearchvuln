from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.projects_crud import delete_project
from app.api.v1.endpoints.agent_tasks_routes_tasks import (
    AgentTaskStatus,
    delete_agent_task,
)


@pytest.mark.asyncio
async def test_delete_project_success():
    project = SimpleNamespace(id="project-1", source_type="zip")
    db = AsyncMock()
    db.get = AsyncMock(return_value=project)

    result = await delete_project(
        id="project-1",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert result == {"message": "项目已删除", "project_id": "project-1"}
    db.delete.assert_awaited_once_with(project)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_project_not_found():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await delete_project(
            id="missing",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_agent_task_running_cancel_then_delete(monkeypatch):
    task = SimpleNamespace(
        id="task-1",
        project_id="project-1",
        status=AgentTaskStatus.RUNNING,
    )
    project = SimpleNamespace(id="project-1")
    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])

    cancel_mock = AsyncMock()
    enqueue_mock = AsyncMock()
    monkeypatch.setattr(
        "app.api.v1.endpoints.agent_tasks_routes_tasks._cancel_agent_task_internal",
        cancel_mock,
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.agent_tasks_routes_tasks.project_metrics_refresher.enqueue",
        enqueue_mock,
    )

    result = await delete_agent_task(
        task_id="task-1",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert result == {"message": "任务已删除", "task_id": "task-1"}
    cancel_mock.assert_awaited_once_with(task, db)
    db.delete.assert_awaited_once_with(task)
    db.commit.assert_awaited_once()
    enqueue_mock.assert_called_once_with("project-1")


@pytest.mark.asyncio
async def test_delete_agent_task_terminal_without_cancel(monkeypatch):
    task = SimpleNamespace(
        id="task-1",
        project_id="project-1",
        status=AgentTaskStatus.COMPLETED,
    )
    project = SimpleNamespace(id="project-1")
    db = AsyncMock()
    db.get = AsyncMock(side_effect=[task, project])

    cancel_mock = AsyncMock()
    monkeypatch.setattr(
        "app.api.v1.endpoints.agent_tasks_routes_tasks._cancel_agent_task_internal",
        cancel_mock,
    )

    await delete_agent_task(
        task_id="task-1",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    cancel_mock.assert_not_awaited()
    db.delete.assert_awaited_once_with(task)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_agent_task_not_found():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await delete_agent_task(
            task_id="missing",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
