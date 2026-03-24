from types import SimpleNamespace

import pytest

from app.services.agent.bootstrap.bandit import BanditBootstrapScanner


@pytest.mark.asyncio
async def test_bandit_bootstrap_scanner_parses_and_normalizes_findings(monkeypatch):
    stdout_payload = """{
      "results": [
        {
          "test_id": "B105",
          "test_name": "hardcoded_password_string",
          "issue_text": "Possible hardcoded password",
          "issue_severity": "HIGH",
          "issue_confidence": "HIGH",
          "filename": "src/a.py",
          "line_number": 9,
          "code": "password = 'secret'"
        },
        {
          "test_id": "B101",
          "issue_text": "assert used",
          "issue_severity": "LOW",
          "issue_confidence": "LOW",
          "filename": "src/a.py",
          "line_number": 12
        }
      ]
    }"""

    def _fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=0, stdout=stdout_payload, stderr="")

    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.subprocess.run",
        _fake_run,
    )
    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.resolve_backend_venv_executable",
        lambda name: f"/opt/backend-venv/bin/{name}",
    )

    scanner = BanditBootstrapScanner(timeout_seconds=30)
    result = await scanner.scan("/tmp/project")

    assert result.scanner_name == "bandit"
    assert result.source == "bandit_bootstrap"
    assert result.total_findings == 2
    assert len(result.findings) == 2
    assert result.findings[0].severity == "ERROR"
    assert result.findings[0].confidence == "HIGH"
    assert result.findings[1].severity == "WARNING"
    assert result.findings[1].confidence == "LOW"


@pytest.mark.asyncio
async def test_bandit_bootstrap_scanner_raises_on_invalid_json(monkeypatch):
    def _fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=0, stdout="{invalid", stderr="")

    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.subprocess.run",
        _fake_run,
    )
    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.resolve_backend_venv_executable",
        lambda name: f"/opt/backend-venv/bin/{name}",
    )

    scanner = BanditBootstrapScanner()
    with pytest.raises(RuntimeError, match="bandit output parse failed"):
        await scanner.scan("/tmp/project")


@pytest.mark.asyncio
async def test_bandit_bootstrap_scanner_raises_when_failed_without_results(monkeypatch):
    def _fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=2, stdout="", stderr="bandit command error")

    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.subprocess.run",
        _fake_run,
    )
    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.resolve_backend_venv_executable",
        lambda name: f"/opt/backend-venv/bin/{name}",
    )

    scanner = BanditBootstrapScanner()
    with pytest.raises(RuntimeError, match="bandit failed"):
        await scanner.scan("/tmp/project")


@pytest.mark.asyncio
async def test_bandit_bootstrap_scanner_supports_stderr_payload_fallback(monkeypatch):
    stderr_payload = """{
      "results": [
        {
          "test_id": "B105",
          "issue_text": "Possible hardcoded password",
          "issue_severity": "HIGH",
          "issue_confidence": "MEDIUM",
          "filename": "src/a.py",
          "line_number": 9
        }
      ]
    }"""

    def _fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=1, stdout="", stderr=stderr_payload)

    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.subprocess.run",
        _fake_run,
    )
    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.resolve_backend_venv_executable",
        lambda name: f"/opt/backend-venv/bin/{name}",
    )

    scanner = BanditBootstrapScanner()
    result = await scanner.scan("/tmp/project")
    assert result.total_findings == 1
    assert len(result.findings) == 1
    assert result.findings[0].severity == "ERROR"
    assert result.findings[0].confidence == "MEDIUM"


@pytest.mark.asyncio
async def test_bandit_bootstrap_scanner_uses_backend_venv_bandit_binary(monkeypatch):
    seen = {}

    def _fake_run(cmd, *_args, **_kwargs):
        seen["cmd"] = cmd
        return SimpleNamespace(returncode=0, stdout='{"results":[]}', stderr="")

    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.subprocess.run",
        _fake_run,
    )
    monkeypatch.setattr(
        "app.services.agent.bootstrap.bandit.resolve_backend_venv_executable",
        lambda name: f"/opt/backend-venv/bin/{name}",
    )

    scanner = BanditBootstrapScanner()
    await scanner.scan("/tmp/project")

    assert seen["cmd"][0] == "/opt/backend-venv/bin/bandit"
