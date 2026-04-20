from __future__ import annotations

import ast
import inspect
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.runtime import db_contract


DB_CONTRACT_FILE = Path(__file__).resolve().parents[1] / "app" / "runtime" / "db_contract.py"
EXPECTED_PUBLIC_TABLES = ("projects", "users")


def _db_contract_source() -> str:
    return DB_CONTRACT_FILE.read_text(encoding="utf-8")


def _call_classify_database_state(*, public_tables: tuple[str, ...], expected_tables: tuple[str, ...]):
    signature = inspect.signature(db_contract.classify_database_state)
    kwargs: dict[str, object] = {}

    for name in signature.parameters:
        if name == "public_tables":
            kwargs[name] = public_tables
        elif name in {"expected_tables", "expected_public_tables", "model_tables"}:
            kwargs[name] = expected_tables
        elif name == "legacy_version_table":
            kwargs[name] = "alembic_version" in public_tables
        elif name == "current_versions":
            kwargs[name] = set()
        elif name == "expected_head":
            kwargs[name] = None
        else:
            raise AssertionError(f"Unhandled classify_database_state parameter: {name}")

    return db_contract.classify_database_state(**kwargs)


def test_db_contract_runtime_retires_alembic_revision_logic() -> None:
    source = _db_contract_source()

    assert "from alembic import command" not in source
    assert "from alembic.script import ScriptDirectory" not in source
    assert "get_current_head" not in source
    assert "command.upgrade" not in source
    assert "alembic_version" not in source or '!= "alembic_version"' in source
    assert "CREATE EXTENSION IF NOT EXISTS pg_trgm" in source
    assert "Base.metadata.create_all" in source


def test_classify_database_state_accepts_empty_database() -> None:
    state = _call_classify_database_state(public_tables=(), expected_tables=EXPECTED_PUBLIC_TABLES)

    assert state.kind == db_contract.DB_SCHEMA_EMPTY


def test_classify_database_state_accepts_exact_schema_match_and_ignores_alembic_version() -> None:
    state = _call_classify_database_state(
        public_tables=("alembic_version", *EXPECTED_PUBLIC_TABLES),
        expected_tables=EXPECTED_PUBLIC_TABLES,
    )

    assert state.kind == db_contract.DB_SCHEMA_OK


def test_classify_database_state_marks_non_empty_schema_drift_as_mismatch() -> None:
    state = _call_classify_database_state(
        public_tables=("projects", "users", "unexpected_table"),
        expected_tables=EXPECTED_PUBLIC_TABLES,
    )

    assert state.kind == db_contract.DB_SCHEMA_MISMATCH
    if hasattr(state, "missing_tables"):
        assert getattr(state, "missing_tables") == tuple()
    if hasattr(state, "extra_tables"):
        assert getattr(state, "extra_tables") == ("unexpected_table",)


def test_db_contract_mismatch_message_mentions_missing_and_extra_tables() -> None:
    source = _db_contract_source()

    assert "missing" in source
    assert "extra" in source


def test_bootstrap_database_contract_only_bootstraps_empty_database() -> None:
    source = _db_contract_source()
    module = ast.parse(source, filename=str(DB_CONTRACT_FILE))
    bootstrap_fn = next(
        node
        for node in module.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "bootstrap_database_contract"
    )
    bootstrap_source = ast.get_source_segment(source, bootstrap_fn)

    assert bootstrap_source is not None
    assert "DB_SCHEMA_EMPTY" in bootstrap_source
    assert "Base.metadata.create_all" in source
    assert "CREATE EXTENSION IF NOT EXISTS pg_trgm" in source
    assert "command.upgrade" not in bootstrap_source


@pytest.mark.asyncio
async def test_check_database_contract_rejects_empty_database(monkeypatch: pytest.MonkeyPatch) -> None:
    empty_state = db_contract.DatabaseContractState(
        kind=db_contract.DB_SCHEMA_EMPTY,
        public_tables=tuple(),
        **({"current_versions": set(), "expected_head": None} if "current_versions" in db_contract.DatabaseContractState.__dataclass_fields__ else {}),
        **({"expected_tables": EXPECTED_PUBLIC_TABLES} if "expected_tables" in db_contract.DatabaseContractState.__dataclass_fields__ else {}),
        **({"missing_tables": EXPECTED_PUBLIC_TABLES} if "missing_tables" in db_contract.DatabaseContractState.__dataclass_fields__ else {}),
        **({"extra_tables": tuple()} if "extra_tables" in db_contract.DatabaseContractState.__dataclass_fields__ else {}),
    )
    monkeypatch.setattr(db_contract, "inspect_database_contract_state", AsyncMock(return_value=empty_state))

    with pytest.raises(db_contract.DatabaseContractError, match=db_contract.DB_SCHEMA_EMPTY):
        await db_contract.check_database_contract()
