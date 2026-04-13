import os
import socket
import subprocess
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_bootstrap(repo_root: Path) -> subprocess.CompletedProcess[str]:
    helper_path = REPO_ROOT / "scripts" / "lib" / "compose-env.sh"
    command = (
        f'set -euo pipefail\n'
        f'REPO_ROOT="{repo_root}"\n'
        f'source "{helper_path}"\n'
        f'ensure_backend_docker_env_file\n'
    )
    return subprocess.run(
        ["bash", "-lc", command],
        cwd=repo_root,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )


def _run_socket_gid_probe(repo_root: Path, socket_path: Path) -> subprocess.CompletedProcess[str]:
    helper_path = REPO_ROOT / "scripts" / "lib" / "compose-env.sh"
    command = (
        f'set -euo pipefail\n'
        f'export DOCKER_SOCKET_PATH="{socket_path}"\n'
        f'source "{helper_path}"\n'
        f'load_container_socket_gid_env\n'
        f'printf "%s" "${{DOCKER_SOCKET_GID:-}}"\n'
    )
    return subprocess.run(
        ["bash", "-lc", command],
        cwd=repo_root,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )


def test_bootstrap_copies_backend_env_example_when_env_missing(tmp_path: Path) -> None:
    env_dir = tmp_path / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True)
    example_path = env_dir / "env.example"
    env_path = env_dir / ".env"
    example_path.write_text("LLM_API_KEY=example-key\n", encoding="utf-8")

    result = _run_bootstrap(tmp_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output
    assert env_path.read_text(encoding="utf-8") == "LLM_API_KEY=example-key\n"


def test_bootstrap_keeps_existing_backend_env_file(tmp_path: Path) -> None:
    env_dir = tmp_path / "docker" / "env" / "backend"
    env_dir.mkdir(parents=True)
    example_path = env_dir / "env.example"
    env_path = env_dir / ".env"
    example_path.write_text("LLM_API_KEY=example-key\n", encoding="utf-8")
    env_path.write_text("LLM_API_KEY=real-key\n", encoding="utf-8")

    result = _run_bootstrap(tmp_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output
    assert env_path.read_text(encoding="utf-8") == "LLM_API_KEY=real-key\n"


def test_compose_env_helper_exports_docker_socket_gid(tmp_path: Path) -> None:
    socket_dir = Path(tempfile.mkdtemp(prefix="compose-env-sock-", dir="/tmp"))
    socket_path = socket_dir / "docker.sock"
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.bind(str(socket_path))
        socket_gid = socket_path.stat().st_gid
        result = _run_socket_gid_probe(tmp_path, socket_path)
    finally:
        sock.close()
        socket_path.unlink(missing_ok=True)
        socket_dir.rmdir()

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert result.stdout.strip().splitlines()[-1] == str(socket_gid)


def test_local_build_script_uses_backend_env_bootstrap_helper() -> None:
    script_text = (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8")

    assert 'source "$REPO_ROOT/scripts/lib/compose-env.sh"' in script_text
    assert "ensure_backend_docker_env_file" in script_text
    assert "load_container_socket_gid_env" in script_text


def test_compose_wrapper_uses_backend_env_bootstrap_helper() -> None:
    script_text = (REPO_ROOT / "scripts" / "compose-up-with-fallback.sh").read_text(encoding="utf-8")

    assert 'source "$REPO_ROOT/scripts/lib/compose-env.sh"' in script_text
    assert "ensure_backend_docker_env_file" in script_text
    assert "load_container_socket_gid_env" in script_text


def test_base_compose_allows_missing_backend_env_file_and_mounts_backend_env_dir() -> None:
    compose_text = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "env_file:\n      - path: ./docker/env/backend/.env\n        required: false" in compose_text
    assert "- ./docker/env/backend:/docker/env/backend" in compose_text
    assert 'group_add:\n      - "${DOCKER_SOCKET_GID:-1001}"' in compose_text


def test_local_build_overlays_keep_backend_env_dir_mount() -> None:
    hybrid_text = (REPO_ROOT / "docker-compose.hybrid.yml").read_text(encoding="utf-8")
    full_text = (REPO_ROOT / "docker-compose.full.yml").read_text(encoding="utf-8")

    assert "- ./docker/env/backend:/docker/env/backend" in hybrid_text
    assert "- ./docker/env/backend:/docker/env/backend" in full_text
    assert "group_add:" in hybrid_text and '${DOCKER_SOCKET_GID:-1001}' in hybrid_text
    assert "group_add:" in full_text and '${DOCKER_SOCKET_GID:-1001}' in full_text
