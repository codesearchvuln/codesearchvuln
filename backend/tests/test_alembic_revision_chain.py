from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
VERSIONS_DIR = REPO_ROOT / "backend" / "alembic" / "versions"


def test_alembic_revision_chain_contract_is_gone() -> None:
    assert sorted(path.name for path in VERSIONS_DIR.glob("*.py")) == []
