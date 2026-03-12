import os
import stat
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "compose-up-with-fallback.sh"

_EXPLICIT_MIRROR_ENV = {
    "DOCKERHUB_LIBRARY_MIRROR": "docker.m.daocloud.io/library",
    "GHCR_REGISTRY": "ghcr.nju.edu.cn",
    "BACKEND_NPM_REGISTRY_PRIMARY": "https://registry.npmmirror.com",
    "BACKEND_NPM_REGISTRY_FALLBACK": "https://registry.npmjs.org",
    "FRONTEND_NPM_REGISTRY": "https://registry.npmmirror.com",
    "FRONTEND_NPM_REGISTRY_FALLBACK": "https://registry.npmjs.org",
    "SANDBOX_NPM_REGISTRY_PRIMARY": "https://registry.npmmirror.com",
    "SANDBOX_NPM_REGISTRY_FALLBACK": "https://registry.npmjs.org",
    "BACKEND_PYPI_INDEX_PRIMARY": "https://mirrors.aliyun.com/pypi/simple/",
    "BACKEND_PYPI_INDEX_FALLBACK": "https://pypi.org/simple",
    "SANDBOX_PYPI_INDEX_PRIMARY": "https://mirrors.aliyun.com/pypi/simple/",
    "SANDBOX_PYPI_INDEX_FALLBACK": "https://pypi.org/simple",
    "BACKEND_APT_MIRROR_PRIMARY": "mirrors.aliyun.com",
    "BACKEND_APT_MIRROR_FALLBACK": "deb.debian.org",
    "BACKEND_APT_SECURITY_PRIMARY": "mirrors.aliyun.com",
    "BACKEND_APT_SECURITY_FALLBACK": "security.debian.org",
    "SANDBOX_APT_MIRROR_PRIMARY": "mirrors.aliyun.com",
    "SANDBOX_APT_MIRROR_FALLBACK": "deb.debian.org",
    "SANDBOX_APT_SECURITY_PRIMARY": "mirrors.aliyun.com",
    "SANDBOX_APT_SECURITY_FALLBACK": "security.debian.org",
}


def _write_fake_docker(bin_dir: Path) -> None:
    docker_path = bin_dir / "docker"
    docker_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "compose" ] && [ "${2:-}" = "version" ]; then
  echo "Docker Compose version fake"
  exit 0
fi

{
  printf 'COMPOSE_MENU=%s\n' "${COMPOSE_MENU-__UNSET__}"
  printf 'ARGS='
  printf '%s ' "$@"
  printf '\n'
} >>"${STUB_DOCKER_LOG:?}"
""",
        encoding="utf-8",
    )
    docker_path.chmod(docker_path.stat().st_mode | stat.S_IXUSR)


def _run_compose_wrapper(
    tmp_path: Path, args: list[str], extra_env: dict[str, str] | None = None
) -> str:
    _write_fake_docker(tmp_path)
    log_path = tmp_path / "docker-invocation.log"

    env = os.environ.copy()
    env.update(_EXPLICIT_MIRROR_ENV)
    env["PATH"] = f"{tmp_path}{os.pathsep}{env['PATH']}"
    env["PHASE_RETRY_COUNT"] = "1"
    env["STUB_DOCKER_LOG"] = str(log_path)

    if extra_env:
        env.update(extra_env)

    result = subprocess.run(
        [str(SCRIPT_PATH), *args],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    return log_path.read_text(encoding="utf-8")


def test_attached_up_disables_compose_menu_by_default(tmp_path: Path) -> None:
    log_output = _run_compose_wrapper(tmp_path, ["up", "--build"])

    assert "COMPOSE_MENU=false" in log_output
    assert "ARGS=compose up --build " in log_output


def test_attached_up_with_global_file_flags_disables_compose_menu(tmp_path: Path) -> None:
    log_output = _run_compose_wrapper(
        tmp_path, ["-f", "docker-compose.yml", "-f", "docker-compose.full.yml", "up", "--build"]
    )

    assert "COMPOSE_MENU=false" in log_output
    assert "ARGS=compose -f docker-compose.yml -f docker-compose.full.yml up --build " in log_output


def test_detached_up_keeps_compose_menu_unset(tmp_path: Path) -> None:
    log_output = _run_compose_wrapper(tmp_path, ["up", "-d", "--build"])

    assert "COMPOSE_MENU=__UNSET__" in log_output


def test_explicit_compose_menu_is_preserved(tmp_path: Path) -> None:
    log_output = _run_compose_wrapper(
        tmp_path,
        ["up", "--build"],
        extra_env={"COMPOSE_MENU": "true"},
    )

    assert "COMPOSE_MENU=true" in log_output
