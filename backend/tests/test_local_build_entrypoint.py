import os
import stat
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_backend_dockerfile_derives_docker_cli_image_from_selected_mirror() -> None:
    dockerfile_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")

    assert "ARG DOCKER_CLI_IMAGE=${DOCKERHUB_LIBRARY_MIRROR}/docker:cli" in dockerfile_text
    assert "ARG DOCKER_CLI_IMAGE=docker.m.daocloud.io/docker:cli" not in dockerfile_text


def test_backend_runtime_uses_unar_instead_of_unrar_free_for_rar_archives() -> None:
    dockerfile_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")
    template_text = (
        REPO_ROOT / "scripts" / "sourcecode-templates" / "Dockerfile"
    ).read_text(encoding="utf-8")

    for text in (dockerfile_text, template_text):
        assert "  unar \\" in text
        assert "unrar-free" not in text


def test_backend_dockerfile_uses_probe_ranked_pypi_before_configured_fallbacks() -> None:
    import re
    dockerfile_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")

    assert (
        "ARG BACKEND_PYPI_INDEX_PRIMARY=https://mirrors.huaweicloud.com/repository/pypi/simple/"
        in dockerfile_text
    )
    # Property-based assertion: timeout must be between 30s and 600s (not literal-coupled to default)
    timeout_match = re.search(r'ARG BACKEND_UV_STEP_TIMEOUT_SECONDS=(\d+)', dockerfile_text)
    assert timeout_match is not None, "BACKEND_UV_STEP_TIMEOUT_SECONDS not found"
    timeout_val = int(timeout_match.group(1))
    assert 30 <= timeout_val <= 600, f"timeout {timeout_val} out of range [30, 600]"

    assert "ARG BACKEND_UV_ATTEMPTS_PER_INDEX=1" in dockerfile_text
    assert 'configured_primary="${BACKEND_PYPI_INDEX_PRIMARY:-' in dockerfile_text
    assert 'configured_fallback="${BACKEND_PYPI_INDEX_FALLBACK:-}"' in dockerfile_text
    assert '"${ordered}" "${configured_primary}" "${configured_fallback}"' in dockerfile_text
    assert "| awk 'NF {print; exit}')" in dockerfile_text
    assert "Selected PyPI index: ${best_index}" in dockerfile_text
    assert 'UV_CONCURRENT_DOWNLOADS="${uv_concurrent_downloads}"' in dockerfile_text
    assert "--extra-index-url" not in dockerfile_text
    assert "uv sync --active --frozen --no-dev --no-install-project" in dockerfile_text


def test_sourcecode_template_uses_probe_ranked_pypi_before_configured_fallbacks() -> None:
    template_text = (
        REPO_ROOT / "scripts" / "sourcecode-templates" / "Dockerfile"
    ).read_text(encoding="utf-8")

    assert 'configured_primary="${BACKEND_PYPI_INDEX_PRIMARY:-' in template_text
    assert 'configured_fallback="${BACKEND_PYPI_INDEX_FALLBACK:-}"' in template_text
    assert '"${ordered}" "${configured_primary}" "${configured_fallback}"' in template_text
    assert "| awk 'NF {print; exit}')" in template_text
    assert "Selected PyPI index: ${best_index}" in template_text
    assert "--extra-index-url" not in template_text
    assert "uv sync --active --frozen --no-dev --no-install-project" in template_text


