from pathlib import Path
from types import SimpleNamespace

from app.services import scanner_runner


def test_run_scanner_container_passes_mounts_env_and_command(tmp_path, monkeypatch):
    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir()
    seen = {}

    class _FakeContainer:
        id = "container-xyz"

        def wait(self, timeout=None):
            seen["wait_timeout"] = timeout
            return {"StatusCode": 0}

        def logs(self, stdout=True, stderr=False):
            if stdout and not stderr:
                return b"runner stdout"
            if stderr and not stdout:
                return b"runner stderr"
            return b""

        def remove(self, force=False):
            seen["removed"] = force

    class _FakeContainers:
        def run(self, image, command, detach, auto_remove, volumes, environment, working_dir):
            seen["image"] = image
            seen["command"] = command
            seen["detach"] = detach
            seen["auto_remove"] = auto_remove
            seen["volumes"] = volumes
            seen["environment"] = environment
            seen["working_dir"] = working_dir
            return _FakeContainer()

    monkeypatch.setattr(
        scanner_runner.docker,
        "from_env",
        lambda: SimpleNamespace(containers=_FakeContainers()),
    )

    spec = scanner_runner.ScannerRunSpec(
        scanner_type="yasa",
        image="vulhunter/yasa-runner:latest",
        workspace_dir=str(workspace_dir),
        command=["/opt/yasa/bin/yasa", "--help"],
        timeout_seconds=123,
        env={"YASA_RESOURCE_DIR": "/opt/yasa/resource"},
    )

    result = scanner_runner.run_scanner_container_sync(spec)

    assert result.success is True
    assert result.container_id == "container-xyz"
    assert result.exit_code == 0
    assert seen["image"] == "vulhunter/yasa-runner:latest"
    assert seen["command"] == ["/opt/yasa/bin/yasa", "--help"]
    assert seen["detach"] is True
    assert seen["auto_remove"] is False
    assert seen["working_dir"] == "/scan"
    assert seen["environment"] == {"YASA_RESOURCE_DIR": "/opt/yasa/resource"}
    assert seen["volumes"] == {
        str(workspace_dir): {"bind": "/scan", "mode": "rw"},
    }
    assert seen["wait_timeout"] == 123
    assert Path(result.stdout_path).read_text(encoding="utf-8") == "runner stdout"
    assert Path(result.stderr_path).read_text(encoding="utf-8") == "runner stderr"


def test_stop_scan_container_handles_missing_container_gracefully(monkeypatch):
    class _MissingContainerError(Exception):
        pass

    class _FakeContainers:
        def get(self, _container_id):
            raise scanner_runner.docker.errors.NotFound("missing")

    monkeypatch.setattr(
        scanner_runner.docker,
        "from_env",
        lambda: SimpleNamespace(containers=_FakeContainers()),
    )

    assert scanner_runner.stop_scanner_container_sync("missing-container") is False
