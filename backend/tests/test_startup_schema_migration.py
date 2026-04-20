from __future__ import annotations

import ast
from pathlib import Path


MAIN_FILE = Path(__file__).resolve().parents[1] / "app" / "main.py"


def _load_assert_database_schema_is_latest() -> ast.AsyncFunctionDef:
    module = ast.parse(MAIN_FILE.read_text(encoding="utf-8"), filename=str(MAIN_FILE))
    for node in module.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "assert_database_schema_is_latest":
            return node
    raise AssertionError("assert_database_schema_is_latest not found")


def test_assert_database_schema_is_latest_delegates_to_db_contract_check() -> None:
    function_node = _load_assert_database_schema_is_latest()
    statements = [
        statement
        for statement in function_node.body
        if not (
            isinstance(statement, ast.Expr)
            and isinstance(statement.value, ast.Constant)
            and isinstance(statement.value.value, str)
        )
    ]

    assert len(statements) == 1
    statement = statements[0]
    assert isinstance(statement, ast.Expr)
    assert isinstance(statement.value, ast.Await)
    call = statement.value.value
    assert isinstance(call, ast.Call)
    assert isinstance(call.func, ast.Name)
    assert call.func.id == "check_database_contract"
    assert not call.args
    assert not call.keywords


def test_assert_database_schema_is_latest_does_not_bootstrap_or_upgrade() -> None:
    function_source = ast.get_source_segment(MAIN_FILE.read_text(encoding="utf-8"), _load_assert_database_schema_is_latest())

    assert function_source is not None
    assert "bootstrap_database_contract" not in function_source
    assert "upgrade" not in function_source
