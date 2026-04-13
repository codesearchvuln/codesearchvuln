import json
import zipfile
from pathlib import Path

import pytest
from sqlalchemy.future import select

from app.models.opengrep import OpengrepRule
from app.services.chat2rule.service import Chat2RuleService


VALID_RULE_YAML = """rules:
  - id: python-subprocess-shell-injection
    message: Detect subprocess shell=True usage
    severity: ERROR
    languages:
      - python
    pattern: subprocess.run(..., shell=True, ...)
"""


class _FakeLLMService:
    def __init__(self, user_config=None):
        self.user_config = user_config

    async def chat_completion_raw(self, messages, temperature=None, max_tokens=None):
        del temperature, max_tokens
        assert messages[0]["role"] == "system"
        assert "Opengrep 规则语法速查" in messages[0]["content"]
        assert any(
            message["role"] == "assistant"
            and "python-subprocess-shell-true" in message["content"]
            for message in messages
        )
        assert any(
            message["role"] == "assistant"
            and "javascript-unsafe-innerhtml-assignment" in message["content"]
            for message in messages
        )
        assert any(
            message["role"] == "user" and "src/app.py:2-4" in message["content"]
            for message in messages
        )
        return {
            "content": json.dumps(
                {
                    "assistant_message": "我根据当前片段生成了一版规则。",
                    "title": "python-subprocess-shell-injection",
                    "explanation": "重点覆盖 shell=True 的 subprocess 调用。",
                    "rule_text": VALID_RULE_YAML,
                }
            ),
            "usage": {
                "prompt_tokens": 12,
                "completion_tokens": 34,
                "total_tokens": 46,
            },
        }


class _FakeStreamingLLMService(_FakeLLMService):
    async def chat_completion_stream(self, messages, temperature=None, max_tokens=None):
        result = await self.chat_completion_raw(messages, temperature=temperature, max_tokens=max_tokens)
        content = result["content"]
        midpoint = max(1, len(content) // 2)
        first = content[:midpoint]
        second = content[midpoint:]
        yield {
            "type": "token",
            "content": first,
            "accumulated": first,
        }
        yield {
            "type": "token",
            "content": second,
            "accumulated": content,
        }
        yield {
            "type": "done",
            "content": content,
            "usage": result["usage"],
            "finish_reason": "stop",
        }


def _build_zip(zip_path: Path, files: dict[str, str]) -> None:
    with zipfile.ZipFile(zip_path, "w") as archive:
        for file_path, content in files.items():
            archive.writestr(file_path, content)


@pytest.mark.asyncio
async def test_generate_opengrep_draft_reads_selected_zip_snippet(monkeypatch, tmp_path):
    from app.services.chat2rule import service as service_module

    zip_path = tmp_path / "demo.zip"
    _build_zip(
        zip_path,
        {
            "src/app.py": "import subprocess\nuser_input = input()\nsubprocess.run(user_input, shell=True)\nprint('done')\n",
        },
    )

    async def _fake_load_project_zip(_project_id):
        return str(zip_path)

    monkeypatch.setattr(service_module, "LLMService", _FakeLLMService)
    monkeypatch.setattr(service_module, "load_project_zip", _fake_load_project_zip)

    service = Chat2RuleService(user_config={"llmConfig": {"llmModel": "fake"}})
    result = await service.generate_opengrep_draft(
        project_id="project-1",
        messages=[
            {
                "role": "user",
                "content": "请为这个 subprocess shell=True 场景生成规则",
            }
        ],
        selections=[{"file_path": "src/app.py", "start_line": 2, "end_line": 4}],
    )

    assert result["assistant_message"] == "我根据当前片段生成了一版规则。"
    assert result["rule_title"] == "python-subprocess-shell-injection"
    assert result["validation_result"]["valid"] is True
    assert result["validation_result"]["metadata"]["id"] == "python-subprocess-shell-injection"
    assert result["usage"]["total_tokens"] == 46


@pytest.mark.asyncio
async def test_stream_opengrep_draft_emits_partial_and_final_events(monkeypatch, tmp_path):
    from app.services.chat2rule import service as service_module

    zip_path = tmp_path / "demo.zip"
    _build_zip(
        zip_path,
        {
            "src/app.py": "import subprocess\nuser_input = input()\nsubprocess.run(user_input, shell=True)\nprint('done')\n",
        },
    )

    async def _fake_load_project_zip(_project_id):
        return str(zip_path)

    monkeypatch.setattr(service_module, "LLMService", _FakeStreamingLLMService)
    monkeypatch.setattr(service_module, "load_project_zip", _fake_load_project_zip)

    service = Chat2RuleService(user_config={"llmConfig": {"llmModel": "fake"}})
    events = [
        event
        async for event in service.stream_opengrep_draft(
            project_id="project-1",
            messages=[{"role": "user", "content": "请生成规则"}],
            selections=[{"file_path": "src/app.py", "start_line": 2, "end_line": 4}],
        )
    ]

    assert events[0]["type"] == "started"
    assert any(event["type"] == "draft" for event in events)
    assert events[-1]["type"] == "result"
    assert events[-1]["validation_result"]["valid"] is True
    assert events[-1]["rule_title"] == "python-subprocess-shell-injection"


@pytest.mark.asyncio
async def test_save_opengrep_rule_persists_rule(db):
    service = Chat2RuleService()

    result = await service.save_opengrep_rule(
        db=db,
        rule_text=VALID_RULE_YAML,
        title="python-subprocess-shell-injection",
        description="Detect shell=True usage",
    )

    assert result["language"] == "python"
    assert result["severity"] == "ERROR"

    stored = await db.execute(select(OpengrepRule).where(OpengrepRule.id == result["rule_id"]))
    rule = stored.scalar_one()
    assert rule.name == "python-subprocess-shell-injection"
    assert "shell=True" in rule.pattern_yaml


@pytest.mark.asyncio
async def test_save_opengrep_rule_rejects_duplicate_yaml(db):
    service = Chat2RuleService()

    await service.save_opengrep_rule(
        db=db,
        rule_text=VALID_RULE_YAML,
        title="python-subprocess-shell-injection",
    )

    with pytest.raises(ValueError, match="已存在"):
        await service.save_opengrep_rule(
            db=db,
            rule_text=VALID_RULE_YAML,
            title="python-subprocess-shell-injection",
        )
