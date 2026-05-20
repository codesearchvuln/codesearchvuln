from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.static_tasks import list_unified_findings
from app.api.v1.endpoints.static_tasks_unified_findings import (
    UnifiedFindingsSummaryBatchRequest,
    get_unified_findings_summary,
    get_unified_findings_summary_batch,
)


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


class _MappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows

    def one(self):
        return self._rows[0]


@pytest.mark.asyncio
async def test_list_unified_findings_requires_at_least_one_task_id():
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await list_unified_findings(
            opengrep_task_id=None,
            gitleaks_task_id=None,
            bandit_task_id=None,
            phpstan_task_id=None,
            yasa_task_id=None,
            pmd_task_id=None,
            page=1,
            page_size=20,
            engine=None,
            status=None,
            severity=None,
            confidence=None,
            keyword=None,
            sort_by="severity",
            sort_order="desc",
            db=db,
            current_user=SimpleNamespace(id="u-1"),
        )

    assert exc_info.value.status_code == 400
    assert "task_id" in str(exc_info.value.detail)
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_unified_findings_validates_severity_filter():
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await list_unified_findings(
            opengrep_task_id="og-1",
            gitleaks_task_id=None,
            bandit_task_id=None,
            phpstan_task_id=None,
            yasa_task_id=None,
            pmd_task_id=None,
            page=1,
            page_size=20,
            engine=None,
            status=None,
            severity="urgent",
            confidence=None,
            keyword=None,
            sort_by="severity",
            sort_order="desc",
            db=db,
            current_user=SimpleNamespace(id="u-1"),
        )

    assert exc_info.value.status_code == 400
    assert "severity" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_list_unified_findings_returns_page_payload():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarResult(2),
            _MappingsResult(
                [
                    {
                        "engine": "bandit",
                        "id": "f-1",
                        "task_id": "bd-1",
                        "rule": "B602 · subprocess_popen_with_shell_equals_true",
                        "file_path": "src/app.py",
                        "line": 9,
                        "severity": "HIGH",
                        "confidence": "LOW",
                        "status": "VERIFIED",
                    },
                    {
                        "engine": "gitleaks",
                        "id": "f-2",
                        "task_id": "gl-1",
                        "rule": "aws-access-key",
                        "file_path": ".env",
                        "line": 1,
                        "severity": "LOW",
                        "confidence": "MEDIUM",
                        "status": "open",
                    },
                ]
            ),
        ]
    )

    result = await list_unified_findings(
        opengrep_task_id=None,
        gitleaks_task_id="gl-1",
        bandit_task_id="bd-1",
        phpstan_task_id=None,
        yasa_task_id=None,
        pmd_task_id=None,
        page=2,
        page_size=10,
        engine=None,
        status=None,
        severity=None,
        confidence=None,
        keyword=None,
        sort_by="severity",
        sort_order="desc",
        db=db,
        current_user=SimpleNamespace(id="u-1"),
    )

    assert result.total == 2
    assert result.page == 2
    assert result.page_size == 10
    assert len(result.items) == 2
    assert result.items[0].engine == "bandit"
    assert result.items[0].status == "verified"
    assert result.items[1].engine == "gitleaks"
    assert result.items[1].rule == "aws-access-key"


@pytest.mark.asyncio
async def test_get_unified_findings_summary_returns_backend_aggregates():
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=_MappingsResult(
            [
                {
                    "total": 9,
                    "critical": 1,
                    "high": 2,
                    "medium": 3,
                    "low": 3,
                }
            ]
        )
    )

    result = await get_unified_findings_summary(
        opengrep_task_id="og-1",
        gitleaks_task_id=None,
        bandit_task_id="bd-1",
        phpstan_task_id=None,
        yasa_task_id=None,
        pmd_task_id=None,
        db=db,
        current_user=SimpleNamespace(id="u-1"),
    )

    assert result.total == 9
    assert result.severity_counts.critical == 1
    assert result.severity_counts.high == 2
    assert result.severity_counts.medium == 3
    assert result.severity_counts.low == 3


@pytest.mark.asyncio
async def test_get_unified_findings_summary_batch_keeps_request_order():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _MappingsResult(
                [
                    {
                        "total": 4,
                        "critical": 0,
                        "high": 1,
                        "medium": 1,
                        "low": 2,
                    }
                ]
            ),
            _MappingsResult(
                [
                    {
                        "total": 2,
                        "critical": 0,
                        "high": 0,
                        "medium": 0,
                        "low": 2,
                    }
                ]
            ),
        ]
    )

    result = await get_unified_findings_summary_batch(
        UnifiedFindingsSummaryBatchRequest(
            items=[
                {"key": "row-1", "opengrep_task_id": "og-1"},
                {"key": "row-2", "phpstan_task_id": "ps-1"},
            ]
        ),
        db=db,
        current_user=SimpleNamespace(id="u-1"),
    )

    assert [item.key for item in result.items] == ["row-1", "row-2"]
    assert result.items[0].total == 4
    assert result.items[0].severity_counts.high == 1
    assert result.items[1].total == 2
    assert result.items[1].severity_counts.low == 2
