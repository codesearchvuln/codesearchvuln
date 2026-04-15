from __future__ import annotations

import json
import os
import stat
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _write_release_manifest(path: Path) -> dict[str, object]:
    manifest = {
        "revision": "deadbeefcafebabe0123456789abcdef01234567",
        "generated_at": "2026-04-13T12:00:00Z",
        "images": {
            "backend": {"ref": "ghcr.io/acme-sec/vulhunter-backend@sha256:" + "1" * 64},
            "postgres": {"ref": "ghcr.io/acme-sec/postgres@sha256:" + "a" * 64},
            "redis": {"ref": "ghcr.io/acme-sec/redis@sha256:" + "b" * 64},
            "adminer": {"ref": "ghcr.io/acme-sec/adminer@sha256:" + "c" * 64},
            "scan_workspace_init": {"ref": "ghcr.io/acme-sec/scan-workspace-init@sha256:" + "d" * 64},
            "static_frontend": {"ref": "ghcr.io/acme-sec/nginx@sha256:" + "e" * 64},
            "sandbox_runner": {"ref": "ghcr.io/acme-sec/vulhunter-sandbox-runner@sha256:" + "2" * 64},
            "scanner_yasa": {"ref": "ghcr.io/acme-sec/vulhunter-yasa-runner@sha256:" + "3" * 64},
            "scanner_opengrep": {"ref": "ghcr.io/acme-sec/vulhunter-opengrep-runner@sha256:" + "4" * 64},
            "scanner_bandit": {"ref": "ghcr.io/acme-sec/vulhunter-bandit-runner@sha256:" + "5" * 64},
            "scanner_gitleaks": {"ref": "ghcr.io/acme-sec/vulhunter-gitleaks-runner@sha256:" + "6" * 64},
            "scanner_phpstan": {"ref": "ghcr.io/acme-sec/vulhunter-phpstan-runner@sha256:" + "7" * 64},
            "scanner_pmd": {"ref": "ghcr.io/acme-sec/vulhunter-pmd-runner@sha256:" + "8" * 64},
            "flow_parser_runner": {"ref": "ghcr.io/acme-sec/vulhunter-flow-parser-runner@sha256:" + "9" * 64},
        },
    }
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def _write_frontend_bundle(path: Path) -> Path:
    site_dir = path / "site"
    nginx_dir = path / "nginx"
    site_dir.mkdir(parents=True, exist_ok=True)
    nginx_dir.mkdir(parents=True, exist_ok=True)
    (site_dir / "index.html").write_text("<!doctype html><title>release frontend</title>\n", encoding="utf-8")
    (nginx_dir / "default.conf").write_text("server { listen 80; root /usr/share/nginx/html; }\n", encoding="utf-8")
    return path


