from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.runtime.db_env import build_async_database_url_from_env

DB_SCHEMA_OK = "DB_SCHEMA_OK"
DB_SCHEMA_EMPTY = "DB_SCHEMA_EMPTY"
DB_SCHEMA_MISMATCH = "DB_SCHEMA_MISMATCH"
DB_SCHEMA_UNSUPPORTED_STATE = "DB_SCHEMA_UNSUPPORTED_STATE"

DATABASE_CONTRACT_UNSUPPORTED_MESSAGE = (
    "当前数据库不受此版本支持；请使用空库初始化或恢复匹配版本快照。"
)


@dataclass(frozen=True)
class DatabaseContractState:
    kind: str
    current_versions: set[str]
    expected_head: str | None
    public_tables: tuple[str, ...]


class DatabaseContractError(RuntimeError):
    def __init__(self, code: str, message: str, *, state: DatabaseContractState | None = None):
        super().__init__(message)
        self.code = code
        self.state = state


def unsupported_database_contract_message(code: str = DB_SCHEMA_UNSUPPORTED_STATE) -> str:
    return f"{code} {DATABASE_CONTRACT_UNSUPPORTED_MESSAGE}"


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _alembic_config() -> AlembicConfig:
    backend_root = _backend_root()
    cfg = AlembicConfig(str(backend_root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", build_async_database_url_from_env())
    return cfg


def _expected_head_from_alembic() -> str | None:
    script = ScriptDirectory.from_config(_alembic_config())
    head = str(script.get_current_head() or "").strip()
    return head or None


def classify_database_state(
    *,
    public_tables: tuple[str, ...],
    current_versions: set[str],
    expected_head: str | None,
) -> DatabaseContractState:
    if not public_tables and not current_versions:
        return DatabaseContractState(
            kind=DB_SCHEMA_EMPTY,
            current_versions=current_versions,
            expected_head=expected_head,
            public_tables=public_tables,
        )

    if not current_versions:
        return DatabaseContractState(
            kind=DB_SCHEMA_UNSUPPORTED_STATE,
            current_versions=current_versions,
            expected_head=expected_head,
            public_tables=public_tables,
        )

    if len(current_versions) != 1 or not expected_head:
        return DatabaseContractState(
            kind=DB_SCHEMA_UNSUPPORTED_STATE,
            current_versions=current_versions,
            expected_head=expected_head,
            public_tables=public_tables,
        )

    if current_versions == {expected_head}:
        return DatabaseContractState(
            kind=DB_SCHEMA_OK,
            current_versions=current_versions,
            expected_head=expected_head,
            public_tables=public_tables,
        )

    return DatabaseContractState(
        kind=DB_SCHEMA_MISMATCH,
        current_versions=current_versions,
        expected_head=expected_head,
        public_tables=public_tables,
    )


async def inspect_database_contract_state() -> DatabaseContractState:
    engine = create_async_engine(build_async_database_url_from_env(), future=True)
    try:
        async with engine.connect() as conn:
            tables_result = await conn.execute(
                text(
                    """
                    SELECT tablename
                    FROM pg_catalog.pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                    """
                )
            )
            public_tables = tuple(
                str(item).strip()
                for item in tables_result.scalars().all()
                if str(item).strip() and str(item).strip() != "alembic_version"
            )

            alembic_table_exists_result = await conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM pg_catalog.pg_tables
                        WHERE schemaname = 'public' AND tablename = 'alembic_version'
                    )
                    """
                )
            )
            alembic_table_exists = bool(alembic_table_exists_result.scalar())

            current_versions: set[str] = set()
            if alembic_table_exists:
                versions_result = await conn.execute(text("SELECT version_num FROM alembic_version"))
                current_versions = {
                    str(item).strip()
                    for item in versions_result.scalars().all()
                    if str(item).strip()
                }
    finally:
        await engine.dispose()

    return classify_database_state(
        public_tables=public_tables,
        current_versions=current_versions,
        expected_head=_expected_head_from_alembic(),
    )


def _format_state_message(state: DatabaseContractState) -> str:
    if state.kind == DB_SCHEMA_EMPTY:
        return f"{DB_SCHEMA_EMPTY} 数据库为空；请显式执行 bootstrap 初始化到当前版本。"

    if state.kind == DB_SCHEMA_MISMATCH:
        return (
            f"{DB_SCHEMA_MISMATCH} {DATABASE_CONTRACT_UNSUPPORTED_MESSAGE} "
            f"current={sorted(state.current_versions)} expected={[state.expected_head] if state.expected_head else []}"
        )

    return (
        f"{DB_SCHEMA_UNSUPPORTED_STATE} {DATABASE_CONTRACT_UNSUPPORTED_MESSAGE} "
        f"current={sorted(state.current_versions)} expected={[state.expected_head] if state.expected_head else []} "
        f"public_tables={list(state.public_tables)}"
    )


def _raise_for_state(state: DatabaseContractState) -> None:
    if state.kind == DB_SCHEMA_OK:
        return
    raise DatabaseContractError(state.kind, _format_state_message(state), state=state)


async def check_database_contract() -> DatabaseContractState:
    state = await inspect_database_contract_state()
    _raise_for_state(state)
    return state


async def _upgrade_database_to_head() -> None:
    await asyncio.to_thread(command.upgrade, _alembic_config(), "head")


async def bootstrap_database_contract() -> DatabaseContractState:
    state = await inspect_database_contract_state()
    if state.kind == DB_SCHEMA_OK:
        return state
    if state.kind != DB_SCHEMA_EMPTY:
        _raise_for_state(state)

    await _upgrade_database_to_head()
    final_state = await inspect_database_contract_state()
    _raise_for_state(final_state)
    return final_state


async def _run_cli(command_name: str) -> int:
    try:
        if command_name == "bootstrap":
            state = await bootstrap_database_contract()
            print(
                f"[DBContract] {state.kind} bootstrap complete: "
                f"current={sorted(state.current_versions)} expected={[state.expected_head] if state.expected_head else []}"
            )
            return 0

        state = await check_database_contract()
        print(
            f"[DBContract] {state.kind} check complete: "
            f"current={sorted(state.current_versions)} expected={[state.expected_head] if state.expected_head else []}"
        )
        return 0
    except DatabaseContractError as exc:
        print(f"[DBContract] {exc.code} {exc}", file=sys.stderr)
        return 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("bootstrap", "check"))
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run_cli(args.command)))


if __name__ == "__main__":
    main()
