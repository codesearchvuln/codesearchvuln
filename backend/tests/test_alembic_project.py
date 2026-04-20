from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
VERSIONS_DIR = BACKEND_ROOT / "alembic" / "versions"
DB_CONTRACT_FILE = BACKEND_ROOT / "app" / "runtime" / "db_contract.py"
WORKFLOW_FILE = REPO_ROOT / ".github" / "workflows" / "backend-migration-smoke.yml"


def test_repo_retires_alembic_head_based_contracts() -> None:
    revision_files = sorted(path.name for path in VERSIONS_DIR.glob("*.py"))
    db_contract_source = DB_CONTRACT_FILE.read_text(encoding="utf-8")
    workflow_text = WORKFLOW_FILE.read_text(encoding="utf-8")

    assert revision_files == []
    assert "ScriptDirectory" not in db_contract_source
    assert "get_current_head" not in db_contract_source
    assert "command.upgrade" not in db_contract_source
    assert "alembic upgrade head" not in workflow_text
    assert 'subprocess.check_output(["alembic", "current"]' not in workflow_text
    assert 'subprocess.check_output(["alembic", "heads"]' not in workflow_text
