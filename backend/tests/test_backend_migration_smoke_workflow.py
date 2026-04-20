from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_backend_migration_smoke_workflow_uses_db_contract_bootstrap_and_check() -> None:
    workflow_text = (
        REPO_ROOT / ".github" / "workflows" / "backend-migration-smoke.yml"
    ).read_text(encoding="utf-8")

    assert "name: Backend DB Contract Smoke" in workflow_text
    assert "db-contract-smoke-${{ github.ref }}" in workflow_text
    assert "uses: astral-sh/setup-uv@" in workflow_text
    assert "working-directory: backend" in workflow_text
    assert "uv sync --frozen --no-dev" in workflow_text
    assert "uv run python -m app.runtime.db_contract bootstrap" in workflow_text
    assert "uv run python -m app.runtime.db_contract check" in workflow_text
    assert 'versions_dir = Path("alembic/versions")' in workflow_text
    assert "Expected no Alembic revision files" in workflow_text
    assert "uv run alembic upgrade head" not in workflow_text
    assert 'subprocess.check_output(["alembic", "current"]' not in workflow_text
    assert 'subprocess.check_output(["alembic", "heads"]' not in workflow_text