def _run_release_generator(output_dir: Path, manifest_path: Path, frontend_bundle_path: Path) -> str:
    script_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)
    result = subprocess.run(
        [
            str(script_path),
            "--output",
            str(output_dir),
            "--image-manifest",
            str(manifest_path),
            "--frontend-bundle",
            str(frontend_bundle_path),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    (output_dir / "vulhunter-services-images-amd64.tar").write_text("services-bundle\n", encoding="utf-8")
    (output_dir / "vulhunter-scanner-images-amd64.tar").write_text("scanner-bundle\n", encoding="utf-8")
    return combined_output


def _wsl_to_windows(path: Path) -> str:
    return subprocess.check_output(["wslpath", "-w", str(path)], text=True).strip()


def _windows_path_env() -> str:
    return subprocess.check_output(
        ["powershell.exe", "-NoProfile", "-Command", "[Console]::Out.Write($env:PATH)"],
        text=True,
        encoding="utf-8",
        errors="replace",
    ).strip()


def _powershell_exe() -> str:
    return subprocess.check_output(["bash", "-lc", "command -v powershell.exe"], text=True).strip()


def _write_fake_windows_tools(bin_dir: Path) -> None:
    docker_ps1 = bin_dir / "docker.ps1"
    docker_ps1.write_text(
        "Add-Content -Path $env:FAKE_DOCKER_LOG -Value ($args -join ' ')\r\n"
        "if ($args.Count -ge 2 -and $args[0] -eq 'compose' -and $args[1] -eq 'version') { exit 0 }\r\n"
        "if ($args.Count -ge 2 -and $args[0] -eq 'compose' -and $args[1] -eq 'config') {\r\n"
        "  Write-Output 'services:'\r\n"
        "  Write-Output '  backend:'\r\n"
        "  if ($env:BACKEND_IMAGE) { Write-Output ('    image: ' + $env:BACKEND_IMAGE) } else { Write-Output ('    image: ' + 'ghcr.io/acme-sec/vulhunter-backend@sha256:' + ('1' * 64)) }\r\n"
        "  Write-Output '  db:'\r\n"
        "  if ($env:POSTGRES_IMAGE) { Write-Output ('    image: ' + $env:POSTGRES_IMAGE) } else { Write-Output ('    image: ' + 'ghcr.io/acme-sec/postgres@sha256:' + ('a' * 64)) }\r\n"
        "  Write-Output '  redis:'\r\n"
        "  if ($env:REDIS_IMAGE) { Write-Output ('    image: ' + $env:REDIS_IMAGE) } else { Write-Output ('    image: ' + 'ghcr.io/acme-sec/redis@sha256:' + ('b' * 64)) }\r\n"
        "  Write-Output '  adminer:'\r\n"
        "  if ($env:ADMINER_IMAGE) { Write-Output ('    image: ' + $env:ADMINER_IMAGE) } else { Write-Output ('    image: ' + 'ghcr.io/acme-sec/adminer@sha256:' + ('c' * 64)) }\r\n"
        "  Write-Output '  scan-workspace-init:'\r\n"
        "  if ($env:SCAN_WORKSPACE_INIT_IMAGE) { Write-Output ('    image: ' + $env:SCAN_WORKSPACE_INIT_IMAGE) } else { Write-Output ('    image: ' + 'ghcr.io/acme-sec/scan-workspace-init@sha256:' + ('d' * 64)) }\r\n"
        "  Write-Output '  frontend:'\r\n"
        "  if ($env:STATIC_FRONTEND_IMAGE) { Write-Output ('    image: ' + $env:STATIC_FRONTEND_IMAGE) } else { Write-Output ('    image: ' + 'docker.m.daocloud.io/library/nginx:1.27-alpine') }\r\n"
        "  exit 0\r\n"
        "}\r\n"
        "if ($args.Count -ge 2 -and $args[0] -eq 'version' -and $args[1] -eq '--format') { Write-Output 'amd64'; exit 0 }\r\n"
        "if ($args.Count -ge 2 -and $args[0] -eq 'image' -and $args[1] -eq 'inspect') { exit 0 }\r\n"
        "if ($args.Count -ge 1 -and $args[0] -eq 'tag') { exit 0 }\r\n"
        "if ($args.Count -ge 1 -and $args[0] -eq 'load') { exit 0 }\r\n"
        "if ($args.Count -ge 2 -and $args[0] -eq 'compose' -and $args[1] -eq 'up') { exit 0 }\r\n"
        "exit 0\r\n",
        encoding="utf-8",
    )

    docker_cmd = bin_dir / "docker.cmd"
    docker_cmd.write_text(
        "@echo off\r\n"
        "echo %*>>%FAKE_DOCKER_LOG%\r\n"
        "if \"%1\"==\"compose\" if \"%2\"==\"version\" exit /b 0\r\n"
        "if \"%1\"==\"version\" if \"%2\"==\"--format\" (echo amd64& exit /b 0)\r\n"
        "if \"%1\"==\"image\" if \"%2\"==\"inspect\" exit /b 0\r\n"
        "if \"%1\"==\"tag\" exit /b 0\r\n"
        "if \"%1\"==\"load\" exit /b 0\r\n"
        "if \"%1\"==\"compose\" if \"%2\"==\"up\" exit /b 0\r\n"
        "exit /b 0\r\n",
        encoding="utf-8",
    )

    zstd_cmd = bin_dir / "zstd.cmd"
    zstd_cmd.write_text(
        "@echo off\r\n"
        "echo %*>>%FAKE_ZSTD_LOG%\r\n"
        "exit /b 0\r\n",
        encoding="utf-8",
    )


def _powershell_available() -> bool:
    return bool(subprocess.run(["bash", "-lc", "command -v powershell.exe >/dev/null"], check=False).returncode == 0)


@pytest.mark.skipif(not _powershell_available(), reason="powershell.exe not available in this environment")
def test_offline_up_powershell_bootstraps_env_and_starts_compose(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    _run_release_generator(output_dir, manifest_path, frontend_bundle_path)

    script_path = output_dir / "scripts" / "offline-up.ps1"
    env_dir = output_dir / "docker" / "env" / "backend"
    env_file = env_dir / ".env"
    offline_env_file = env_dir / "offline-images.env"
    if env_file.exists():
        env_file.unlink()
    if offline_env_file.exists():
        offline_env_file.unlink()

    fake_bin = tmp_path / "winbin"
    fake_bin.mkdir()
    _write_fake_windows_tools(fake_bin)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"

    env = os.environ.copy()
    env["PATH"] = _windows_path_env()
    command = (
        f"$env:FAKE_DOCKER_LOG='{_wsl_to_windows(docker_log)}'; "
        f"$env:FAKE_ZSTD_LOG='{_wsl_to_windows(zstd_log)}'; "
        f"$env:DOCKER_BIN='{_wsl_to_windows(fake_bin / 'docker.ps1')}'; "
        "$env:DOCKER_SERVER_ARCH='amd64'; "
        "$env:DOCKER_SOCKET_GID='1234'; "
        f"& '{_wsl_to_windows(script_path)}'"
    )

    result = subprocess.run(
        [
            _powershell_exe(),
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command,
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert env_file.exists()
    assert offline_env_file.exists()


@pytest.mark.skipif(not _powershell_available(), reason="powershell.exe not available in this environment")
def test_offline_up_powershell_preserves_crlf_env_and_requires_gid_when_missing(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    _run_release_generator(output_dir, manifest_path, frontend_bundle_path)

    script_path = output_dir / "scripts" / "offline-up.ps1"
    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_bytes(
        b"\xef\xbb\xbfRUNNER_PREFLIGHT_OFFLINE_MODE=true\r\nBACKEND_IMAGE=vulhunter-local/backend:test\r\nFOO=a=b\r\n"
    )

    fake_bin = tmp_path / "winbin"
    fake_bin.mkdir()
    _write_fake_windows_tools(fake_bin)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"

    env = os.environ.copy()
    env["PATH"] = _windows_path_env()
    command = (
        f"$env:FAKE_DOCKER_LOG='{_wsl_to_windows(docker_log)}'; "
        f"$env:FAKE_ZSTD_LOG='{_wsl_to_windows(zstd_log)}'; "
        f"$env:DOCKER_BIN='{_wsl_to_windows(fake_bin / 'docker.ps1')}'; "
        "$env:DOCKER_SERVER_ARCH='amd64'; "
        f"& '{_wsl_to_windows(script_path)}'"
    )

    result = subprocess.run(
        [
            _powershell_exe(),
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command,
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    assert result.returncode != 0
    assert "DOCKER_SOCKET_GID" in (result.stdout + result.stderr)


@pytest.mark.skipif(not _powershell_available(), reason="powershell.exe not available in this environment")
def test_offline_up_powershell_fails_when_compose_runtime_escapes_two_bundle_contract(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    _run_release_generator(output_dir, manifest_path, frontend_bundle_path)

    script_path = output_dir / "scripts" / "offline-up.ps1"
    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        "RUNNER_PREFLIGHT_OFFLINE_MODE=true\r\n"
        "BACKEND_IMAGE=vulhunter-local/backend:test\r\n",
        encoding="utf-8",
    )

    fake_bin = tmp_path / "winbin"
    fake_bin.mkdir()
    _write_fake_windows_tools(fake_bin)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"

    env = os.environ.copy()
    env["PATH"] = _windows_path_env()
    command = (
        f"$env:FAKE_DOCKER_LOG='{_wsl_to_windows(docker_log)}'; "
        f"$env:FAKE_ZSTD_LOG='{_wsl_to_windows(zstd_log)}'; "
        f"$env:DOCKER_BIN='{_wsl_to_windows(fake_bin / 'docker.ps1')}'; "
        "$env:DOCKER_SERVER_ARCH='amd64'; "
        "$env:DOCKER_SOCKET_GID='1234'; "
        f"& '{_wsl_to_windows(script_path)}'"
    )

    result = subprocess.run(
        [
            _powershell_exe(),
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command,
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    assert result.returncode != 0
    assert "STATIC_FRONTEND_IMAGE" in (result.stdout + result.stderr) or "two bundles" in (result.stdout + result.stderr) or "not covered" in (result.stdout + result.stderr)
