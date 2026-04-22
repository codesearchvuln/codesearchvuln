import json
from unittest.mock import AsyncMock

import pytest

from app.services.upload import project_stats


def test_build_suffix_fallback_payload_counts_languages(tmp_path):
    src_dir = tmp_path / "src"
    src_dir.mkdir(parents=True, exist_ok=True)
    (src_dir / "main.py").write_text("print('a')\nprint('b')\n", encoding="utf-8")
    (src_dir / "app.ts").write_text("const a = 1;\n", encoding="utf-8")

    ignored_dir = tmp_path / "node_modules"
    ignored_dir.mkdir(parents=True, exist_ok=True)
    (ignored_dir / "ignore.js").write_text("console.log('skip')\n", encoding="utf-8")

    payload = project_stats._build_suffix_fallback_payload(str(tmp_path))
    parsed = json.loads(payload)

    assert parsed["total"] == 3
    assert parsed["total_files"] == 2
    assert parsed["languages"]["Python"]["loc_number"] == 2
    assert parsed["languages"]["Python"]["files_count"] == 1
    assert parsed["languages"]["TypeScript"]["loc_number"] == 1
    assert parsed["languages"]["TypeScript"]["files_count"] == 1


@pytest.mark.asyncio
async def test_get_pygount_stats_from_extracted_dir_uses_pygount_source_lines(tmp_path):
    (tmp_path / "main.py").write_text("# comment\n\nprint('pygount')\n", encoding="utf-8")
    (tmp_path / "component.tsx").write_text(
        "// comment\nexport const Demo = () => <div />;\n",
        encoding="utf-8",
    )

    payload = await project_stats.get_pygount_stats_from_extracted_dir(str(tmp_path))
    parsed = json.loads(payload)

    assert parsed["total"] == 2
    assert parsed["total_files"] == 2
    assert parsed["languages"]["Python"]["loc_number"] == 1
    assert parsed["languages"]["TypeScript"]["loc_number"] == 1


@pytest.mark.asyncio
async def test_get_pygount_stats_from_extracted_dir_uses_suffix_fallback_when_stats_empty(
    tmp_path, monkeypatch
):
    (tmp_path / "main.py").write_text("print('fallback')\n", encoding="utf-8")

    monkeypatch.setattr(
        project_stats,
        "_run_pygount_on_directory",
        AsyncMock(return_value='{"total": 0, "total_files": 0, "languages": {}}'),
    )

    payload = await project_stats.get_pygount_stats_from_extracted_dir(str(tmp_path))
    parsed = json.loads(payload)

    assert parsed["total_files"] == 1
    assert "Python" in parsed["languages"]


def test_is_non_empty_language_payload():
    assert project_stats._is_non_empty_language_payload(
        '{"total": 3, "total_files": 2, "languages": {"Python": {"loc_number": 3, "files_count": 2, "proportion": 1.0}}}'
    )
    assert not project_stats._is_non_empty_language_payload(
        '{"total": 0, "total_files": 0, "languages": {}}'
    )


def test_run_pygount_sync_uses_latin1_fallback(monkeypatch, tmp_path):
    (tmp_path / "main.py").write_text("print('fallback-encoding')\n", encoding="utf-8")

    captured: dict[str, str] = {}

    class _FakeSourceAnalysisClass:
        @staticmethod
        def from_file(source_path, group, **kwargs):
            _ = (source_path, group)
            captured["encoding"] = str(kwargs.get("encoding") or "")
            captured["fallback_encoding"] = str(kwargs.get("fallback_encoding") or "")
            return type(
                "_FakeAnalysis",
                (),
                {
                    "state": project_stats.SourceState.analyzed,
                    "language": "Python",
                    "source_count": 1,
                },
            )()

    monkeypatch.setattr(project_stats, "SourceAnalysis", _FakeSourceAnalysisClass)

    payload = project_stats._run_pygount_sync(str(tmp_path))
    parsed = json.loads(payload)
    assert parsed["total"] == 1
    assert parsed["total_files"] == 1
    assert captured["encoding"] == "automatic"
    assert captured["fallback_encoding"] == "latin-1"
