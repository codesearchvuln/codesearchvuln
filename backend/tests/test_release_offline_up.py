from __future__ import annotations

import hashlib
import http.server
import json
import os
import re
import socket
import stat
import subprocess
import threading
from contextlib import contextmanager
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RELEASE_PROJECT_NAME = "vulhunter-release"


def _bind_fake_unix_socket(socket_path: Path) -> None:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.bind(str(socket_path))
    finally:
        sock.close()


@contextmanager
def _serve_release_probe_endpoints(status_by_path: dict[str, int]):
    request_log: list[str] = []

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - stdlib hook
            request_log.append(self.path)
            status = status_by_path.get(self.path, 404)
            body = f"status={status}\n".encode()
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            return

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1], request_log
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


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
    assets_dir = site_dir / "assets"
    site_dir.mkdir(parents=True, exist_ok=True)
    nginx_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)
    (site_dir / "index.html").write_text(
        '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body>release frontend</body></html>\n',
        encoding="utf-8",
    )
    (assets_dir / "app.js").write_text("console.log('release frontend');\n", encoding="utf-8")
    (nginx_dir / "default.conf").write_text(
        (REPO_ROOT / "frontend" / "nginx.conf").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    return path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _expected_asset_probe_paths(index_path: Path, public_prefix: str = "/") -> list[str]:
    index_html = index_path.read_text(encoding="utf-8")
    asset_suffixes = re.findall(r'(?:src|href)="[^"]*?/(assets/[^"]+)"', index_html)
    return [f"{public_prefix}{asset_suffix}" for asset_suffix in asset_suffixes]


def _expected_nexus_bundle_probe_paths() -> list[str]:
    bundle_contracts = (
        ("nexus-web", "/nexus/"),
        ("nexus-itemDetail", "/nexus-item-detail/"),
    )
    probe_paths: list[str] = []

    for bundle_dir, public_prefix in bundle_contracts:
        probe_paths.append(public_prefix)
        probe_paths.extend(_expected_asset_probe_paths(REPO_ROOT / bundle_dir / "dist" / "index.html", public_prefix))

    return probe_paths


def _expected_release_probe_paths() -> list[str]:
    return [
        "/",
        "/assets/app.js",
        "/api/v1/openapi.json",
        "/api/v1/projects/?skip=0&limit=1&include_metrics=true",
        "/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14",
        *_expected_nexus_bundle_probe_paths(),
    ]


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


def _compose_command(*args: str, project_name: str | None = None) -> str:
    command = ["compose"]
    if project_name is not None:
        command.extend(["-p", project_name])
    command.extend(args)
    return " ".join(command)


def _read_logged_commands(log_path: Path) -> list[str]:
    if not log_path.exists():
        return []
    return [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]


def _command_index(commands: list[str], expected: str, *, start: int = 0) -> int:
    for index in range(start, len(commands)):
        if commands[index] == expected:
            return index
    raise AssertionError(f"expected command {expected!r} in order, got {commands!r}")


def _command_prefix_index(commands: list[str], prefix: str, *, start: int = 0) -> int:
    for index in range(start, len(commands)):
        if commands[index].startswith(prefix):
            return index
    raise AssertionError(f"expected command starting with {prefix!r} in order, got {commands!r}")


def _assert_command_sequence(commands: list[str], expected: list[str]) -> list[int]:
    indexes: list[int] = []
    search_from = 0
    for command in expected:
        command_index = _command_index(commands, command, start=search_from)
        indexes.append(command_index)
        search_from = command_index + 1
    return indexes


def _assert_release_cleanup_not_started(commands: list[str]) -> None:
    assert _compose_command("stop", project_name=RELEASE_PROJECT_NAME) not in commands
    assert _compose_command("down", "--remove-orphans", project_name=RELEASE_PROJECT_NAME) not in commands
    assert not any(command.startswith("image rm ") for command in commands)


def _write_fake_runtime_tools(bin_dir: Path) -> None:
    docker_path = bin_dir / "docker"
    docker_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
log="${FAKE_DOCKER_LOG:?}"
printf '%s\\n' "$*" >>"$log"

if [ "${1:-}" = "compose" ]; then
  shift
  if [ "${1:-}" = "-p" ]; then
    shift 2
  fi

  if [ "${1:-}" = "version" ]; then
    echo "Docker Compose version fake"
    exit 0
  fi

  if [ "${1:-}" = "config" ]; then
    cat <<EOF
services:
  db-bootstrap:
    image: ${BACKEND_IMAGE:-ghcr.io/acme-sec/vulhunter-backend@sha256:$(printf '1%.0s' {1..64})}
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

  if [ "${1:-}" = "ps" ]; then
    shift
    quiet="false"
    while [ $# -gt 0 ] && [[ "${1:-}" == -* ]]; do
      case "${1:-}" in
        -q|-aq|-qa)
          quiet="true"
          shift
          ;;
        -a)
          shift
          ;;
        *)
          break
          ;;
      esac
    done
    if [ "$quiet" = "true" ]; then
      case "${1:-}" in
        backend) echo fake-backend ;;
        frontend) echo fake-frontend ;;
        *) ;;
      esac
      exit 0
    fi
    echo "NAME                STATUS"
    echo "backend             running"
    echo "frontend            running"
    exit 0
  fi

  if [ "${1:-}" = "logs" ]; then
    [ -n "${FAKE_BACKEND_LOG_HINT:-}" ] && echo "${FAKE_BACKEND_LOG_HINT}"
    [ -n "${FAKE_FRONTEND_LOG_HINT:-}" ] && echo "${FAKE_FRONTEND_LOG_HINT}"
    exit 0
  fi

  if [ "${1:-}" = "pull" ]; then
    if [ "${FAKE_DOCKER_PULL_FAIL:-0}" = "1" ]; then
      echo "pull failed for release stack" >&2
      exit 1
    fi
    exit 0
  fi

  if [ "${1:-}" = "up" ] || [ "${1:-}" = "down" ] || [ "${1:-}" = "stop" ]; then
    exit 0
  fi
