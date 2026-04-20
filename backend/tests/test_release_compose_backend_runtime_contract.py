import ast
import fnmatch
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_release_compose_contract_uses_only_supported_commands_and_cloud_runners() -> None:
    compose_text = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    hybrid_text = (REPO_ROOT / "docker-compose.hybrid.yml").read_text(encoding="utf-8")

    assert "docker compose up" not in compose_text
    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in compose_text
    assert "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" not in compose_text
    assert "docker-compose.release.yml" not in compose_text
    assert "docker-compose.release-cython.yml" not in compose_text
    assert "docker-compose.self-contained.yml" not in compose_text
    assert (
        "image: ${BACKEND_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-backend:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "image: ${FRONTEND_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-frontend:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "SCANNER_YASA_IMAGE: ${SCANNER_YASA_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-yasa-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert "\n  nexus-web:\n" not in compose_text
    assert "\n  nexus-itemDetail:\n" not in compose_text
    assert "./nexus-web/dist:/srv/nexus-web:ro" in compose_text
    assert "./nexus-itemDetail/dist:/srv/nexus-item-detail:ro" in compose_text
    assert "/usr/share/nginx/html/nexus:ro" not in compose_text
    assert "/usr/share/nginx/html/nexus-item-detail:ro" not in compose_text
    assert 'group_add:\n      - "${DOCKER_SOCKET_GID:-1001}"' in compose_text
    assert "\n  db-bootstrap:\n" in compose_text
    assert "db-bootstrap:\n        condition: service_completed_successfully" in compose_text
    assert "RUNNER_PREFLIGHT_BUILD_CONTEXT" not in compose_text
    assert "RUNNER_PREFLIGHT_BUILD_TIMEOUT_SECONDS" not in compose_text

    assert "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" in hybrid_text
    assert "docker-compose.full.yml" not in hybrid_text
    assert "build: !override" in hybrid_text
    assert hybrid_text.count("build: !override") == 2
    assert "backend:\n    image: vulhunter/backend-local:latest\n    pull_policy: build" in hybrid_text
    assert "frontend:\n    image: vulhunter/frontend-local:latest" in hybrid_text
    assert "frontend:\n    image: vulhunter/frontend-local:latest\n    pull_policy: build" in hybrid_text
    assert "backend:\n    image: vulhunter/backend-local:latest" in hybrid_text
    assert "target: runtime-plain" in hybrid_text
    assert "\n  db-bootstrap:\n" in hybrid_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest" in hybrid_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest\n    pull_policy: never" in hybrid_text
    assert "context: ./frontend" in hybrid_text
    assert "context: ." in hybrid_text
    assert (
        "SCANNER_YASA_IMAGE: ${SCANNER_YASA_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-yasa-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in hybrid_text
    assert "\n  nexus-web:\n" not in hybrid_text
    assert "\n  nexus-itemDetail:\n" not in hybrid_text
    assert "./nexus-web/dist:/app/public/nexus:ro" in hybrid_text
    assert "./nexus-itemDetail/dist:/app/public/nexus-item-detail:ro" in hybrid_text
    assert "-runner-local:latest" not in hybrid_text
    assert "group_add:" in hybrid_text and '${DOCKER_SOCKET_GID:-1001}' in hybrid_text
    assert "RUNNER_PREFLIGHT_BUILD_CONTEXT" not in hybrid_text
    assert "RUNNER_PREFLIGHT_BUILD_TIMEOUT_SECONDS" not in hybrid_text


def test_backend_runtime_targets_do_not_embed_local_runner_build_context() -> None:
    backend_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")
    runner_preflight_text = (REPO_ROOT / "backend" / "app" / "services" / "runner_preflight.py").read_text(
        encoding="utf-8"
    )

    runtime_cython_section = backend_text.split("FROM runtime-base AS runtime-cython", maxsplit=1)[1].split(
        "FROM runtime-base AS runtime",
        maxsplit=1,
    )[0]
    runtime_section = backend_text.split("FROM runtime-base AS runtime", maxsplit=1)[1].split(
        "FROM runtime-base AS runtime-plain",
        maxsplit=1,
    )[0]
    runtime_plain_section = backend_text.split("FROM runtime-base AS runtime-plain", maxsplit=1)[1]

    assert "FROM runtime-base AS runtime-release" not in backend_text
    assert "FROM selective-cython-compiler AS runtime-release-app-assembler" not in backend_text

    for section in (runtime_cython_section, runtime_section, runtime_plain_section):
        assert "/opt/backend-build-context" not in section
        assert "backend/docs/agent-tools" not in section
        assert "RUNNER_PREFLIGHT_BUILD_CONTEXT" not in section
        assert "COPY backend/static /app/static" not in section

    assert "COPY backend/app /app/app" in runtime_plain_section
    assert "COPY --from=runtime-release-app-assembler /final/app /app/app" not in runtime_plain_section
    assert "selective hardening verifications PASSED" not in runtime_plain_section

    assert "subprocess.run(" not in runner_preflight_text
    assert "falling back to local build" not in runner_preflight_text
    assert "RUNNER_PREFLIGHT_BUILD_CONTEXT" not in runner_preflight_text
    assert "RUNNER_PREFLIGHT_BUILD_TIMEOUT_SECONDS" not in runner_preflight_text


def test_backend_release_publish_workflow_uses_runtime_plain_by_default_and_optional_hardened_lane() -> None:
    publish_workflow_text = (REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml").read_text(
        encoding="utf-8"
    )
    release_workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    publish_frontend_amd64_section = publish_workflow_text.split("  publish-frontend-amd64:\n", maxsplit=1)[1].split(
        "\n  publish-frontend-arm64:\n",
        maxsplit=1,
    )[0]
    publish_frontend_arm64_section = publish_workflow_text.split("  publish-frontend-arm64:\n", maxsplit=1)[1].split(
        "\n  publish-frontend:\n",
        maxsplit=1,
    )[0]
    publish_frontend_section = publish_workflow_text.split("  publish-frontend:\n", maxsplit=1)[1].split(
        "\n  publish-backend-amd64:\n",
        maxsplit=1,
    )[0]
    publish_backend_amd64_section = publish_workflow_text.split("  publish-backend-amd64:\n", maxsplit=1)[1].split(
        "\n  publish-backend-arm64:\n",
        maxsplit=1,
    )[0]
    publish_backend_arm64_section = publish_workflow_text.split("  publish-backend-arm64:\n", maxsplit=1)[1].split(
        "\n  publish-backend:\n",
        maxsplit=1,
    )[0]
    publish_backend_section = publish_workflow_text.split("  publish-backend:\n", maxsplit=1)[1].split(
        "\n  publish-yasa-runner-amd64:\n",
        maxsplit=1,
    )[0]

    assert "publish_backend_hardened:" not in publish_workflow_text

    assert "if: ${{ inputs.build_frontend }}" in publish_frontend_amd64_section
    assert "runs-on: ubuntu-latest" in publish_frontend_amd64_section
    assert "platforms: linux/amd64" in publish_frontend_amd64_section
    assert (
        "vulhunter-frontend:${{ needs.prepare.outputs.tag }}-${{ github.run_id }}-${{ github.run_attempt }}-amd64"
        in publish_frontend_amd64_section
    )
    assert "scope=frontend-runtime-amd64" in publish_frontend_amd64_section
    assert "setup-qemu-action" not in publish_frontend_amd64_section

    assert "if: ${{ inputs.build_frontend && inputs.multi_arch }}" in publish_frontend_arm64_section
    assert "runs-on: ubuntu-24.04-arm" in publish_frontend_arm64_section
    assert "platforms: linux/arm64" in publish_frontend_arm64_section
    assert (
        "vulhunter-frontend:${{ needs.prepare.outputs.tag }}-${{ github.run_id }}-${{ github.run_attempt }}-arm64"
        in publish_frontend_arm64_section
    )
    assert "scope=frontend-runtime-arm64" in publish_frontend_arm64_section
    assert "setup-qemu-action" not in publish_frontend_arm64_section

    assert "needs:" in publish_frontend_section
    assert "publish-frontend-amd64" in publish_frontend_section
    assert "publish-frontend-arm64" in publish_frontend_section
    assert (
        "if: ${{ always() && inputs.build_frontend && needs.publish-frontend-amd64.result == 'success' && "
        "(needs.publish-frontend-arm64.result == 'success' || needs.publish-frontend-arm64.result == 'skipped') }}"
        in publish_frontend_section
    )
    assert "docker buildx imagetools create" in publish_frontend_section
    assert "docker buildx imagetools inspect" in publish_frontend_section
    assert "AMD64_TAG: ${{ needs.publish-frontend-amd64.outputs.tag }}" in publish_frontend_section
    assert "ARM64_TAG: ${{ needs.publish-frontend-arm64.outputs.tag }}" in publish_frontend_section
    assert "EXPECTED_PLATFORMS: ${{ inputs.multi_arch && 'linux/amd64 linux/arm64' || 'linux/amd64' }}" in (
        publish_frontend_section
    )
    assert "vulhunter-frontend:${{ needs.prepare.outputs.tag }}" in publish_frontend_section
    assert 'echo "digest=${digest}" >> "$GITHUB_OUTPUT"' in publish_frontend_section
    assert 'echo "ref=${IMAGE}@${digest}" >> "$GITHUB_OUTPUT"' in publish_frontend_section

    assert "if: ${{ inputs.build_backend }}" in publish_backend_amd64_section
    assert "runs-on: ubuntu-latest" in publish_backend_amd64_section
    assert "platforms: linux/amd64" in publish_backend_amd64_section
    assert "target: runtime-plain" in publish_backend_amd64_section
    assert "vulhunter-backend:${{ needs.prepare.outputs.tag }}-${{ github.run_id }}-${{ github.run_attempt }}-amd64" in publish_backend_amd64_section
    assert "scope=backend-runtime-plain-amd64" in publish_backend_amd64_section
    assert "vulhunter-backend:buildcache-runtime-plain-amd64" in publish_backend_amd64_section
    assert "actions/cache@v4" in publish_workflow_text
    assert "buildkit-cache-dance" in publish_workflow_text
    assert "type=gha,mode=max,scope=backend-runtime-plain-amd64" in publish_backend_amd64_section

    assert "if: ${{ inputs.build_backend && inputs.multi_arch }}" in publish_backend_arm64_section
    assert "runs-on: ubuntu-24.04-arm" in publish_backend_arm64_section
    assert "platforms: linux/arm64" in publish_backend_arm64_section
    assert "target: runtime-plain" in publish_backend_arm64_section
    assert "vulhunter-backend:${{ needs.prepare.outputs.tag }}-${{ github.run_id }}-${{ github.run_attempt }}-arm64" in publish_backend_arm64_section
    assert "scope=backend-runtime-plain-arm64" in publish_backend_arm64_section
    assert "vulhunter-backend:buildcache-runtime-plain-arm64" in publish_backend_arm64_section
    assert "setup-qemu-action" not in publish_backend_arm64_section
    assert "type=gha,mode=max,scope=backend-runtime-plain-arm64" in publish_backend_arm64_section

    assert "needs:" in publish_backend_section
    assert "publish-backend-amd64" in publish_backend_section
    assert "publish-backend-arm64" in publish_backend_section
    assert "docker buildx imagetools create" in publish_backend_section
    assert "docker buildx imagetools inspect" in publish_backend_section
    assert "linux/amd64" in publish_backend_section
    assert "linux/arm64" in publish_backend_section
    assert "vulhunter-backend:${{ needs.prepare.outputs.tag }}" in publish_backend_section
    assert 'echo "digest=${digest}" >> "$GITHUB_OUTPUT"' in publish_backend_section
    assert 'echo "ref=${IMAGE}@${digest}" >> "$GITHUB_OUTPUT"' in publish_backend_section
    assert "Release manifest requires a freshly built backend image ref" in publish_workflow_text

    assert "publish_backend_hardened:" not in release_workflow_text


def test_backend_release_defaults_do_not_depend_on_release_only_cython_inputs() -> None:
    backend_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")
    dockerignore_text = (REPO_ROOT / "docker" / "backend.Dockerfile.dockerignore").read_text(encoding="utf-8")

    assert "FROM builder AS selective-cython-compiler" not in backend_text
    assert "FROM selective-cython-compiler AS runtime-release-app-assembler" not in backend_text
    assert "FROM runtime-base AS runtime-release" not in backend_text
    assert "CYTHON_INCLUDE_PATTERNS_FILE=/build/cython_build/release_allowlist.txt" not in backend_text
    assert "removed cythonized source" not in backend_text
    assert "remaining non-preserved .py count" not in backend_text
    assert "selective hardening verifications PASSED" not in backend_text
    assert not (REPO_ROOT / "backend" / "cython_build" / "release_allowlist.txt").exists()
    assert not (REPO_ROOT / "backend" / "cython_build" / "release_exclusion_list.txt").exists()

    for ignored_path in (
        ".git",
        ".github",
        "docs",
        "deploy",
        "frontend",
        "nexus-web",
        "nexus-itemDetail",
        "backend/.venv",
        "backend/tests",
        "backend/log",
        "backend/uploads",
        "backend/**/__pycache__",
        "backend/.pytest_cache",
        "backend/.ruff_cache",
    ):
        assert ignored_path in dockerignore_text


def test_runner_dockerfile_specific_ignore_files_and_workflow_paths_contract() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )

    expected_ignore_files = {
        "docker/bandit-runner.Dockerfile.dockerignore": ["**"],
        "docker/gitleaks-runner.Dockerfile.dockerignore": ["**"],
        "docker/pmd-runner.Dockerfile.dockerignore": ["**"],
        "docker/opengrep-runner.Dockerfile.dockerignore": [
            "**",
            "!backend/app/runtime/launchers/opengrep_launcher.py",
        ],
        "docker/phpstan-runner.Dockerfile.dockerignore": [
            "**",
            "!backend/app/runtime/launchers/phpstan_launcher.py",
        ],
        "docker/flow-parser-runner.Dockerfile.dockerignore": [
            "**",
            "!backend/scripts/package_source_selector.py",
            "!backend/scripts/flow_parser_runner.py",
            "!backend/app/services/parser.py",
            "!docker/flow-parser-runner.requirements.txt",
        ],
        "docker/sandbox-runner.Dockerfile.dockerignore": [
            "**",
            "!docker/sandbox-runner.requirements.txt",
        ],
        "docker/yasa-runner.Dockerfile.dockerignore": [
            "**",
            "!backend/scripts/package_source_selector.py",
            "!backend/app/runtime/launchers/yasa_engine_launcher.py",
            "!backend/app/runtime/launchers/yasa_launcher.py",
            "!backend/app/runtime/launchers/yasa_uast4py_launcher.py",
            "!frontend/yasa-engine-overrides/**",
        ],
    }

    for rel_path, expected_lines in expected_ignore_files.items():
        content = (REPO_ROOT / rel_path).read_text(encoding="utf-8").splitlines()
        assert content == expected_lines

    assert "- 'docker/bandit-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/gitleaks-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/pmd-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/opengrep-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/phpstan-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/flow-parser-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/sandbox-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/yasa-runner.Dockerfile.dockerignore'" in workflow_text
    assert "- 'docker/flow-parser-runner.requirements.txt'" in workflow_text
    assert "- 'docker/sandbox-runner.requirements.txt'" in workflow_text
