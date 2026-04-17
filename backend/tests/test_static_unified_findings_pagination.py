from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.static_tasks import list_unified_findings


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