fi

if [ "${1:-}" = "ps" ] && [ "${2:-}" = "-aq" ] && [ "${3:-}" = "--filter" ]; then
  if [ "${FAKE_RELEASE_STACK_PS_EXIT_CODE:-0}" != "0" ]; then
    [ -n "${FAKE_RELEASE_STACK_PS_STDERR:-}" ] && echo "${FAKE_RELEASE_STACK_PS_STDERR}" >&2
    exit "${FAKE_RELEASE_STACK_PS_EXIT_CODE}"
  fi
  if [ "${FAKE_RELEASE_STACK_EMPTY:-0}" = "1" ]; then
    exit 0
  fi
  if [ "${4:-}" = "label=com.docker.compose.project=vulhunter-release" ]; then
    echo fake-backend
    echo fake-frontend
  fi
  exit 0
fi

if [ "${1:-}" = "image" ] && [ "${2:-}" = "inspect" ] && [ "${3:-}" = "--format" ]; then
  format="${4:-}"
  target="${5:-}"
  if [[ "$format" == *"org.opencontainers.image.revision"* ]]; then
    echo "${FAKE_BACKEND_IMAGE_REVISION:-deadbeefcafebabe0123456789abcdef01234567}"
    exit 0
  fi
  if [[ "$format" == *".Id"* ]]; then
    case "$target" in
      ghcr.io/acme-sec/vulhunter-backend@sha256:*) echo "sha256:target-backend" ;;
      ghcr.io/acme-sec/postgres@sha256:*) echo "sha256:target-postgres" ;;
      ghcr.io/acme-sec/redis@sha256:*) echo "sha256:target-redis" ;;
      ghcr.io/acme-sec/adminer@sha256:*) echo "sha256:target-adminer" ;;
      ghcr.io/acme-sec/scan-workspace-init@sha256:*) echo "sha256:target-scan-workspace-init" ;;
      docker.m.daocloud.io/library/nginx:1.27-alpine) echo "sha256:target-static-frontend" ;;
      ghcr.io/acme-sec/nginx@sha256:*) echo "sha256:target-static-frontend" ;;
      vulhunter-local/*) echo "sha256:${target##*/}" ;;
      *) exit 1 ;;
    esac
    exit 0
  fi
  case "$target" in
    ghcr.io/*|vulhunter-local/*)
      echo "unknown"
      exit 0
      ;;
    *)
      exit 1
      ;;
  esac
fi

if [ "${1:-}" = "inspect" ] && [ "${2:-}" = "--format" ]; then
  format="${3:-}"
  target="${4:-}"
  if [[ "$format" == *".Image"* ]]; then
    case "$target" in
      fake-backend) echo "sha256:old-backend" ;;
      fake-frontend) echo "sha256:old-frontend" ;;
      *) echo "sha256:old-unknown" ;;
    esac
    exit 0
  fi
  if [[ "$format" == *".State.Health"* ]]; then
    case "$target" in
      fake-backend) echo "${FAKE_BACKEND_HEALTH:-healthy}" ;;
      fake-frontend) echo "${FAKE_FRONTEND_HEALTH:-none}" ;;
      *) echo "unknown" ;;
    esac
    exit 0
  fi
  case "$target" in
    fake-backend) echo "${FAKE_BACKEND_STATUS:-running}" ;;
    fake-frontend) echo "${FAKE_FRONTEND_STATUS:-running}" ;;
    *) echo "unknown" ;;
  esac
  exit 0
fi

if [ "${1:-}" = "version" ] && [ "${2:-}" = "--format" ]; then
  echo "amd64"
  exit 0
fi

if [ "${1:-}" = "pull" ]; then
  if [ "${FAKE_DOCKER_PULL_FAIL:-0}" = "1" ]; then
    echo "pull failed for release stack" >&2
    exit 1
  fi
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

if [ "${1:-}" = "image" ] && [ "${2:-}" = "rm" ]; then
  if [ "${FAKE_DOCKER_IMAGE_RM_FAIL:-0}" = "1" ]; then
    echo "image still used elsewhere" >&2
    exit 1
  fi
  exit 0
fi

if [ "${1:-}" = "load" ]; then
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


def _write_fake_apt_tools(bin_dir: Path, install_bin: Path, log_path: Path) -> None:
    sudo_path = bin_dir / "sudo"
    sudo_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'sudo %s\\n' "$*" >>"${FAKE_APT_LOG:?}"
exec "$@"
""",
        encoding="utf-8",
    )
    sudo_path.chmod(sudo_path.stat().st_mode | stat.S_IXUSR)

    apt_get_path = bin_dir / "apt-get"
    apt_get_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'apt-get %s\\n' "$*" >>"${FAKE_APT_LOG:?}"
if [[ "${1:-}" == *"update"* ]] || [[ "${2:-}" == "update" ]]; then
  exit 0
fi
if printf ' %s ' "$*" | grep -q ' install '; then
  mkdir -p "${FAKE_INSTALL_BIN:?}"
  if printf ' %s ' "$*" | grep -q ' zstd '; then
    cat >"${FAKE_INSTALL_BIN}/zstd" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"${FAKE_ZSTD_LOG:?}"
cat
EOS
    chmod +x "${FAKE_INSTALL_BIN}/zstd"
  fi
  if printf ' %s ' "$*" | grep -q ' python3 '; then
    target="$(command -v python3)"
    ln -sf "$target" "${FAKE_INSTALL_BIN}/python3"
  fi
  if printf ' %s ' "$*" | grep -q ' docker-compose-v2 '; then
    exit 0
  fi
  exit 0
fi
exit 0
""",
        encoding="utf-8",
    )
    apt_get_path.chmod(apt_get_path.stat().st_mode | stat.S_IXUSR)
    log_path.touch()


def _write_os_release(path: Path, *, distro_id: str, version_id: str, codename: str) -> None:
    path.write_text(
        f'ID={distro_id}\nVERSION_ID="{version_id}"\nUBUNTU_CODENAME={codename}\nVERSION_CODENAME={codename}\n',
        encoding="utf-8",
    )


def _write_release_snapshot_lock(
    output_dir: Path,
    *,
    services_file: str = "vulhunter-services-images-amd64.tar",
    scanner_file: str = "vulhunter-scanner-images-amd64.tar",
    services_sha256: str | None = None,
    scanner_sha256: str | None = None,
    snapshot_tag: str = "snapshot-2026-04-13",
) -> Path:
    services_path = output_dir / services_file
    scanner_path = output_dir / scanner_file
    lock_payload = {
        "schema_version": 1,
        "source_sha": "deadbeefcafebabe0123456789abcdef01234567",
        "snapshot_tag": snapshot_tag,
        "release_manifest_sha256": "f" * 64,
        "bundles": {
            "services": {
                "amd64": {
                    "asset_name": services_file,
                    "bundle_sha256": services_sha256 or _sha256(services_path),
                    "revision": "deadbeefcafebabe0123456789abcdef01234567",
                    "metadata_asset_name": "images-manifest-services-amd64.json",
                }
            },
            "scanner": {
                "amd64": {
                    "asset_name": scanner_file,
                    "bundle_sha256": scanner_sha256 or _sha256(scanner_path),
                    "revision": "deadbeefcafebabe0123456789abcdef01234567",
                    "metadata_asset_name": "images-manifest-scanner-amd64.json",
                }
            }
        },
    }
    lock_path = output_dir / "release-snapshot-lock.json"
    lock_path.write_text(json.dumps(lock_payload, indent=2) + "\n", encoding="utf-8")
    return lock_path


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
    _write_release_snapshot_lock(output_dir)
    return output_dir, manifest


def test_offline_up_bash_default_flow_bootstraps_env_and_starts_compose(tmp_path: Path) -> None:
    output_dir, manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_file = env_dir / ".env"
    offline_env_file = env_dir / "offline-images.env"
    if env_file.exists():
        env_file.unlink()
    if offline_env_file.exists():
        offline_env_file.unlink()

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
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
    docker_commands = _read_logged_commands(docker_log)
    cleanup_stop = _compose_command("stop", project_name=RELEASE_PROJECT_NAME)
    cleanup_down = _compose_command("down", "--remove-orphans", project_name=RELEASE_PROJECT_NAME)
    services_load = f"load -i {output_dir / 'vulhunter-services-images-amd64.tar'}"
    scanner_load = f"load -i {output_dir / 'vulhunter-scanner-images-amd64.tar'}"
    backend_up = _compose_command(
        "up", "-d", "db", "redis", "db-bootstrap", "backend", project_name=RELEASE_PROJECT_NAME
    )
    frontend_up = _compose_command("up", "-d", "frontend", project_name=RELEASE_PROJECT_NAME)
    backend_ps = _compose_command("ps", "-q", "backend", project_name=RELEASE_PROJECT_NAME)
    frontend_ps = _compose_command("ps", "-q", "frontend", project_name=RELEASE_PROJECT_NAME)
    _assert_command_sequence(
        docker_commands,
        [
            _compose_command("version"),
            "version --format {{.Server.Arch}}",
            _compose_command("config", project_name=RELEASE_PROJECT_NAME),
            f"ps -aq --filter label=com.docker.compose.project={RELEASE_PROJECT_NAME}",
            "inspect --format {{.Image}} fake-backend",
            "inspect --format {{.Image}} fake-frontend",
            cleanup_stop,
            cleanup_down,
            "image rm sha256:old-backend",
            "image rm sha256:old-frontend",
            services_load,
            scanner_load,
            backend_up,
            backend_ps,
            frontend_up,
            frontend_ps,
        ],
    )
    assert _compose_command("up", "-d", "db", "redis", "db-bootstrap", "backend") not in docker_commands
    assert _compose_command("up", "-d", "frontend") not in docker_commands
    assert _compose_command("ps", "-q", "backend") not in docker_commands
    assert _compose_command("ps", "-q", "frontend") not in docker_commands
    assert _compose_command("exec", "-T", "frontend", "sh", "-lc") not in docker_commands
    assert any(
        "org.opencontainers.image.revision" in command
        and f'vulhunter-local/backend:{manifest["revision"]}' in command
        for command in docker_commands
    )
    assert "deprecated" in combined_output.lower()
    assert "Vulhunter-offline-bootstrap.sh --deploy" in combined_output
    assert "backend image provenance" in combined_output
    assert "所有服务已启动" in combined_output
    assert "All services are up." in combined_output
    assert f"http://localhost:{frontend_port}" in combined_output
    assert request_log == _expected_release_probe_paths()


def test_offline_up_bash_empty_release_stack_continues_without_warning(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_RELEASE_STACK_EMPTY"] = "1"

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, _request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
        result = subprocess.run(
            ["bash", str(script_path)],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
        )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert "warning: release-stack container discovery failed" not in combined_output
    assert "no existing release stack containers found" in combined_output

    docker_commands = _read_logged_commands(docker_log)
    cleanup_stop = _compose_command("stop", project_name=RELEASE_PROJECT_NAME)
    cleanup_down = _compose_command("down", "--remove-orphans", project_name=RELEASE_PROJECT_NAME)
    services_load = f"load -i {output_dir / 'vulhunter-services-images-amd64.tar'}"
    backend_up = _compose_command(
        "up", "-d", "db", "redis", "db-bootstrap", "backend", project_name=RELEASE_PROJECT_NAME
    )
    assert f"ps -aq --filter label=com.docker.compose.project={RELEASE_PROJECT_NAME}" in docker_commands
    assert cleanup_stop not in docker_commands
    assert cleanup_down in docker_commands
    assert services_load in docker_commands
    assert backend_up in docker_commands


def test_offline_up_bash_warns_and_continues_when_release_stack_discovery_is_benign_non_zero(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_RELEASE_STACK_PS_EXIT_CODE"] = "7"

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, _request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
        result = subprocess.run(
            ["bash", str(script_path)],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
        )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert "warning: release-stack container discovery failed; treating as no existing containers and continuing cleanup" in combined_output
    assert "no existing release stack containers found" in combined_output

    docker_commands = _read_logged_commands(docker_log)
    cleanup_stop = _compose_command("stop", project_name=RELEASE_PROJECT_NAME)
    cleanup_down = _compose_command("down", "--remove-orphans", project_name=RELEASE_PROJECT_NAME)
    services_load = f"load -i {output_dir / 'vulhunter-services-images-amd64.tar'}"
    backend_up = _compose_command(
        "up", "-d", "db", "redis", "db-bootstrap", "backend", project_name=RELEASE_PROJECT_NAME
    )
    assert f"ps -aq --filter label=com.docker.compose.project={RELEASE_PROJECT_NAME}" in docker_commands
    assert cleanup_stop not in docker_commands
    assert cleanup_down in docker_commands
    assert services_load in docker_commands
    assert backend_up in docker_commands
    assert "inspect --format {{.Image}} fake-backend" not in docker_commands


def test_offline_up_bash_fails_when_release_stack_discovery_reports_docker_permission_error(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_RELEASE_STACK_PS_EXIT_CODE"] = "7"
    env["FAKE_RELEASE_STACK_PS_STDERR"] = (
        "permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock"
    )

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "warning: release-stack container discovery failed" not in combined_output
    assert "permission denied" in combined_output.lower()

    docker_commands = _read_logged_commands(docker_log)
    assert _compose_command("config", project_name=RELEASE_PROJECT_NAME) in docker_commands
    _assert_release_cleanup_not_started(docker_commands)
    assert not any(command.startswith("load ") for command in docker_commands)


def test_offline_up_bash_auto_installs_missing_zstd_on_supported_ubuntu_before_bundle_load(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    apt_log = tmp_path / "apt.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_bin = tmp_path / "installed-bin"
    install_bin.mkdir()
    _write_fake_runtime_tools(fake_bin)
    _write_fake_apt_tools(fake_bin, install_bin, apt_log)
    os_release = tmp_path / "os-release"
    _write_os_release(os_release, distro_id="ubuntu", version_id="24.04", codename="noble")

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{install_bin}{os.pathsep}{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)
    env["FAKE_APT_LOG"] = str(apt_log)
    env["FAKE_INSTALL_BIN"] = str(install_bin)
    env["DOCKER_SOCKET_PATH"] = str(socket_path)
    env["DOCKER_SOCKET_GID"] = "1234"
    env["OFFLINE_UP_OS_RELEASE_PATH"] = str(os_release)
    env["OFFLINE_UP_FORCE_MISSING"] = "zstd"

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, _request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
        result = subprocess.run(
            ["bash", str(script_path)],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
        )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    apt_text = apt_log.read_text(encoding="utf-8")
    assert "apt-get" in apt_text
    assert "install -y --no-install-recommends" in apt_text
    assert "zstd" in apt_text
    assert "attempting prerequisite install via apt mirror" in combined_output
    assert (install_bin / "zstd").exists()


def test_offline_up_bash_refuses_automatic_install_on_unsupported_host(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    apt_log = tmp_path / "apt.log"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_bin = tmp_path / "installed-bin"
    install_bin.mkdir()
    _write_fake_runtime_tools(fake_bin)
    _write_fake_apt_tools(fake_bin, install_bin, apt_log)
    os_release = tmp_path / "os-release"
    _write_os_release(os_release, distro_id="debian", version_id="12", codename="bookworm")

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{install_bin}{os.pathsep}{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)
    env["FAKE_APT_LOG"] = str(apt_log)
    env["FAKE_INSTALL_BIN"] = str(install_bin)
    env["DOCKER_SOCKET_PATH"] = str(socket_path)
    env["DOCKER_SOCKET_GID"] = "1234"
    env["OFFLINE_UP_OS_RELEASE_PATH"] = str(os_release)
    env["OFFLINE_UP_FORCE_MISSING"] = "zstd"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "unsupported host for automatic prerequisite installation" in combined_output
    assert apt_log.read_text(encoding="utf-8") == ""
    assert not zstd_log.exists() or zstd_log.read_text(encoding="utf-8") == ""


def test_offline_up_bash_fails_when_backend_image_revision_label_does_not_match_release_revision(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_BACKEND_IMAGE_REVISION"] = "stale-revision"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "backend image provenance mismatch" in combined_output


def test_offline_up_bash_allows_backend_revision_mismatch_for_resolved_fallback_manifest(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"
    services_metadata_path = output_dir / "images-manifest-services.json"
    services_metadata = json.loads(services_metadata_path.read_text(encoding="utf-8"))
    services_metadata["backend_provenance_mode"] = "resolved_fallback"
    services_metadata["backend_provenance_source_tag"] = "ghcr.io/acme-sec/vulhunter-backend:latest"
    services_metadata_path.write_text(json.dumps(services_metadata, indent=2) + "\n", encoding="utf-8")

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_BACKEND_IMAGE_REVISION"] = "stale-revision"
    env["OFFLINE_UP_MAX_ATTEMPTS"] = "1"
    env["OFFLINE_UP_RETRY_DELAY_SECONDS"] = "0"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "backend image provenance mismatch allowed in resolved_fallback mode" in combined_output
    assert "backend image provenance mismatch: expected" not in combined_output


def test_offline_up_bash_fails_when_backend_image_revision_label_is_missing(
    tmp_path: Path,
) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_BACKEND_IMAGE_REVISION"] = "<no value>"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "backend image provenance missing" in combined_output


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
    _bind_fake_unix_socket(socket_path)
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

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, _request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
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


def test_offline_up_bash_attach_logs_mode_runs_foreground_compose_up(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, _request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
        result = subprocess.run(
            ["bash", str(script_path), "--attach-logs"],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
        )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    docker_commands = _read_logged_commands(docker_log)
    cleanup_stop = _compose_command("stop", project_name=RELEASE_PROJECT_NAME)
    cleanup_down = _compose_command("down", "--remove-orphans", project_name=RELEASE_PROJECT_NAME)
    services_load = f"load -i {output_dir / 'vulhunter-services-images-amd64.tar'}"
    scanner_load = f"load -i {output_dir / 'vulhunter-scanner-images-amd64.tar'}"
    _assert_command_sequence(
        docker_commands,
        [
            _compose_command("config", project_name=RELEASE_PROJECT_NAME),
            f"ps -aq --filter label=com.docker.compose.project={RELEASE_PROJECT_NAME}",
            "inspect --format {{.Image}} fake-backend",
            "inspect --format {{.Image}} fake-frontend",
            cleanup_stop,
            cleanup_down,
            "image rm sha256:old-backend",
            "image rm sha256:old-frontend",
            services_load,
            scanner_load,
            _compose_command(
                "up", "-d", "db", "redis", "db-bootstrap", "backend", project_name=RELEASE_PROJECT_NAME
            ),
            _compose_command("up", project_name=RELEASE_PROJECT_NAME),
        ],
    )
    assert _compose_command("up", "-d", "frontend", project_name=RELEASE_PROJECT_NAME) not in docker_commands
    assert _compose_command("up", "-d", "db", "redis", "db-bootstrap", "backend") not in docker_commands
    assert not any("http://127.0.0.1/api/v1/openapi.json" in line for line in docker_commands)
    assert "deprecated" in combined_output.lower()
    assert "Vulhunter-offline-bootstrap.sh --deploy" in combined_output
    assert combined_output.count("所有服务已启动") == 1
    assert combined_output.count("All services are up.") == 1


def test_offline_up_bash_rejects_bootstrap_only_maintenance_flags(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    for flag in ("--stop", "--cleanup", "--cleanup-all"):
        result = subprocess.run(
            ["bash", str(script_path), flag],
            cwd=tmp_path,
            capture_output=True,
            text=True,
        )
        combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
        assert result.returncode != 0
        assert "Vulhunter-offline-bootstrap.sh" in combined_output
        assert "bootstrap" in combined_output.lower()


def test_release_tree_omits_online_up_script(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)

    assert not (output_dir / "scripts" / "online-up.sh").exists()


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
    _bind_fake_unix_socket(socket_path)
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
    docker_commands = _read_logged_commands(docker_log)
    assert _compose_command("config", project_name=RELEASE_PROJECT_NAME) in docker_commands
    _assert_release_cleanup_not_started(docker_commands)
    assert not any(command.startswith("load ") for command in docker_commands)
    assert _compose_command("up", "-d", "db", "redis", "db-bootstrap", "backend", project_name=RELEASE_PROJECT_NAME) not in docker_commands


def test_offline_up_bash_fails_prevalidation_before_load_when_lock_bundle_name_is_wrong(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"
    _write_release_snapshot_lock(
        output_dir,
        services_file="vulhunter-services-images-amd64.tar.zst",
        services_sha256=_sha256(output_dir / "vulhunter-services-images-amd64.tar"),
    )

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    assert "snapshot-2026-04-13" in combined_output
    assert "services" in combined_output
    assert "vulhunter-services-images-amd64.tar.zst" in combined_output
    docker_commands = _read_logged_commands(docker_log)
    assert "version --format {{.Server.Arch}}" in docker_commands
    _assert_release_cleanup_not_started(docker_commands)
    assert not any(command.startswith("load ") for command in docker_commands)


def test_offline_up_bash_fails_prevalidation_before_load_when_lock_checksum_mismatches(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"
    _write_release_snapshot_lock(
        output_dir,
        scanner_sha256="0" * 64,
    )

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    assert "snapshot-2026-04-13" in combined_output
    assert "scanner" in combined_output
    assert "checksum" in combined_output
    docker_commands = _read_logged_commands(docker_log)
    assert "version --format {{.Server.Arch}}" in docker_commands
    _assert_release_cleanup_not_started(docker_commands)
    assert not any(command.startswith("load ") for command in docker_commands)


def test_offline_up_bash_fails_prevalidation_before_load_when_current_arch_entry_is_missing(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    lock_path = output_dir / "release-snapshot-lock.json"
    lock_payload = json.loads(lock_path.read_text(encoding="utf-8"))
    lock_payload["bundles"]["scanner"].pop("amd64")
    lock_path.write_text(json.dumps(lock_payload, indent=2) + "\n", encoding="utf-8")

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    assert "scanner/amd64" in combined_output
    assert "snapshot unknown" in combined_output or "missing bundles/scanner/amd64" in combined_output
    docker_commands = _read_logged_commands(docker_log)
    assert "version --format {{.Server.Arch}}" in docker_commands
    _assert_release_cleanup_not_started(docker_commands)
    assert not any(command.startswith("load ") for command in docker_commands)


def test_offline_up_bash_fails_when_release_readiness_probes_do_not_turn_green(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_BACKEND_LOG_HINT"] = "offline runner image unavailable"
    env["FAKE_FRONTEND_LOG_HINT"] = "Docker socket access was denied"
    env["OFFLINE_UP_MAX_ATTEMPTS"] = "1"
    env["OFFLINE_UP_RETRY_DELAY_SECONDS"] = "0"

    status_by_path = dict.fromkeys(_expected_release_probe_paths(), 200)
    status_by_path["/api/v1/openapi.json"] = 502
    status_by_path["/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"] = 403
    with _serve_release_probe_endpoints(status_by_path) as (frontend_port, request_log):
        env["VULHUNTER_FRONTEND_PORT"] = str(frontend_port)
        result = subprocess.run(
            ["bash", str(script_path)],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
        )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "release readiness probe failed" in combined_output
    assert "openapi.json" in combined_output
    assert "502" in combined_output
    assert "dashboard-snapshot" in combined_output
    assert "offline runner image unavailable" in combined_output
    assert "Docker socket access was denied" in combined_output
    docker_commands = _read_logged_commands(docker_log)
    assert _compose_command("exec", "-T", "frontend", "sh", "-lc") not in docker_commands
    assert _compose_command("ps", project_name=RELEASE_PROJECT_NAME) in docker_commands
    assert (
        _compose_command(
            "logs",
            "db",
            "redis",
            "scan-workspace-init",
            "db-bootstrap",
            "backend",
            "frontend",
            "--tail=100",
            project_name=RELEASE_PROJECT_NAME,
        )
        in docker_commands
    )
    assert request_log == _expected_release_probe_paths()


def test_offline_up_bash_backend_readiness_failure_collects_dependency_logs(tmp_path: Path) -> None:
    output_dir, _manifest = _generate_release_tree(tmp_path)
    script_path = output_dir / "scripts" / "offline-up.sh"

    env_dir = output_dir / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / ".env").write_text("LLM_API_KEY=test\n", encoding="utf-8")
    (env_dir / "offline-images.env").write_text(
        (env_dir / "offline-images.env.example").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    socket_path = tmp_path / "docker.sock"
    _bind_fake_unix_socket(socket_path)
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
    env["FAKE_BACKEND_HEALTH"] = "unhealthy"
    env["OFFLINE_UP_MAX_ATTEMPTS"] = "1"
    env["OFFLINE_UP_RETRY_DELAY_SECONDS"] = "0"

    result = subprocess.run(
        ["bash", str(script_path)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "release readiness probe failed" in combined_output
    docker_commands = _read_logged_commands(docker_log)
    assert (
        _compose_command(
            "logs",
            "db",
            "redis",
            "scan-workspace-init",
            "db-bootstrap",
            "backend",
            "frontend",
            "--tail=100",
            project_name=RELEASE_PROJECT_NAME,
        )
        in docker_commands
    )
