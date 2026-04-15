from __future__ import annotations

import json
import os
import stat
import subprocess
from pathlib import Path


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
    (nginx_dir / "default.conf").write_text(
        (
            "server {\n"
            "    listen 80;\n"
            "    root /usr/share/nginx/html;\n"
            "    location / { try_files $uri $uri/ /index.html; }\n"
            "}\n"
        ),
        encoding="utf-8",
    )
    return path


def _run_release_generator(
    output_dir: Path,
    manifest_path: Path,
    frontend_bundle_path: Path,
) -> subprocess.CompletedProcess[str]:
    script_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    return subprocess.run(
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


def _write_fake_runtime_tools(bin_dir: Path) -> None:
    docker_path = bin_dir / "docker"
    docker_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
log="${FAKE_DOCKER_LOG:?}"
printf '%s\\n' "$*" >>"$log"

if [ "${1:-}" = "compose" ] && [ "${2:-}" = "version" ]; then
  echo "Docker Compose version fake"
  exit 0
fi

if [ "${1:-}" = "compose" ] && [ "${2:-}" = "config" ]; then
  cat <<EOF
services:
  backend:
    image: ${BACKEND_IMAGE:-ghcr.io/acme-sec/vulhunter-backend@sha256:$(printf '1%.0s' {1..64})}
  db:
    image: ${POSTGRES_IMAGE:-ghcr.io/acme-sec/postgres@sha256:$(printf 'a%.0s' {1..64})}
  redis:
    image: ${REDIS_IMAGE:-ghcr.io/acme-sec/redis@sha256:$(printf 'b%.0s' {1..64})}
  adminer:
    image: ${ADMINER_IMAGE:-ghcr.io/acme-sec/adminer@sha256:$(printf 'c%.0s' {1..64})}
  scan-workspace-init:
    image: ${SCAN_WORKSPACE_INIT_IMAGE:-ghcr.io/acme-sec/scan-workspace-init@sha256:$(printf 'd%.0s' {1..64})}
  frontend:
    image: ${STATIC_FRONTEND_IMAGE:-docker.m.daocloud.io/library/nginx:1.27-alpine}
EOF
  exit 0
fi

if [ "${1:-}" = "version" ] && [ "${2:-}" = "--format" ]; then
  echo "amd64"
  exit 0
fi

if [ "${1:-}" = "image" ] && [ "${2:-}" = "inspect" ]; then
  ref="${3:-}"
  case "$ref" in
    ghcr.io/*|vulhunter-local/*)
      exit 0
      ;;
    *)
      exit 1
      ;;
  esac
fi

if [ "${1:-}" = "tag" ]; then
  exit 0
fi

if [ "${1:-}" = "load" ] || { [ "${1:-}" = "compose" ] && [ "${2:-}" = "up" ]; }; then
  exit 0
fi

exit 0
""",
        encoding="utf-8",
    )
    docker_path.chmod(docker_path.stat().st_mode | stat.S_IXUSR)

    zstd_path = bin_dir / "zstd"
    zstd_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"${FAKE_ZSTD_LOG:?}"
cat
""",
        encoding="utf-8",
    )
    zstd_path.chmod(zstd_path.stat().st_mode | stat.S_IXUSR)


def _generate_release_tree(tmp_path: Path) -> tuple[Path, dict[str, object]]:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    (output_dir / "vulhunter-services-images-amd64.tar").write_text("services-bundle\n", encoding="utf-8")
    (output_dir / "vulhunter-scanner-images-amd64.tar").write_text("scanner-bundle\n", encoding="utf-8")
    return output_dir, manifest


def test_offline_up_bash_default_flow_bootstraps_env_and_starts_compose(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_file = env_dir / ".env"
    offline_env_file = env_dir / "offline-images.env"
    if env_file.exists():
        env_file.unlink()
    if offline_env_file.exists():
        offline_env_file.unlink()

    socket_path = tmp_path / "docker.sock"
    socket_path.write_text("", encoding="utf-8")
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    _write_fake_runtime_tools(fake_bin)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)
    env["DOCKER_SOCKET_PATH"] = str(socket_path)
    env["DOCKER_SOCKET_GID"] = "1234"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert env_file.exists()
    assert offline_env_file.exists()
    docker_commands = docker_log.read_text(encoding="utf-8")
    assert "load" in docker_commands
    assert "compose up -d" in docker_commands


def test_offline_up_bash_parses_crlf_env_and_keeps_socket_values_process_local(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    offline_example = (env_dir / "offline-images.env.example").read_text(encoding="utf-8")
    offline_crlf = "\ufeff" + offline_example.replace("\n", "\r\n") + "FOO=a=b\r\n"
    (env_dir / "offline-images.env").write_text(offline_crlf, encoding="utf-8")

    before_offline_env = (env_dir / "offline-images.env").read_text(encoding="utf-8-sig")
    socket_path = tmp_path / "docker.sock"
    socket_path.write_text("", encoding="utf-8")
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    _write_fake_runtime_tools(fake_bin)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)
    env["DOCKER_SOCKET_PATH"] = str(socket_path)
    env["DOCKER_SOCKET_GID"] = "4321"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert (env_dir / "offline-images.env").read_text(encoding="utf-8-sig") == before_offline_env


def test_offline_up_bash_fails_when_compose_runtime_escapes_two_bundle_contract(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        "RUNNER_PREFLIGHT_OFFLINE_MODE=true\n"
        "BACKEND_IMAGE=vulhunter-local/backend:test\n",
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    socket_path.write_text("", encoding="utf-8")
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    _write_fake_runtime_tools(fake_bin)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)
    env["DOCKER_SOCKET_PATH"] = str(socket_path)
    env["DOCKER_SOCKET_GID"] = "1234"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "STATIC_FRONTEND_IMAGE" in combined_output or "two bundles" in combined_output or "not covered" in combined_output
