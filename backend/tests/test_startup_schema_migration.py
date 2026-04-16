import sys
import types

import pytest

fastmcp_module = types.ModuleType("fastmcp")
fastmcp_module.Client = object
fastmcp_client_module = types.ModuleType("fastmcp.client")
fastmcp_transports_module = types.ModuleType("fastmcp.client.transports")
fastmcp_transports_module.StdioTransport = object
fastmcp_transports_module.StreamableHttpTransport = object
git_module = types.ModuleType("git")

sys.modules.setdefault("fastmcp", fastmcp_module)
sys.modules.setdefault("fastmcp.client", fastmcp_client_module)
sys.modules.setdefault("fastmcp.client.transports", fastmcp_transports_module)
sys.modules.setdefault("git", git_module)

from app.main import assert_database_schema_is_latest
from app.runtime.db_contract import DatabaseContractError

@pytest.mark.asyncio
async def test_assert_database_schema_is_latest_delegates_to_strict_db_contract_check(monkeypatch):
    called = []

    async def _fake_check():
        called.append("called")

    monkeypatch.setattr("app.main.check_database_contract", _fake_check)

    await assert_database_schema_is_latest()

    assert called == ["called"]


@pytest.mark.asyncio
async def test_assert_database_schema_is_latest_rejects_revision_mismatch_without_auto_upgrade(
    monkeypatch,
):
    async def _fake_check():
        raise DatabaseContractError(
            "DB_SCHEMA_MISMATCH",
            "DB_SCHEMA_MISMATCH 当前数据库不受此版本支持；请使用空库初始化或恢复匹配版本快照。",
        )

    monkeypatch.setattr("app.main.check_database_contract", _fake_check)

    with pytest.raises(DatabaseContractError, match="DB_SCHEMA_MISMATCH"):
        await assert_database_schema_is_latest()


@pytest.mark.asyncio
async def test_assert_database_schema_is_latest_rejects_database_with_multiple_recorded_versions(
    monkeypatch,
):
    async def _fake_check():
        raise DatabaseContractError(
            "DB_SCHEMA_UNSUPPORTED_STATE",
            "DB_SCHEMA_UNSUPPORTED_STATE 当前数据库不受此版本支持；请使用空库初始化或恢复匹配版本快照。",
        )

    monkeypatch.setattr("app.main.check_database_contract", _fake_check)

    with pytest.raises(DatabaseContractError, match="DB_SCHEMA_UNSUPPORTED_STATE"):
        await assert_database_schema_is_latest()
