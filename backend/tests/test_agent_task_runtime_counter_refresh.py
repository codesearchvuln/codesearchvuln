from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import time

import pytest

from app.api.v1.endpoints import agent_tasks_runtime as runtime_module
from app.models.agent_task import AgentFinding, FindingStatus, VulnerabilitySeverity


class _ScalarListResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _AsyncSessionContext:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_refresh_task_finding_counters_updates_agent_task_summary(monkeypatch):
    task = SimpleNamespace(
        id="task-1",
        project_id="project-1",
        findings_count=0,
        verified_count=0,
        false_positive_count=0,
        critical_count=0,
        high_count=0,
        medium_count=0,
        low_count=0,
    )
    findings = [
        AgentFinding(
            id="finding-verified",
            task_id=task.id,
            vulnerability_type="sql_injection",
            severity=VulnerabilitySeverity.HIGH,
            title="verified finding",
            description="verified",
            status=FindingStatus.VERIFIED,
            is_verified=True,
        ),
        AgentFinding(
            id="finding-pending",
            task_id=task.id,
            vulnerability_type="xss",
            severity=VulnerabilitySeverity.MEDIUM,
            title="pending finding",
            description="pending",
            status=FindingStatus.NEEDS_REVIEW,
            is_verified=False,
        ),
        AgentFinding(
            id="finding-fp",
            task_id=task.id,
            vulnerability_type="path_traversal",
            severity=VulnerabilitySeverity.CRITICAL,
            title="false positive finding",
            description="false positive",
            status=FindingStatus.FALSE_POSITIVE,
            is_verified=False,
        ),
    ]

    db = AsyncMock()
    db.get = AsyncMock(return_value=task)
    db.execute = AsyncMock(return_value=_ScalarListResult(findings))
    db.commit = AsyncMock()

    monkeypatch.setattr(
        runtime_module,
        "async_session_factory",
        lambda: _AsyncSessionContext(db),
    )
    enqueue = Mock()
    monkeypatch.setattr(runtime_module.project_metrics_refresher, "enqueue", enqueue)

    sync_state = {}
    result = await runtime_module._refresh_task_finding_counters(
        task.id,
        force=True,
        sync_state=sync_state,
        min_interval_seconds=1.0,
        reason="unit_test",
    )

    assert result["updated"] is True
    assert result["counters"] == {
        "findings_count": 2,
        "verified_count": 1,
        "false_positive_count": 1,
        "critical_count": 0,
        "high_count": 1,
        "medium_count": 1,
        "low_count": 0,
    }
    assert task.findings_count == 2
    assert task.verified_count == 1
    assert task.false_positive_count == 1
    assert task.high_count == 1
    assert task.medium_count == 1
    assert "last_task_summary_sync_monotonic" in sync_state
    assert sync_state["task_summary_refresh_pending"] is False
    db.commit.assert_awaited_once()
    enqueue.assert_called_once_with(task.project_id)


@pytest.mark.asyncio
async def test_refresh_task_finding_counters_throttles_non_forced_updates(monkeypatch):
    db = AsyncMock()
    db.get = AsyncMock()

    factory_called = {"value": False}

    def _factory():
        factory_called["value"] = True
        return _AsyncSessionContext(db)

    monkeypatch.setattr(runtime_module, "async_session_factory", _factory)

    sync_state = {
        "last_task_summary_sync_monotonic": time.monotonic(),
        "task_summary_refresh_pending": False,
    }
    result = await runtime_module._refresh_task_finding_counters(
        "task-1",
        force=False,
        sync_state=sync_state,
        min_interval_seconds=30.0,
        reason="throttled_unit_test",
    )

    assert result["updated"] is False
    assert result["reason"] == "throttled"
    assert factory_called["value"] is False
    assert sync_state["task_summary_refresh_pending"] is True
