from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.static_tasks import (
    get_gitleaks_finding,
    get_static_task_finding,
)


class _ScalarOneOrNoneResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _AllResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@pytest.mark.asyncio
async def test_get_static_task_finding_returns_404_when_task_not_found():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_static_task_finding(
            task_id="missing-task",
            finding_id="finding-1",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "任务不存在"


@pytest.mark.asyncio
async def test_get_static_task_finding_returns_404_when_finding_not_found_or_not_owned():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(SimpleNamespace(id="task-1")),
            _ScalarOneOrNoneResult(None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_static_task_finding(
            task_id="task-1",
            finding_id="missing-finding",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "漏洞不存在"


@pytest.mark.asyncio
async def test_get_static_task_finding_returns_enriched_finding_payload():
    finding = SimpleNamespace(
        id="finding-1",
        scan_task_id="task-1",
        rule={
            "check_id": "python.security.sql-injection",
            "extra": {
                "message": "Possible SQL injection",
                "metadata": {"references": ["https://example.com/rule"]},
            },
        },
        description="Possible SQL injection",
        file_path="src/app/db.py",
        start_line=23,
        code_snippet="query = f\"SELECT * FROM users WHERE id = {user_id}\"",
        severity="ERROR",
        status="open",
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(SimpleNamespace(id="task-1")),
            _ScalarOneOrNoneResult(finding),
            _AllResult(
                [
                    (
                        "python.security.sql-injection",
                        "HIGH",
                        ["CWE-89"],
                    )
                ]
            ),
        ]
    )

    result = await get_static_task_finding(
        task_id="task-1",
        finding_id="finding-1",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert result["id"] == "finding-1"
    assert result["scan_task_id"] == "task-1"
    assert result["confidence"] == "HIGH"
    assert result["cwe"] == ["CWE-89"]
    assert result["rule_name"] == "python.security.sql-injection"


@pytest.mark.asyncio
async def test_get_gitleaks_finding_returns_404_when_task_not_found():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_gitleaks_finding(
            task_id="missing-task",
            finding_id="finding-1",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "任务不存在"


@pytest.mark.asyncio
async def test_get_gitleaks_finding_returns_404_when_finding_not_found():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(SimpleNamespace(id="task-1")),
            _ScalarOneOrNoneResult(None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_gitleaks_finding(
            task_id="task-1",
            finding_id="missing-finding",
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "密钥泄露记录不存在"


@pytest.mark.asyncio
async def test_get_gitleaks_finding_returns_finding_payload():
    finding = SimpleNamespace(
        id="finding-1",
        scan_task_id="task-1",
        rule_id="generic-api-key",
        description="Potential API key leak",
        file_path="src/config.ts",
        start_line=8,
        end_line=8,
        secret="***",
        match="API_KEY=abcd",
        commit="abc123",
        author="Dev",
        email="dev@example.com",
        date="2026-03-01T00:00:00Z",
        fingerprint="fp-1",
        status="open",
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarOneOrNoneResult(SimpleNamespace(id="task-1")),
            _ScalarOneOrNoneResult(finding),
        ]
    )

    result = await get_gitleaks_finding(
        task_id="task-1",
        finding_id="finding-1",
        db=db,
        current_user=SimpleNamespace(id="user-1"),
    )

    assert result.id == "finding-1"
    assert result.scan_task_id == "task-1"
    assert result.rule_id == "generic-api-key"
    assert result.file_path == "src/config.ts"
