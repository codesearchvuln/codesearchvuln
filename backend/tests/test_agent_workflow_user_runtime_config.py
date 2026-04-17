import json

import pytest

from app.models.user_config import UserConfig
from app.services.agent.workflow import user_runtime_config


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDb:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = []
        self.commit_calls = 0

    async def execute(self, _stmt):
        return _FakeResult(self.existing)

    def add(self, item):
        self.added.append(item)
        self.existing = item

    async def commit(self):
        self.commit_calls += 1


@pytest.mark.asyncio
async def test_load_user_agent_workflow_config_uses_local_file_defaults(
    tmp_path,
    monkeypatch,
):
    config_path = tmp_path / "config.yml"
    config_path.write_text(
        "agents:\n  recon:\n    count: 4\n  analysis:\n    count: 6\n  verification:\n    count: 2\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(user_runtime_config, "_AGENT_COUNT_CONFIG_PATH", config_path)

    loaded = await user_runtime_config.load_user_agent_workflow_config(
        _FakeDb(),
        user_id="u1",
    )

    assert loaded["recon_count"] == 4
    assert loaded["analysis_count"] == 6
    assert loaded["verification_count"] == 2
    assert loaded["default_recon_count"] == 4
    assert loaded["default_analysis_count"] == 6
    assert loaded["default_verification_count"] == 2
    assert loaded["default_source"] == "local_file"
    assert loaded["source"] == "local_file"
    assert loaded["has_user_override"] is False


@pytest.mark.asyncio
async def test_save_user_agent_workflow_config_preserves_other_config(
    tmp_path,
    monkeypatch,
):
    config_path = tmp_path / "config.yml"
    config_path.write_text(
        "agents:\n  recon:\n    count: 3\n  analysis:\n    count: 5\n  verification:\n    count: 3\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(user_runtime_config, "_AGENT_COUNT_CONFIG_PATH", config_path)

    row = UserConfig(
        user_id="u1",
        llm_config="{}",
        other_config=json.dumps({"maxAnalyzeFiles": 88}, ensure_ascii=False),
    )
    db = _FakeDb(row)

    saved = await user_runtime_config.save_user_agent_workflow_config(
        db,
        user_id="u1",
        runtime_config={
            "recon_count": 6,
            "analysis_count": 9,
            "verification_count": 4,
        },
    )

    payload = json.loads(row.other_config)
    assert payload["maxAnalyzeFiles"] == 88
    assert payload[user_runtime_config.USER_AGENT_WORKFLOW_CONFIG_KEY] == {
        "recon_count": 6,
        "analysis_count": 9,
        "verification_count": 4,
    }
    assert saved["recon_count"] == 6
    assert saved["analysis_count"] == 9
    assert saved["verification_count"] == 4
    assert saved["source"] == "user_override"
    assert saved["default_source"] == "local_file"
    assert db.commit_calls == 1
