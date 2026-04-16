from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.runtime import db_contract


def _state(
    kind: str,
    *,
    current_versions: set[str] | None = None,
    expected_head: str | None = "head_rev",
    public_tables: tuple[str, ...] = (),
) -> db_contract.DatabaseContractState:
    return db_contract.DatabaseContractState(
        kind=kind,
        current_versions=current_versions or set(),
        expected_head=expected_head,
        public_tables=public_tables,
    )


def test_classify_database_state_accepts_empty_database() -> None:
    state = db_contract.classify_database_state(
        public_tables=(),
        current_versions=set(),
        expected_head="head_rev",
    )

    assert state.kind == db_contract.DB_SCHEMA_EMPTY


def test_classify_database_state_accepts_exact_head() -> None:
    state = db_contract.classify_database_state(
        public_tables=("projects", "users", "alembic_version"),
        current_versions={"head_rev"},
        expected_head="head_rev",
    )

    assert state.kind == db_contract.DB_SCHEMA_OK


def test_classify_database_state_marks_single_old_revision_as_mismatch() -> None:
    state = db_contract.classify_database_state(
        public_tables=("projects", "users", "alembic_version"),
        current_versions={"old_rev"},
        expected_head="head_rev",
    )

    assert state.kind == db_contract.DB_SCHEMA_MISMATCH


def test_classify_database_state_rejects_user_tables_without_alembic_version() -> None:
    state = db_contract.classify_database_state(
        public_tables=("projects", "users"),
        current_versions=set(),
        expected_head="head_rev",
    )

    assert state.kind == db_contract.DB_SCHEMA_UNSUPPORTED_STATE


def test_classify_database_state_rejects_multiple_recorded_versions() -> None:
    state = db_contract.classify_database_state(
        public_tables=("projects", "users", "alembic_version"),
        current_versions={"old_rev_a", "old_rev_b"},
        expected_head="head_rev",
    )

    assert state.kind == db_contract.DB_SCHEMA_UNSUPPORTED_STATE


@pytest.mark.asyncio
async def test_bootstrap_database_contract_runs_upgrade_only_for_empty_database(monkeypatch: pytest.MonkeyPatch) -> None:
    inspect_state = AsyncMock(
        side_effect=[
            _state(db_contract.DB_SCHEMA_EMPTY),
            _state(
                db_contract.DB_SCHEMA_OK,
                current_versions={"head_rev"},
                expected_head="head_rev",
                public_tables=("projects", "users", "alembic_version"),
            ),
        ]
    )
    upgrade = AsyncMock()

    monkeypatch.setattr(db_contract, "inspect_database_contract_state", inspect_state)
    monkeypatch.setattr(db_contract, "_upgrade_database_to_head", upgrade)

    state = await db_contract.bootstrap_database_contract()

    assert state.kind == db_contract.DB_SCHEMA_OK
    upgrade.assert_awaited_once()


@pytest.mark.asyncio
async def test_bootstrap_database_contract_is_noop_when_database_already_matches_head(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inspect_state = AsyncMock(
        return_value=_state(
            db_contract.DB_SCHEMA_OK,
            current_versions={"head_rev"},
            expected_head="head_rev",
            public_tables=("projects", "users", "alembic_version"),
        )
    )
    upgrade = AsyncMock()

    monkeypatch.setattr(db_contract, "inspect_database_contract_state", inspect_state)
    monkeypatch.setattr(db_contract, "_upgrade_database_to_head", upgrade)

    state = await db_contract.bootstrap_database_contract()

    assert state.kind == db_contract.DB_SCHEMA_OK
    upgrade.assert_not_called()


@pytest.mark.asyncio
async def test_bootstrap_database_contract_rejects_old_revision_without_upgrading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inspect_state = AsyncMock(
        return_value=_state(
            db_contract.DB_SCHEMA_MISMATCH,
            current_versions={"old_rev"},
            expected_head="head_rev",
            public_tables=("projects", "users", "alembic_version"),
        )
    )
    upgrade = AsyncMock()

    monkeypatch.setattr(db_contract, "inspect_database_contract_state", inspect_state)
    monkeypatch.setattr(db_contract, "_upgrade_database_to_head", upgrade)

    with pytest.raises(db_contract.DatabaseContractError, match=db_contract.DB_SCHEMA_MISMATCH):
        await db_contract.bootstrap_database_contract()

    upgrade.assert_not_called()


@pytest.mark.asyncio
async def test_check_database_contract_rejects_empty_database(monkeypatch: pytest.MonkeyPatch) -> None:
    inspect_state = AsyncMock(return_value=_state(db_contract.DB_SCHEMA_EMPTY))
    monkeypatch.setattr(db_contract, "inspect_database_contract_state", inspect_state)

    with pytest.raises(db_contract.DatabaseContractError, match=db_contract.DB_SCHEMA_EMPTY):
        await db_contract.check_database_contract()
