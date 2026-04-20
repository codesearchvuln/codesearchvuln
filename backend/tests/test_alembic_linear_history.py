from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
VERSIONS_DIR = REPO_ROOT / "backend" / "alembic" / "versions"


def test_alembic_revision_files_are_retired() -> None:
    revision_files = sorted(path.name for path in VERSIONS_DIR.glob("*.py"))

    assert revision_files == []
