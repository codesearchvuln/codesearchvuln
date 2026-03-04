from pathlib import Path

from app.core.config import Settings


DEFAULT_SKILL_SOURCE_ROOTS = [
    "./data/mcp/codex-home/skills",
    "~/.agents/skills",
    "~/.codex/skills",
    "~/.codex/superpowers/skills",
]


def _expanded_defaults() -> list[str]:
    return [str(Path(item).expanduser()) for item in DEFAULT_SKILL_SOURCE_ROOTS]


def test_skill_source_roots_accepts_csv(monkeypatch):
    monkeypatch.setenv("SKILL_SOURCE_ROOTS", "/a,/b")

    settings = Settings(_env_file=None)

    assert settings.SKILL_SOURCE_ROOTS == ["/a", "/b"]


def test_skill_source_roots_accepts_json_array(monkeypatch):
    monkeypatch.setenv("SKILL_SOURCE_ROOTS", "[\"/a\",\"/b\"]")

    settings = Settings(_env_file=None)

    assert settings.SKILL_SOURCE_ROOTS == ["/a", "/b"]


def test_skill_source_roots_empty_string_uses_defaults(monkeypatch):
    monkeypatch.setenv("SKILL_SOURCE_ROOTS", "")

    settings = Settings(_env_file=None)

    assert settings.SKILL_SOURCE_ROOTS == _expanded_defaults()
