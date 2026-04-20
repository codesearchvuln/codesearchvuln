from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.base import Base
from app.runtime.db_env import build_async_database_url_from_env

DB_SCHEMA_OK = "DB_SCHEMA_OK"
DB_SCHEMA_EMPTY = "DB_SCHEMA_EMPTY"
DB_SCHEMA_MISMATCH = "DB_SCHEMA_MISMATCH"
DB_SCHEMA_UNSUPPORTED_STATE = "DB_SCHEMA_UNSUPPORTED_STATE"

DATABASE_CONTRACT_UNSUPPORTED_MESSAGE = (
    "当前数据库不受此版本支持；请使用空库初始化或恢复匹配版本快照。"
)
LEGACY_VERSION_TABLE = "alembic_version"
REQUIRED_POSTGRES_EXTENSIONS = ("pg_trgm",)


@dataclass(frozen=True)
class DatabaseContractState:
    kind: str
    current_versions: set[str] = field(default_factory=set)
    expected_head: str | None = None
    public_tables: tuple[str, ...] = ()
    expected_tables: tuple[str, ...] = ()
    missing_tables: tuple[str, ...] = ()
    extra_tables: tuple[str, ...] = ()
    legacy_version_table: bool = False


class DatabaseContractError(RuntimeError):
    def __init__(self, code: str, message: str, *, state: DatabaseContractState | None = None):
        super().__init__(message)
        self.code = code
        self.state = state


def unsupported_database_contract_message(code: str = DB_SCHEMA_UNSUPPORTED_STATE) -> str:
    return f"{code} {DATABASE_CONTRACT_UNSUPPORTED_MESSAGE}"


@lru_cache(maxsize=1)
def _expected_public_tables() -> tuple[str, ...]:
    import app.models  # noqa: F401

    return tuple(sorted(name for name in Base.metadata.tables if name != LEGACY_VERSION_TABLE))


def classify_database_state(
    *,
    public_tables: tuple[str, ...],
    current_versions: set[str] | None,
    expected_head: str | None,
    expected_tables: tuple[str, ...] | None = None,
    legacy_version_table: bool = False,
) -> DatabaseContractState:
    current_versions = set(current_versions or set())
    expected_tables = tuple(sorted(expected_tables or _expected_public_tables()))

    actual_tables = set(public_tables)
    expected_table_set = set(expected_tables)
    missing_tables = tuple(sorted(expected_table_set - actual_tables))
    extra_tables = tuple(sorted(actual_tables - expected_table_set))

    if not actual_tables and not current_versions and not legacy_version_table:
        kind = DB_SCHEMA_EMPTY
    elif not missing_tables and not extra_tables:
        kind = DB_SCHEMA_OK
    elif not actual_tables and (current_versions or legacy_version_table):
        kind = DB_SCHEMA_UNSUPPORTED_STATE
    else:
        kind = DB_SCHEMA_MISMATCH

    return DatabaseContractState(
        kind=kind,
        current_versions=current_versions,
        expected_head=expected_head,
        public_tables=tuple(sorted(actual_tables)),
        expected_tables=expected_tables,
        missing_tables=missing_tables,
        extra_tables=extra_tables,
        legacy_version_table=legacy_version_table,
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
            discovered_tables = tuple(
                str(item).strip() for item in tables_result.scalars().all() if str(item).strip()
            )
            public_tables = tuple(name for name in discovered_tables if name != LEGACY_VERSION_TABLE)
            legacy_version_table = LEGACY_VERSION_TABLE in discovered_tables

            current_versions: set[str] = set()
            if legacy_version_table:
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
        expected_head=None,
        expected_tables=_expected_public_tables(),
        legacy_version_table=legacy_version_table,
    )


def _format_state_message(state: DatabaseContractState) -> str:
    if state.kind == DB_SCHEMA_EMPTY:
        return (
            f"{DB_SCHEMA_EMPTY} 数据库为空；请显式执行 bootstrap 初始化到当前版本。 "
            f"expected_tables={list(state.expected_tables)}"
        )

    details = [
        f"public_tables={list(state.public_tables)}",
        f"missing_tables={list(state.missing_tables)}",
        f"extra_tables={list(state.extra_tables)}",
    ]
    if state.current_versions or state.legacy_version_table:
        details.append(f"legacy_versions={sorted(state.current_versions)}")
        details.append(f"legacy_version_table={state.legacy_version_table}")

    return f"{state.kind} {DATABASE_CONTRACT_UNSUPPORTED_MESSAGE} " + " ".join(details)


def _raise_for_state(state: DatabaseContractState) -> None:
    if state.kind == DB_SCHEMA_OK:
        return
    raise DatabaseContractError(state.kind, _format_state_message(state), state=state)


async def check_database_contract() -> DatabaseContractState:
    state = await inspect_database_contract_state()
    _raise_for_state(state)
    return state


async def _bootstrap_database_schema() -> None:
    engine = create_async_engine(build_async_database_url_from_env(), future=True)
    try:
        async with engine.begin() as conn:
            for extension in REQUIRED_POSTGRES_EXTENSIONS:
                await conn.execute(text(f"CREATE EXTENSION IF NOT EXISTS {extension}"))

            def _create_all(sync_conn) -> None:
                import app.models  # noqa: F401

                Base.metadata.create_all(bind=sync_conn, checkfirst=True)

            await conn.run_sync(_create_all)
    finally:
        await engine.dispose()


async def bootstrap_database_contract() -> DatabaseContractState:
    state = await inspect_database_contract_state()
    if state.kind == DB_SCHEMA_OK:
        return state
    if state.kind != DB_SCHEMA_EMPTY:
        _raise_for_state(state)

    await _bootstrap_database_schema()
    final_state = await inspect_database_contract_state()
    _raise_for_state(final_state)
    return final_state


async def _run_cli(command_name: str) -> int:
    try:
        if command_name == "bootstrap":
            state = await bootstrap_database_contract()
            print(
                f"[DBContract] {state.kind} bootstrap complete: "
                f"tables={list(state.public_tables)} expected={list(state.expected_tables)}"
            )
            return 0

        state = await check_database_contract()
        print(
            f"[DBContract] {state.kind} check complete: "
            f"tables={list(state.public_tables)} expected={list(state.expected_tables)}"
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