def test_local_build_script_prefers_daocloud_defaults_for_local_builds() -> None:
    import re
    wrapper_text = (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8")
    start_script_text = (REPO_ROOT / "start-local-services.sh").read_text(encoding="utf-8")

    assert 'exec "$REPO_ROOT/start-local-services.sh" full "$@"' in wrapper_text
    assert 'export DOCKERHUB_LIBRARY_MIRROR="${DOCKERHUB_LIBRARY_MIRROR:-m.daocloud.io/docker.io/library}"' in start_script_text
    assert 'export DOCKER_CLI_IMAGE="${DOCKER_CLI_IMAGE:-docker:cli}"' in start_script_text
    assert (
        'export BACKEND_PYPI_INDEX_PRIMARY="${BACKEND_PYPI_INDEX_PRIMARY:-https://mirrors.huaweicloud.com/repository/pypi/simple/}"'
        in start_script_text
    )
    # Property-based assertion: timeout must be between 30s and 600s (not literal-coupled to default)
    timeout_match = re.search(r'export BACKEND_UV_STEP_TIMEOUT_SECONDS="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"', start_script_text)
    assert timeout_match is not None, "BACKEND_UV_STEP_TIMEOUT_SECONDS export not found"
    timeout_val = int(timeout_match.group(1))
    assert 30 <= timeout_val <= 600, f"timeout {timeout_val} out of range [30, 600]"

    assert "load_container_socket_gid_env" in start_script_text


def test_backend_compose_uses_in_container_docker_host_for_preflight() -> None:
    compose_paths = [
        REPO_ROOT / "docker" / "docker-compose.yml",
        REPO_ROOT / "docker" / "docker-compose.hybrid.yml",
        REPO_ROOT / "docker" / "docker-compose.full.yml",
        REPO_ROOT / "scripts" / "sourcecode-templates" / "docker-compose.yml",
    ]

    for compose_path in compose_paths:
        compose_text = compose_path.read_text(encoding="utf-8")
        assert "${DOCKER_SOCKET_PATH:-/var/run/docker.sock}:/var/run/docker.sock" in compose_text
        assert "DOCKER_HOST: ${BACKEND_DOCKER_HOST:-unix:///var/run/docker.sock}" in compose_text
        assert "DOCKER_HOST: ${DOCKER_HOST:-}" not in compose_text


def test_backend_uv_step_timeout_defaults_stay_aligned() -> None:
    import re

    start_script_text = (REPO_ROOT / "start-local-services.sh").read_text(encoding="utf-8")
    backend_dockerfile_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")
    sourcecode_dockerfile_text = (REPO_ROOT / "scripts" / "sourcecode-templates" / "Dockerfile").read_text(encoding="utf-8")
    hybrid_compose_text = (REPO_ROOT / "docker" / "docker-compose.hybrid.yml").read_text(encoding="utf-8")
    full_compose_text = (REPO_ROOT / "docker" / "docker-compose.full.yml").read_text(encoding="utf-8")

    patterns = {
        "start-local-services.sh": (
            start_script_text,
            r'export BACKEND_UV_STEP_TIMEOUT_SECONDS="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"',
        ),
        "docker/backend.Dockerfile ARG": (
            backend_dockerfile_text,
            r'ARG BACKEND_UV_STEP_TIMEOUT_SECONDS=(\d+)',
        ),
        "docker/backend.Dockerfile layer A": (
            backend_dockerfile_text,
            r'step_timeout="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"',
        ),
        "docker/backend.Dockerfile layer B": (
            backend_dockerfile_text,
            r'uv_step_timeout="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"',
        ),
        "docker-compose.hybrid.yml": (
            hybrid_compose_text,
            r'BACKEND_UV_STEP_TIMEOUT_SECONDS=\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}',
        ),
        "docker-compose.full.yml": (
            full_compose_text,
            r'BACKEND_UV_STEP_TIMEOUT_SECONDS=\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}',
        ),
        "scripts/sourcecode-templates/Dockerfile ARG": (
            sourcecode_dockerfile_text,
            r'ARG BACKEND_UV_STEP_TIMEOUT_SECONDS=(\d+)',
        ),
        "scripts/sourcecode-templates/Dockerfile layer A": (
            sourcecode_dockerfile_text,
            r'step_timeout="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"',
        ),
        "scripts/sourcecode-templates/Dockerfile layer B": (
            sourcecode_dockerfile_text,
            r'uv_step_timeout="\$\{BACKEND_UV_STEP_TIMEOUT_SECONDS:-(\d+)\}"',
        ),
    }
    defaults: dict[str, int] = {}
    for label, (content, pattern) in patterns.items():
        match = re.search(pattern, content)
        assert match is not None, f"{label} timeout default not found"
        defaults[label] = int(match.group(1))

    assert set(defaults.values()) == {600}


def test_local_build_entrypoints_reexec_under_bash_when_invoked_by_sh() -> None:
    start_script_text = (REPO_ROOT / "start-local-services.sh").read_text(encoding="utf-8")
    wrapper_text = (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8")

    guard = 'if [ -z "${BASH_VERSION:-}" ]; then\n  exec bash "$0" "$@"\nfi'
    assert guard in start_script_text
    assert guard in wrapper_text


def test_local_build_script_builds_services_sequentially_before_up() -> None:
    wrapper_text = (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8")
    start_script_text = (REPO_ROOT / "start-local-services.sh").read_text(encoding="utf-8")

    assert 'exec "$REPO_ROOT/start-local-services.sh" full "$@"' in wrapper_text
    assert 'export COMPOSE_BAKE="${COMPOSE_BAKE:-false}"' in start_script_text
    assert 'export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"' in start_script_text
    assert 'LOCAL_BUILD_SERVICES=(' in start_script_text
    assert '  backend' in start_script_text
    assert '  frontend' in start_script_text
    assert 'run_cmd "${COMPOSE[@]}" build "${LOCAL_BUILD_SERVICES[@]}"' in start_script_text
    assert "build nexus-web" not in start_script_text
    assert "build nexus-itemDetail" not in start_script_text


def test_local_build_entrypoint_remains_separate_from_release_publish_targets() -> None:
    script_text = (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8")
    hybrid_compose_text = (REPO_ROOT / "docker" / "docker-compose.hybrid.yml").read_text(encoding="utf-8")

    assert "publish-runtime-images.yml" not in script_text
    assert "runtime-release" not in script_text
    assert "hardened" not in script_text
    assert "target: runtime-plain" in hybrid_compose_text
    assert "target: runtime-release" not in hybrid_compose_text


def _write_fake_docker(bin_dir: Path) -> Path:
    docker_path = bin_dir / "docker"
    docker_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "compose" ]; then
  {
    printf 'ARGS='
    printf '%s ' "$@"
    printf '\\n'
  } >>"${STUB_DOCKER_LOG:?}"
fi
""",
        encoding="utf-8",
    )
    docker_path.chmod(docker_path.stat().st_mode | stat.S_IXUSR)
    return docker_path


def test_local_build_script_bootstraps_backend_env_from_example(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    scripts_dir = repo_root / "scripts"
    lib_dir = scripts_dir / "lib"
    backend_env_dir = repo_root / "docker" / "env" / "backend"
    scripts_dir.mkdir(parents=True)
    lib_dir.mkdir(parents=True)
    backend_env_dir.mkdir(parents=True)

    (scripts_dir / "compose-up-local-build.sh").write_text(
        (REPO_ROOT / "scripts" / "compose-up-local-build.sh").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (lib_dir / "compose-env.sh").write_text(
        (REPO_ROOT / "scripts" / "lib" / "compose-env.sh").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (repo_root / "start-local-services.sh").write_text(
        (REPO_ROOT / "start-local-services.sh").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (repo_root / "start-local-services.sh").chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    docker_dir = repo_root / "docker"
    docker_dir.mkdir(exist_ok=True)
    (docker_dir / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (docker_dir / "docker-compose.full.yml").write_text("services: {}\n", encoding="utf-8")
    env_example = backend_env_dir / "env.example"
    env_example.write_text("LLM_API_KEY=example-key\n", encoding="utf-8")

    script_path = scripts_dir / "compose-up-local-build.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    log_path = tmp_path / "docker.log"
    _write_fake_docker(fake_bin)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["STUB_DOCKER_LOG"] = str(log_path)

    result = subprocess.run(
        [str(script_path), "--skip-nexus-check"],
        cwd=repo_root,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    env_file = backend_env_dir / ".env"
    assert env_file.exists()
    assert env_file.read_text(encoding="utf-8") == env_example.read_text(encoding="utf-8")
    assert "自动生成 backend Docker 环境文件" in combined_output

    log_output = log_path.read_text(encoding="utf-8")
    assert "ARGS=compose --project-directory" in log_output
    assert "docker/docker-compose.yml" in log_output
    assert "docker/docker-compose.full.yml" in log_output
    assert "build backend frontend" in log_output
    assert "build nexus-web" not in log_output
    assert "build nexus-itemDetail" not in log_output
    assert "up -d" in log_output
