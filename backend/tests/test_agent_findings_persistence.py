from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.v1.endpoints.agent_tasks import _save_findings


@pytest.mark.asyncio
async def test_save_findings_keeps_long_text_fields_without_truncation():
    long_title = "T" * 1200
    long_description = "D" * 12000
    long_file_path = "src/" + ("very_long_path_segment/" * 80) + "vuln.py"
    long_suggestion = "S" * 9000
    long_snippet = "print('x')\n" * 3000

    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    findings = [
        {
            "title": long_title,
            "severity": "high",
            "vulnerability_type": "xss",
            "description": long_description,
            "file_path": long_file_path,
            "line_start": 10,
            "line_end": 11,
            "suggestion": long_suggestion,
            "code_snippet": long_snippet,
            "is_verified": True,
        }
    ]

    saved_count = await _save_findings(db, task_id="task-1", findings=findings, project_root=None)

    assert saved_count == 1
    db.add.assert_called_once()
    db.commit.assert_awaited_once()

    saved_finding = db.add.call_args.args[0]
    assert saved_finding.title == long_title
    assert saved_finding.description == long_description
    assert saved_finding.file_path == long_file_path
    assert saved_finding.suggestion == long_suggestion
    assert saved_finding.code_snippet == long_snippet
