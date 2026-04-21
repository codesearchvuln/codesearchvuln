import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RUNNER_SERVICE_NAMES = (
    "yasa-runner",
    "opengrep-runner",
    "bandit-runner",
    "gitleaks-runner",
    "phpstan-runner",
    "pmd-runner",
    "flow-parser-runner",
)
DEFAULT_BACKEND_IMAGE = (
    "${BACKEND_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}"
    "/vulhunter-backend:${VULHUNTER_IMAGE_TAG:-latest}}"
)
DEFAULT_FRONTEND_IMAGE = (
    "${FRONTEND_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}"
    "/vulhunter-frontend:${VULHUNTER_IMAGE_TAG:-latest}}"
)
DEFAULT_SCANNER_PMD_IMAGE = (
    "${SCANNER_PMD_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}"
    "/vulhunter-pmd-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
)


def test_default_compose_uses_backend_managed_runner_preflight() -> None:
    compose_path = REPO_ROOT / "docker-compose.yml"
    full_overlay_path = REPO_ROOT / "docker-compose.full.yml"
    backend_dockerfile = REPO_ROOT / "docker" / "backend.Dockerfile"
    frontend_dockerfile = REPO_ROOT / "docker" / "frontend.Dockerfile"

    assert compose_path.exists()
    assert full_overlay_path.exists()
    assert not (REPO_ROOT / "docker-compose.dev.yml").exists()
    assert not (REPO_ROOT / "docker-compose.frontend-dev.yml").exists()
    assert not (REPO_ROOT / "docker-compose.override.yml").exists()
    assert not (REPO_ROOT / "docker-compose.prod.yml").exists()
    assert not (REPO_ROOT / "docker-compose.prod.cn.yml").exists()

    compose_text = compose_path.read_text(encoding="utf-8")
    assert "runner preflight / warmup" not in compose_text
    assert "一次性预热/自检容器" not in compose_text
    assert "执行完检查后按预期退出" not in compose_text
    assert 'condition: service_completed_successfully' in compose_text
    assert "\n  db-bootstrap:\n" in compose_text
    for runner_service in RUNNER_SERVICE_NAMES:
        assert f"\n  {runner_service}:" not in compose_text
    assert f"image: {DEFAULT_BACKEND_IMAGE}" in compose_text
    assert f"image: {DEFAULT_FRONTEND_IMAGE}" in compose_text
    assert "vulhunter/backend-dev:latest" not in compose_text
    assert "vulhunter/frontend-dev:latest" not in compose_text
    assert "target: dev-runtime" not in compose_text
    assert "target: dev" not in compose_text
    assert "\n  backend:\n" in compose_text
    assert "db-bootstrap:\n        condition: service_completed_successfully" in compose_text
    assert "\n  scan-workspace-init:\n" in compose_text
    assert "\n  frontend:\n" in compose_text
    assert "\n  nexus-web:\n" not in compose_text
    assert "\n  nexus-itemDetail:\n" not in compose_text
    assert "./backend:/app" not in compose_text
    assert ".:/workspace:ro" not in compose_text
    assert "./frontend:/app" not in compose_text
    assert "./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" not in compose_text
    assert "\n      - /opt/backend-venv\n" not in compose_text
    assert "/app/.venv" not in compose_text
    assert "/root/.cache/uv" not in compose_text
    assert "/app/node_modules" not in compose_text
    assert "/pnpm/store" not in compose_text
    assert "${VULHUNTER_FRONTEND_PORT:-3000}:80" in compose_text
    assert 'FRONTEND_PUBLIC_URL: http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}' not in compose_text
    assert 'BACKEND_PUBLIC_URL: http://localhost:${VULHUNTER_BACKEND_PORT:-8000}' not in compose_text
    assert "command: /app/scripts/dev-entrypoint.sh" not in compose_text
    assert "command:\n      - sh\n      - /app/scripts/dev-entrypoint.sh" not in compose_text
    assert "BACKEND_PYPI_INDEX_PRIMARY: ${BACKEND_PYPI_INDEX_PRIMARY:-}" in compose_text
    assert "BACKEND_PYPI_INDEX_FALLBACK: ${BACKEND_PYPI_INDEX_FALLBACK:-}" in compose_text
    assert "BACKEND_INSTALL_YASA" not in compose_text
    assert "YASA_VERSION:" not in compose_text
    assert "BACKEND_PYPI_INDEX_CANDIDATES: ${BACKEND_PYPI_INDEX_CANDIDATES:-https://mirrors.aliyun.com/pypi/simple/" in compose_text
    assert "YASA_ENABLED: ${YASA_ENABLED:-true}" in compose_text
    assert "SCAN_WORKSPACE_ROOT: ${SCAN_WORKSPACE_ROOT:-/tmp/vulhunter/scans}" in compose_text
    assert "SCAN_WORKSPACE_VOLUME: ${SCAN_WORKSPACE_VOLUME:-vulhunter_scan_workspace}" in compose_text
    assert "GHCR_REGISTRY: ${GHCR_REGISTRY:-ghcr.io}" in compose_text
    assert "VULHUNTER_IMAGE_NAMESPACE: ${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}" in compose_text
    assert "VULHUNTER_IMAGE_TAG: ${VULHUNTER_IMAGE_TAG:-latest}" in compose_text
    assert "SANDBOX_IMAGE:" not in compose_text
    assert (
        "SCANNER_YASA_IMAGE: ${SCANNER_YASA_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-yasa-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "SCANNER_OPENGREP_IMAGE: ${SCANNER_OPENGREP_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-opengrep-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "SCANNER_BANDIT_IMAGE: ${SCANNER_BANDIT_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-bandit-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "SCANNER_GITLEAKS_IMAGE: ${SCANNER_GITLEAKS_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-gitleaks-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert (
        "SCANNER_PHPSTAN_IMAGE: ${SCANNER_PHPSTAN_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-phpstan-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert f"SCANNER_PMD_IMAGE: {DEFAULT_SCANNER_PMD_IMAGE}" in compose_text
    assert (
        "FLOW_PARSER_RUNNER_IMAGE: ${FLOW_PARSER_RUNNER_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-flow-parser-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert 'FLOW_PARSER_RUNNER_ENABLED: "${FLOW_PARSER_RUNNER_ENABLED:-true}"' in compose_text
    assert 'FLOW_PARSER_RUNNER_TIMEOUT_SECONDS: "${FLOW_PARSER_RUNNER_TIMEOUT_SECONDS:-120}"' in compose_text
    assert "YASA_TIMEOUT_SECONDS: ${YASA_TIMEOUT_SECONDS:-600}" in compose_text
    assert "/tmp/vulhunter/scans:/tmp/vulhunter/scans" not in compose_text
    assert "scan_workspace:/tmp/vulhunter/scans" in compose_text
    assert "image: ${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}/alpine:3.20" in compose_text
    assert "touch /tmp/vulhunter/scans/.scan-workspace-ready" in compose_text
    assert "scan-workspace-init:\n        condition: service_healthy" in compose_text
    assert "${DOCKER_SOCKET_PATH:-/var/run/docker.sock}:/var/run/docker.sock" in compose_text
    assert "RUNNER_PREFLIGHT_BUILD_CONTEXT" not in compose_text
    assert 'RUNNER_PREFLIGHT_STRICT: "${RUNNER_PREFLIGHT_STRICT:-true}"' in compose_text
    assert "mem_limit: 4g" in compose_text
    assert "pids_limit: 1024" in compose_text
    assert "mem_limit: 512m" in compose_text
    assert "pids_limit: 256" in compose_text
    assert "mem_limit: 1g" in compose_text
    assert "MCP_REQUIRE_ALL_READY_ON_STARTUP" not in compose_text
    assert '/bin/sh", "-lc"' not in compose_text
    assert (
        "SANDBOX_RUNNER_IMAGE: ${SANDBOX_RUNNER_IMAGE:-${GHCR_REGISTRY:-ghcr.io}/${VULHUNTER_IMAGE_NAMESPACE:-codesearchvuln}/"
        "vulhunter-sandbox-runner:${VULHUNTER_IMAGE_TAG:-latest}}"
    ) in compose_text
    assert "SANDBOX_RUNNER_ENABLED:" not in compose_text
    assert "BACKEND_NPM_REGISTRY_PRIMARY" not in compose_text
    assert "BACKEND_NPM_REGISTRY_FALLBACK" not in compose_text
    assert "BACKEND_NPM_REGISTRY_CANDIDATES" not in compose_text
    assert "BACKEND_PNPM_VERSION" not in compose_text
    assert "BACKEND_PNPM_CMD_TIMEOUT_SECONDS" not in compose_text
    assert "BACKEND_PNPM_INSTALL_OPTIONAL" not in compose_text
    assert "MCP_REQUIRED_RUNTIME_DOMAIN" not in compose_text
    assert "MCP_CODE_INDEX_ENABLED" not in compose_text
    assert "SKILL_REGISTRY_AUTO_SYNC_ON_STARTUP" not in compose_text
    assert "CODEX_SKILLS_AUTO_INSTALL" not in compose_text
    assert 'profiles: [ "tools" ]' in compose_text
    assert "adminer:" in compose_text
    assert "./nexus-web/dist:/srv/nexus-web:ro" in compose_text
    assert "./nexus-itemDetail/dist:/srv/nexus-item-detail:ro" in compose_text
    assert "/usr/share/nginx/html/nexus:ro" not in compose_text
    assert "/usr/share/nginx/html/nexus-item-detail:ro" not in compose_text
    assert "YASA_HOST_BIN_PATH" not in compose_text
    assert "YASA_HOST_RESOURCE_DIR" not in compose_text
    assert "YASA_BIN_PATH:" not in compose_text
    assert "YASA_RESOURCE_DIR:" not in compose_text
    assert "\n  frontend-dev:" not in compose_text

    backend_text = backend_dockerfile.read_text(encoding="utf-8")
    assert "FROM runtime-base AS dev-runtime" in backend_text
    assert 'COPY backend/scripts/package_source_selector.py /usr/local/bin/package_source_selector.py' in backend_text
    assert "BACKEND_INSTALL_YASA" not in backend_text
    assert "ARG YASA_VERSION=" not in backend_text
    assert "backend-dev-entrypoint.sh" not in backend_text
    assert 'CMD ["/bin/sh", "/usr/local/bin/backend-dev-entrypoint.sh"]' not in backend_text
    assert 'CMD ["/bin/sh", "/app/docker-entrypoint.sh"]' not in backend_text
    assert "https://github.com/antgroup/YASA-Engine/archive/refs/tags/${YASA_VERSION}.tar.gz" not in backend_text
    assert "COPY frontend/yasa-engine-overrides /tmp/yasa-engine-overrides" not in backend_text
    assert 'best_index="$(cat /tmp/pypi-best-index)"' in backend_text
    assert 'for idx in "$@"; do \\' in backend_text
    assert 'sync_with_index "${BACKEND_PYPI_INDEX_PRIMARY}" || sync_with_index "${BACKEND_PYPI_INDEX_FALLBACK}"' not in backend_text
    assert "nodebase" not in backend_text
    assert "mcp-builder" not in backend_text
    assert "run_npx_from_candidates.sh" not in backend_text
    assert "/app/data/mcp/code-index" not in backend_text
    assert "FROM ${DOCKERHUB_LIBRARY_MIRROR}/node:22-slim" not in backend_text
    assert "BACKEND_NPM_REGISTRY_PRIMARY" not in backend_text
    assert "BACKEND_NPM_REGISTRY_FALLBACK" not in backend_text
    assert "BACKEND_NPM_REGISTRY_CANDIDATES" not in backend_text
    assert "BACKEND_PNPM_VERSION" not in backend_text
    assert "BACKEND_PNPM_INSTALL_OPTIONAL" not in backend_text
    assert "PNPM_HOME" not in backend_text
    assert "/pnpm" not in backend_text

    frontend_text = frontend_dockerfile.read_text(encoding="utf-8")
    assert " AS dev" in frontend_text
    assert "frontend-dev-entrypoint.sh" not in frontend_text
    assert 'CMD ["/bin/sh", "/usr/local/bin/frontend-dev-entrypoint.sh"]' not in frontend_text
    assert 'ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]' not in frontend_text


def test_full_overlay_restores_full_local_build_defaults() -> None:
    full_overlay_text = (REPO_ROOT / "docker-compose.full.yml").read_text(encoding="utf-8")

    assert "runner preflight / warmup" not in full_overlay_text
    assert "一次性预热/自检容器" not in full_overlay_text
    assert "执行完检查后按预期退出" not in full_overlay_text
    assert 'condition: service_completed_successfully' not in full_overlay_text
    assert "\n  db-bootstrap:\n" in full_overlay_text
    for runner_service in RUNNER_SERVICE_NAMES:
        assert f"\n  {runner_service}:" not in full_overlay_text
    assert "vulhunter/backend-local:latest" in full_overlay_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest" in full_overlay_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest\n    pull_policy: never" in full_overlay_text
    assert "vulhunter/backend-dev-local:latest" not in full_overlay_text
    assert "vulhunter/frontend-local:latest" in full_overlay_text
    assert "backend:\n    image: vulhunter/backend-local:latest\n    pull_policy: build" in full_overlay_text
    assert "frontend:\n    image: vulhunter/frontend-local:latest\n    pull_policy: build" in full_overlay_text
    assert "./nexus-web/dist:/app/public/nexus:ro" in full_overlay_text
    assert "./nexus-itemDetail/dist:/app/public/nexus-item-detail:ro" in full_overlay_text
    assert "context: ." in full_overlay_text
    assert "dockerfile: docker/backend.Dockerfile" in full_overlay_text
    assert "working_dir: !reset null" in full_overlay_text
    assert "command: !reset null" in full_overlay_text
    assert "./frontend:/app" in full_overlay_text
    assert "${VULHUNTER_FRONTEND_PORT:-3000}:5173" in full_overlay_text
    assert "VITE_API_TARGET: http://backend:8000" in full_overlay_text
    assert "CODEX_SKILLS_AUTO_INSTALL" not in full_overlay_text
    assert "BACKEND_INSTALL_YASA" not in full_overlay_text
    assert "YASA_VERSION=" not in full_overlay_text
    assert "SCANNER_YASA_IMAGE: ${SCANNER_YASA_IMAGE:-vulhunter/yasa-runner-local:latest}" in full_overlay_text
    assert "SCANNER_OPENGREP_IMAGE: ${SCANNER_OPENGREP_IMAGE:-vulhunter/opengrep-runner-local:latest}" in full_overlay_text
    assert "SCANNER_BANDIT_IMAGE: ${SCANNER_BANDIT_IMAGE:-vulhunter/bandit-runner-local:latest}" in full_overlay_text
    assert "SCANNER_GITLEAKS_IMAGE: ${SCANNER_GITLEAKS_IMAGE:-vulhunter/gitleaks-runner-local:latest}" in full_overlay_text
    assert "SCANNER_PHPSTAN_IMAGE: ${SCANNER_PHPSTAN_IMAGE:-vulhunter/phpstan-runner-local:latest}" in full_overlay_text
    assert "SCANNER_PMD_IMAGE: ${SCANNER_PMD_IMAGE:-vulhunter/pmd-runner-local:latest}" in full_overlay_text
    assert "FLOW_PARSER_RUNNER_IMAGE: ${FLOW_PARSER_RUNNER_IMAGE:-vulhunter/flow-parser-runner-local:latest}" in full_overlay_text
    assert "- BACKEND_PYPI_INDEX_CANDIDATES=${BACKEND_PYPI_INDEX_CANDIDATES:-https://mirrors.aliyun.com/pypi/simple/" in full_overlay_text
    assert "SCAN_WORKSPACE_ROOT: ${SCAN_WORKSPACE_ROOT:-/tmp/vulhunter/scans}" in full_overlay_text
    assert "SCAN_WORKSPACE_VOLUME: ${SCAN_WORKSPACE_VOLUME:-vulhunter_scan_workspace}" in full_overlay_text
    assert "mem_limit: 1536m" in full_overlay_text
    assert "pids_limit: 512" in full_overlay_text
    assert "CHOKIDAR_USEPOLLING: ${FRONTEND_CHOKIDAR_USEPOLLING:-false}" in full_overlay_text
    assert "BACKEND_NPM_REGISTRY_PRIMARY" not in full_overlay_text
    assert "BACKEND_NPM_REGISTRY_FALLBACK" not in full_overlay_text
    assert "BACKEND_NPM_REGISTRY_CANDIDATES" not in full_overlay_text
    assert "BACKEND_PNPM_VERSION" not in full_overlay_text
    assert "BACKEND_PNPM_CMD_TIMEOUT_SECONDS" not in full_overlay_text
    assert "BACKEND_PNPM_INSTALL_OPTIONAL" not in full_overlay_text
    assert "MCP_REQUIRED_RUNTIME_DOMAIN" not in full_overlay_text
    assert "SANDBOX_RUNNER_IMAGE: ${SANDBOX_RUNNER_IMAGE:-vulhunter/sandbox-runner-local:latest}" in full_overlay_text
    assert "SANDBOX_RUNNER_ENABLED:" not in full_overlay_text
    assert "SANDBOX_IMAGE:" not in full_overlay_text
    assert "\n  frontend-dev:" not in full_overlay_text


def test_hybrid_overlay_uses_frontend_dev_without_default_polling_and_with_resource_limits() -> None:
    hybrid_overlay_text = (REPO_ROOT / "docker-compose.hybrid.yml").read_text(encoding="utf-8")

    assert "target: dev" in hybrid_overlay_text
    assert "\n  db-bootstrap:\n" in hybrid_overlay_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest" in hybrid_overlay_text
    assert "db-bootstrap:\n    image: vulhunter/backend-local:latest\n    pull_policy: never" in hybrid_overlay_text
    assert "backend:\n    image: vulhunter/backend-local:latest\n    pull_policy: build" in hybrid_overlay_text
    assert "frontend:\n    image: vulhunter/frontend-local:latest\n    pull_policy: build" in hybrid_overlay_text
    assert "${VULHUNTER_FRONTEND_PORT:-3000}:5173" in hybrid_overlay_text
    assert "CHOKIDAR_USEPOLLING: ${FRONTEND_CHOKIDAR_USEPOLLING:-false}" in hybrid_overlay_text
    assert "mem_limit: 1536m" in hybrid_overlay_text
    assert "pids_limit: 512" in hybrid_overlay_text
    assert "SANDBOX_RUNNER_ENABLED:" not in hybrid_overlay_text
    assert "SANDBOX_IMAGE:" not in hybrid_overlay_text


def test_backend_dockerfile_builds_linux_arm64_yasa_from_source() -> None:
    backend_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(
        encoding="utf-8"
    )

    assert 'CMD ["python3", "-m", "app.runtime.container_startup", "prod"]' in backend_text


def test_root_compose_mounts_nexus_static_bundles_without_retired_service_stubs() -> None:
    compose_text = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "\n  nexus-web:\n" not in compose_text
    assert "\n  nexus-itemDetail:\n" not in compose_text
    assert "dockerfile_inline: |" not in compose_text
    assert "./nexus-web/dist:/srv/nexus-web:ro" in compose_text
    assert "./nexus-itemDetail/dist:/srv/nexus-item-detail:ro" in compose_text
    assert "/usr/share/nginx/html/nexus:ro" not in compose_text
    assert "/usr/share/nginx/html/nexus-item-detail:ro" not in compose_text


def test_retired_nexus_container_dockerfiles_are_removed() -> None:
    assert not (REPO_ROOT / "docker" / "nexus-web.Dockerfile").exists()
    assert not (REPO_ROOT / "docker" / "nexus-web-itemDetail.Dockerfile").exists()


def test_nexus_static_bundles_are_subpath_safe() -> None:
    bundle_contracts = (
        (
            "nexus-web",
            REPO_ROOT / "nexus-web" / "dist",
            "/nexus/assets/",
            "/nexus/wasm/",
        ),
        (
            "nexus-itemDetail",
            REPO_ROOT / "nexus-itemDetail" / "dist",
            "/nexus-item-detail/assets/",
            "/nexus-item-detail/wasm/",
        ),
    )

    for bundle_name, dist_dir, assets_prefix, wasm_prefix in bundle_contracts:
        index_html = (dist_dir / "index.html").read_text(encoding="utf-8")
        prefix_segment = assets_prefix.strip("/").split("/")[0]
        double_prefix = f"/{prefix_segment}/{prefix_segment}/"
        assert assets_prefix in index_html, bundle_name
        assert double_prefix not in index_html, bundle_name
        assert 'src="/assets/' not in index_html, bundle_name
        assert 'href="/assets/' not in index_html, bundle_name

        asset_refs = re.findall(r'(?:src|href)="([^"]*?/assets/[^"]+)"', index_html)
        assert asset_refs, bundle_name
        for asset_ref in asset_refs:
            assert asset_ref.startswith(assets_prefix), bundle_name
            asset_file = asset_ref.removeprefix(f"/{prefix_segment}/")
            assert (dist_dir / asset_file).is_file(), f"{bundle_name}: missing asset {asset_file}"

        bad_tokens = ('"/assets/', '"/wasm/', "`/assets/", "`/wasm/")
        offenders: list[str] = []
        for path in sorted(dist_dir.rglob("*")):
            if path.suffix not in {".html", ".js"}:
                continue
            text = path.read_text(encoding="utf-8")
            if any(token in text for token in bad_tokens):
                offenders.append(str(path.relative_to(REPO_ROOT)))

        assert not offenders, f"{bundle_name} still contains root-relative asset paths: {offenders}"

        worker_files = sorted((dist_dir / "assets").glob("ingestion.worker-*.js"))
        assert worker_files, bundle_name
        worker_text = worker_files[0].read_text(encoding="utf-8")
        assert assets_prefix in worker_text, bundle_name
        assert wasm_prefix in worker_text, bundle_name


def test_frontend_nginx_routes_nexus_static_mounts() -> None:
    frontend_nginx = (REPO_ROOT / "frontend" / "nginx.conf").read_text(encoding="utf-8")
    assert not (REPO_ROOT / "deploy" / "frontend" / "default.conf").exists()
    assert "location ^~ /nexus/" in frontend_nginx
    assert "alias /srv/nexus-web/;" in frontend_nginx
    assert "try_files $uri $uri/ /nexus/index.html;" in frontend_nginx
    assert "location ^~ /nexus-item-detail/" in frontend_nginx
    assert "alias /srv/nexus-item-detail/;" in frontend_nginx
    assert "try_files $uri $uri/ /nexus-item-detail/index.html;" in frontend_nginx


def test_scripts_and_packaging_use_new_compose_layout() -> None:
    dev_frontend_script_path = REPO_ROOT / "scripts" / "dev-frontend.sh"
    dev_frontend_script = (
        dev_frontend_script_path.read_text(encoding="utf-8")
        if dev_frontend_script_path.exists()
        else None
    )
    frontend_exec_script = (
        REPO_ROOT / "frontend" / "scripts" / "run-in-dev-container.sh"
    ).read_text(encoding="utf-8")
    package_script_path = REPO_ROOT / "scripts" / "package-release-artifacts.sh"
    package_script = (
        package_script_path.read_text(encoding="utf-8")
        if package_script_path.exists()
        else None
    )
    deploy_script_path = REPO_ROOT / "scripts" / "deploy-release-artifacts.sh"
    deploy_script = (
        deploy_script_path.read_text(encoding="utf-8")
        if deploy_script_path.exists()
        else None
    )
    deb_build_script_path = REPO_ROOT / "packaging" / "deb" / "build_deb.sh"
    deb_build_script = (
        deb_build_script_path.read_text(encoding="utf-8")
        if deb_build_script_path.exists()
        else None
    )
    compose_wrapper_script = (
        REPO_ROOT / "scripts" / "compose-up-with-fallback.sh"
    ).read_text(encoding="utf-8")
    compose_wrapper_ps1 = (
        REPO_ROOT / "scripts" / "compose-up-with-fallback.ps1"
    ).read_text(encoding="utf-8")
    local_build_script = (
        REPO_ROOT / "scripts" / "compose-up-local-build.sh"
    ).read_text(encoding="utf-8")

    if dev_frontend_script is not None:
        assert "docker compose up -d db redis backend frontend" in dev_frontend_script
        assert "frontend-dev" not in dev_frontend_script
    assert 'COMPOSE=(docker compose -f "$REPO_ROOT/docker-compose.yml")' in frontend_exec_script
    assert 'SERVICE="frontend"' in frontend_exec_script
    assert "docker-compose.frontend-dev.yml" not in frontend_exec_script

    if package_script is not None:
        assert '-f "${ROOT_DIR}/docker-compose.full.yml"' in package_script
        assert 'cp "$ROOT_DIR/docker-compose.full.yml" "$tmp_root/"' in package_script
        assert '-f "${ROOT_DIR}/docker-compose.hybrid.yml"' in package_script
        assert 'cp "$ROOT_DIR/docker-compose.hybrid.yml" "$tmp_root/"' in package_script
        assert '-f "${ROOT_DIR}/docker-compose.self-contained.yml"' in package_script
        assert 'cp "$ROOT_DIR/docker-compose.self-contained.yml" "$tmp_root/"' in package_script
    if deploy_script is not None:
        assert '-f "${TARGET_DIR}/docker-compose.full.yml"' in deploy_script

    if deb_build_script is not None:
        assert (REPO_ROOT / "deploy" / "compose" / "docker-compose.prod.yml").exists()
        assert (REPO_ROOT / "deploy" / "compose" / "docker-compose.prod.cn.yml").exists()
        assert 'cp "$ROOT_DIR/deploy/compose/docker-compose.prod.yml"' in deb_build_script
        assert 'cp "$ROOT_DIR/deploy/compose/docker-compose.prod.cn.yml"' in deb_build_script
    assert "detect_compose_cmd() {" in compose_wrapper_script
    assert 'COMPOSE_ARGS=("$@")' in compose_wrapper_script
    assert "function Detect-ComposeCommand" in compose_wrapper_ps1
    assert "compose-up-with-fallback.ps1" in compose_wrapper_ps1
    assert '"${COMPOSE[@]}" build backend' in local_build_script
    assert '"${COMPOSE[@]}" build frontend' in local_build_script
    assert "build nexus-web" not in local_build_script
    assert "build nexus-itemDetail" not in local_build_script
    assert '"${COMPOSE[@]}" up -d' in local_build_script


def test_readmes_document_backend_managed_preflight_behavior() -> None:
    root_readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    root_readme_en = (REPO_ROOT / "README_EN.md").read_text(encoding="utf-8")
    compose_readme = (REPO_ROOT / "scripts" / "README-COMPOSE.md").read_text(encoding="utf-8")

    for doc in (root_readme, root_readme_en, compose_readme):
        assert "bash ./scripts/online-up.sh" not in doc
        assert "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" not in doc
        assert "docker/env/backend/env.example" in doc
        assert "offline-images.env.example" in doc
        assert "Vulhunter-offline-bootstrap.sh" in doc
        assert "offline-up.ps1" not in doc
        assert "/nexus/" in doc
        assert "/nexus-item-detail/" in doc
        assert "does not support online deployment" in doc or "不支持在线部署" in doc

    assert "scripts/README-COMPOSE.md" in root_readme
    assert "scripts/README-COMPOSE.md" in root_readme_en
    assert "package-release-artifacts.sh" not in root_readme
    assert "package-release-artifacts.sh" not in root_readme_en
    assert "package-release-artifacts.sh" not in compose_readme
    assert "deploy-release-artifacts.sh" not in compose_readme
    assert "VULHUNTER_RELEASE_PROJECT_NAME" in compose_readme
    assert "vulhunter-release" in compose_readme
    assert "不会删除任何 Docker volume" in compose_readme or "不会删除这些 volumes" in compose_readme
    assert "does not support online deployment" in root_readme_en
    assert "不支持在线部署" in root_readme


def test_backend_runtime_python_tools_are_installed_via_backend_venv() -> None:
    backend_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(
        encoding="utf-8"
    )
    pyproject_text = (REPO_ROOT / "backend" / "pyproject.toml").read_text(encoding="utf-8")
    yasa_runner_text = (REPO_ROOT / "docker" / "yasa-runner.Dockerfile").read_text(
        encoding="utf-8"
    )
    flow_parser_runner_text = (
        REPO_ROOT / "docker" / "flow-parser-runner.Dockerfile"
    ).read_text(encoding="utf-8")
    dev_runtime_text = backend_text.split("FROM runtime-base AS dev-runtime", maxsplit=1)[1].split(
        "FROM runtime-base AS runtime",
        maxsplit=1,
    )[0]
    runtime_text = backend_text.split("FROM runtime-base AS runtime", maxsplit=1)[1]

    assert '"code2flow>=' not in pyproject_text
    assert '"bandit>=' not in pyproject_text
    assert '"tree-sitter>=' not in pyproject_text
    assert '"tree-sitter-language-pack>=' not in pyproject_text
    assert "pip install --retries 5 --timeout 60 --disable-pip-version-check code2flow bandit" not in backend_text
    assert "install_python_helpers()" not in backend_text
    assert "gitleaks; \\" not in backend_text
    assert "ENV BACKEND_VENV_PATH=/opt/backend-venv" in backend_text
    assert 'uv venv "${BACKEND_VENV_PATH}"' in backend_text
    assert 'uv sync --active --frozen --no-dev' in backend_text
    assert "COPY --from=builder /app/.venv /opt/backend-venv" not in backend_text
    assert "COPY --from=builder /opt/backend-venv /opt/backend-venv" not in dev_runtime_text
    assert "COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv" in dev_runtime_text
    assert "mkdir -p /app /opt/backend-venv /root/.cache/uv /app/uploads/zip_files /app/data/runtime" in dev_runtime_text
    assert "COPY --from=builder /opt/backend-venv /opt/backend-venv" in runtime_text
    assert "COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv" not in runtime_text
    assert "COPY --from=builder /usr/bin/gitleaks /usr/local/bin/gitleaks" not in backend_text
    assert "COPY --from=scanner-tools-base /opt/opengrep /opt/opengrep" not in backend_text
    assert "COPY --from=scanner-tools-base /opt/phpstan /opt/phpstan" not in backend_text
    assert "COPY --from=scanner-tools-base /opt/yasa /opt/yasa" not in backend_text
    assert 'ln -sf "${OPENGREP_REAL_BIN}" /usr/local/bin/opengrep.real' not in backend_text
    assert 'ln -sf "${OPENGREP_WRAPPER_BIN}" /usr/local/bin/opengrep' not in backend_text
    assert 'ln -sf "${PHPSTAN_HOME}/phpstan" /usr/local/bin/phpstan' not in backend_text
    assert "opengrep --version;" not in backend_text
    assert "phpstan --version;" not in backend_text
    assert 'if [ -x "${YASA_WRAPPER_BIN}" ]; then' not in backend_text
    assert 'ln -sfn /opt/backend-venv /app/.venv' not in backend_text
    assert 'rm -rf /root/.cache/pip' in backend_text
    assert 'rm -f /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11' in backend_text
    assert "FROM ${DOCKERHUB_LIBRARY_MIRROR}/python:3.11-slim" in yasa_runner_text
    assert "AS yasa-builder" in yasa_runner_text
    assert "AS yasa-runner" in yasa_runner_text
    assert "/opt/yasa/bin/yasa" in yasa_runner_text
    assert "/opt/yasa-runtime" in yasa_runner_text
    assert "COPY frontend/yasa-engine-overrides /tmp/yasa-engine-overrides" in yasa_runner_text
    assert "COPY --from=yasa-builder /opt/yasa-runtime /opt/yasa" in yasa_runner_text
    assert "YASA runner placeholder" not in yasa_runner_text
    assert "COPY --from=node24-base /usr/local/lib/node_modules /usr/local/lib/node_modules" in yasa_runner_text
    assert "\n          nodejs \\\n" not in yasa_runner_text
    assert "\n          npm \\\n" not in yasa_runner_text
    assert "WORKDIR /scan" in yasa_runner_text
    assert "tree-sitter-language-pack" in flow_parser_runner_text
    assert "code2flow" in flow_parser_runner_text
    assert "ARG BACKEND_PYPI_INDEX_CANDIDATES=" in flow_parser_runner_text
    assert 'ENV PYPI_INDEX_CANDIDATES=${BACKEND_PYPI_INDEX_CANDIDATES}' in flow_parser_runner_text
    assert "COPY backend/scripts/package_source_selector.py /usr/local/bin/package_source_selector.py" in flow_parser_runner_text
    assert 'python3 /usr/local/bin/package_source_selector.py --candidates "${raw_candidates}" --kind pypi --timeout-seconds 2' in flow_parser_runner_text
    assert 'for idx in $(printf \'%s\\n\' "${ordered_pypi_indexes}"); do \\' in flow_parser_runner_text
    assert '/opt/flow-parser-venv/bin/pip install --disable-pip-version-check -i "${idx}" -r /tmp/flow-parser-runner.requirements.txt' in flow_parser_runner_text
    assert 'command -v code2flow >/dev/null 2>&1' in flow_parser_runner_text
    assert 'code2flow --help >/dev/null 2>&1' in flow_parser_runner_text
    assert "python3 /opt/flow-parser/flow_parser_runner.py --help >/dev/null 2>&1" in flow_parser_runner_text
    assert 'CMD ["python3", "/opt/flow-parser/flow_parser_runner.py", "--help"]' in flow_parser_runner_text


def test_backend_dockerfile_derives_docker_cli_image_from_selected_mirror() -> None:
    backend_text = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(encoding="utf-8")

    assert "ARG DOCKER_CLI_IMAGE=${DOCKERHUB_LIBRARY_MIRROR}/docker:cli" in backend_text
    assert "ARG DOCKER_CLI_IMAGE=docker.m.daocloud.io/docker:cli" not in backend_text


def test_runner_dockerfiles_exist_for_all_migrated_scanners() -> None:
    opengrep_runner_text = (
        REPO_ROOT / "docker" / "opengrep-runner.Dockerfile"
    ).read_text(encoding="utf-8")
    bandit_runner_text = (
        REPO_ROOT / "docker" / "bandit-runner.Dockerfile"
    ).read_text(encoding="utf-8")
    gitleaks_runner_text = (
        REPO_ROOT / "docker" / "gitleaks-runner.Dockerfile"
    ).read_text(encoding="utf-8")
    phpstan_runner_text = (
        REPO_ROOT / "docker" / "phpstan-runner.Dockerfile"
    ).read_text(encoding="utf-8")
    pmd_runner_text = (REPO_ROOT / "docker" / "pmd-runner.Dockerfile").read_text(
        encoding="utf-8"
    )
    flow_parser_runner_text = (
        REPO_ROOT / "docker" / "flow-parser-runner.Dockerfile"
    ).read_text(encoding="utf-8")

    python_runner_texts = [
        opengrep_runner_text,
        bandit_runner_text,
        phpstan_runner_text,
        flow_parser_runner_text,
    ]
    debian_runner_texts = [gitleaks_runner_text, pmd_runner_text]

    assert "WORKDIR /scan" in opengrep_runner_text
    assert "opengrep" in opengrep_runner_text
    assert "XDG_CACHE_HOME" in opengrep_runner_text
    assert "WORKDIR /scan" in bandit_runner_text
    assert "bandit" in bandit_runner_text
    assert "/opt/bandit-venv" in bandit_runner_text
    assert "WORKDIR /scan" in gitleaks_runner_text
    assert "gitleaks" in gitleaks_runner_text
    assert "download_with_fallback() {" in gitleaks_runner_text
    assert (
        "https://gh-proxy.com/https://github.com/gitleaks/gitleaks/releases/download/"
        in gitleaks_runner_text
    )
    assert (
        "https://v6.gh-proxy.org/https://github.com/gitleaks/gitleaks/releases/download/"
        in gitleaks_runner_text
    )
    assert "WORKDIR /scan" in phpstan_runner_text
    assert "phpstan" in phpstan_runner_text
    assert "download_with_fallback() {" in phpstan_runner_text
    assert (
        "https://gh-proxy.com/https://github.com/phpstan/phpstan/releases/latest/download/phpstan.phar"
        in phpstan_runner_text
    )
    assert (
        "https://v6.gh-proxy.org/https://github.com/phpstan/phpstan/releases/latest/download/phpstan.phar"
        in phpstan_runner_text
    )
    assert "WORKDIR /scan" in pmd_runner_text
    assert "pmd" in pmd_runner_text
    assert "download_with_fallback() {" in pmd_runner_text
    assert (
        "https://gh-proxy.com/https://github.com/pmd/pmd/releases/download/pmd_releases%2F"
        in pmd_runner_text
    )
    assert (
        "https://v6.gh-proxy.org/https://github.com/pmd/pmd/releases/download/pmd_releases%2F"
        in pmd_runner_text
    )
    assert "WORKDIR /scan" in flow_parser_runner_text
    assert "flow_parser_runner.py" in flow_parser_runner_text

    for runner_text in python_runner_texts:
        assert "FROM ${DOCKERHUB_LIBRARY_MIRROR}/python:3.11-slim-trixie" in runner_text
        assert 'rm -f /etc/apt/sources.list.d/debian.sources 2>/dev/null || true;' in runner_text

    for runner_text in debian_runner_texts:
        assert "FROM ${DOCKERHUB_LIBRARY_MIRROR}/debian:trixie-slim" in runner_text
        assert 'rm -f /etc/apt/sources.list.d/debian.sources 2>/dev/null || true;' in runner_text


def test_docker_publish_uses_shared_runtime_image_publish_workflow() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "docker-publish.yml").read_text(
        encoding="utf-8"
    )
    reusable_workflow_text = (
        REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"
    ).read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow_text
    assert "\n  push:\n" not in workflow_text
    assert "concurrency:" in workflow_text
    assert "'v*.*.*'" not in workflow_text
    assert "detect-changes:" not in workflow_text
    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert "actions/upload-artifact@v4" in workflow_text
    assert "release-manifest-json" in workflow_text
    assert "tag:" in workflow_text
    assert "publish-runtime-images:" in workflow_text
    assert "build_yasa_runner" in workflow_text
    assert "build_opengrep_runner" in workflow_text
    assert "build_bandit_runner" in workflow_text
    assert "build_gitleaks_runner" in workflow_text
    assert "build_phpstan_runner" in workflow_text
    assert "build_flow_parser_runner" in workflow_text
    assert "build_sandbox_runner" in workflow_text
    assert "build_sandbox:" not in workflow_text
    assert "release_manifest" in workflow_text
    assert "build_nexus_web" not in workflow_text
    assert "./nexus-web/src" not in workflow_text
    assert "dorny/paths-filter@v3" not in workflow_text
    assert "workflow_dispatch 默认输出" not in workflow_text
    assert "tag: ${{ inputs.tag }}" in workflow_text
    assert "build_frontend: ${{ inputs.build_frontend }}" in workflow_text
    assert "build_backend: ${{ inputs.build_backend }}" in workflow_text
    assert "multi_arch: true" in workflow_text
    assert "workflow_call:" in reusable_workflow_text
    assert "docker/build-push-action@v7" in reusable_workflow_text
    assert "./docker/backend.Dockerfile" in reusable_workflow_text
    assert "./docker/frontend.Dockerfile" in reusable_workflow_text
    assert "./docker/yasa-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/opengrep-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/bandit-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/gitleaks-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/phpstan-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/flow-parser-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/pmd-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/sandbox-runner.Dockerfile" in reusable_workflow_text
    assert "./docker/sandbox.Dockerfile" not in reusable_workflow_text
    assert "release-manifest.json" in reusable_workflow_text
    assert 'raw_json="$(docker buildx imagetools inspect "${FINAL_TAG}" --raw)"' in reusable_workflow_text
    assert "publish-backend-amd64:" in reusable_workflow_text
    assert "publish-backend-arm64:" in reusable_workflow_text
    assert "merge-backend-manifest" not in reusable_workflow_text


def test_runtime_image_publish_workflow_centralizes_manifest_inspection_and_visibility() -> None:
    workflow_text = (
        REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"
    ).read_text(encoding="utf-8")

    assert "type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache-runtime-plain-amd64,mode=max" in workflow_text
    assert "type=gha,mode=max,scope=backend-runtime-plain-amd64" in workflow_text
    assert "type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache-runtime-plain-arm64,mode=max" in workflow_text
    assert "type=gha,mode=max,scope=backend-runtime-plain-arm64" in workflow_text
    assert workflow_text.count('raw_json="$(docker buildx imagetools inspect "${FINAL_TAG}" --raw)"') == 2
    assert 'docker buildx imagetools inspect "${FINAL_TAG}" >/dev/null' not in workflow_text
    assert workflow_text.count('docker buildx imagetools inspect "${IMAGE}:${IMAGE_TAG}" --format \'{{.Manifest.Digest}}\'') == 0
    assert "publish-package-visibility:" in workflow_text
    assert "name: Update published GHCR package visibility" in workflow_text
    assert workflow_text.count('gh api --method PATCH "/user/packages/container/${PACKAGE_NAME}" -f visibility=public --silent 2>/dev/null') == 1
    assert "设置前端 GHCR 包为公开可见性" not in workflow_text
    assert "设置后端 GHCR 包为公开可见性" not in workflow_text
    assert "设置 YASA runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 OpenGrep runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 Bandit runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 Gitleaks runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 PHPStan runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 flow-parser runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 PMD runner GHCR 包为公开可见性" not in workflow_text
    assert "设置 sandbox-runner GHCR 包为公开可见性" not in workflow_text


def test_docker_publish_manual_dispatch_passes_selected_build_inputs_directly() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "docker-publish.yml").read_text(
        encoding="utf-8"
    )

    assert "publish-runtime-images:" in workflow_text
    assert "tag: ${{ inputs.tag }}" in workflow_text
    assert "build_frontend: ${{ inputs.build_frontend }}" in workflow_text
    assert "build_backend: ${{ inputs.build_backend }}" in workflow_text
    assert "build_yasa_runner: ${{ inputs.build_yasa_runner }}" in workflow_text
    assert "build_sandbox_runner: ${{ inputs.build_sandbox_runner }}" in workflow_text
    assert "multi_arch: true" in workflow_text
    assert "emit_release_manifest: true" in workflow_text
    assert "upload-release-manifest-artifact:" in workflow_text
    assert "actions/upload-artifact@v4" in workflow_text
    assert "release-manifest-json" in workflow_text
    assert "detect-changes:" not in workflow_text
    assert "dorny/paths-filter@v3" not in workflow_text


def test_release_workflow_builds_manifest_driven_release_tree() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )
    reusable_workflow_text = (
        REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"
    ).read_text(encoding="utf-8")

    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert "if: ${{ github.event_name == 'push' || github.event_name == 'workflow_dispatch' }}" in workflow_text
    assert "build_frontend: false" in workflow_text
    assert "\n  push:\n" in workflow_text
    assert "workflow_run:" not in workflow_text
    assert "Wait for earlier release runs to finish" in workflow_text
    assert "Setup Node.js for frontend release bundle" in workflow_text
    assert "pnpm --dir frontend install --frozen-lockfile" in workflow_text
    assert "pnpm --dir frontend build" in workflow_text
    assert "cp frontend/nginx.conf" in workflow_text
    assert "generate-release-branch.sh" in workflow_text
    assert "--image-manifest" in workflow_text
    assert "--frontend-bundle" in workflow_text
    assert "--validate" in workflow_text
    assert "ARCH: ${{ matrix.arch }}" in workflow_text
    assert '--arch "${ARCH}"' in workflow_text
    assert "build_sandbox:" not in workflow_text
    assert "docker compose config" in workflow_text
    assert "bash ./Vulhunter-offline-bootstrap.sh --deploy" in workflow_text
    assert "docker_server_arch" in workflow_text
    assert "smoke_arch" in workflow_text
    assert 'python3 - "${RUNNER_TEMP}/release-tree/release-snapshot-lock.json" "${smoke_arch}"' in workflow_text
    assert "VULHUNTER_RELEASE_PROJECT_NAME: vulhunter-release-smoke" in workflow_text
    assert 'Expected exactly two smoke-test bundle assets for ${smoke_arch}' in workflow_text
    assert 'mkdir -p "${RUNNER_TEMP}/release-tree/images"' in workflow_text
    assert 'cp --reflink=auto "${SNAPSHOT_ASSET_DIR}/"* "${RUNNER_TEMP}/release-tree/images/"' not in workflow_text
    assert 'for asset_name in "${smoke_bundle_assets[@]}"; do' in workflow_text
    assert "docker compose up -d db redis backend" not in workflow_text
    assert "docker compose up -d frontend" not in workflow_text
    assert 'docker compose -p "${VULHUNTER_RELEASE_PROJECT_NAME}" ps || true' in workflow_text
    assert 'docker compose -p "${VULHUNTER_RELEASE_PROJECT_NAME}" logs db redis scan-workspace-init db-bootstrap backend frontend || true' in workflow_text
    assert 'docker compose -p "${VULHUNTER_RELEASE_PROJECT_NAME}" down -v || true' in workflow_text
    assert "service_cid()" not in workflow_text
    assert "docker compose ps -q \"$1\"" not in workflow_text
    assert "service_health()" not in workflow_text
    assert "http://127.0.0.1:3000/api/v1/openapi.json" not in workflow_text
    assert "dashboard_status_code=" not in workflow_text
    assert "WORKFLOW_RUN_ID: ${{ github.event.workflow_run.id }}" not in workflow_text
    assert 'gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/artifacts"' not in workflow_text
    assert 'actions/artifacts/${artifact_id}/zip' not in workflow_text
    assert "release-manifest-json" not in workflow_text
    assert "git push origin HEAD:release" not in workflow_text
    assert "git push --force origin HEAD:release" in workflow_text
    assert "git ls-remote --exit-code --heads origin release" in workflow_text
    assert 'COMPARE_DIR="${RUNNER_TEMP}/release-compare"' in workflow_text
    assert "git_tree_hash_for_dir()" in workflow_text
    assert 'PUBLISH_READY_DIR="${RUNNER_TEMP}/release-tree-publish-ready"' in workflow_text
    assert "git checkout -B release origin/release" not in workflow_text
    assert 'repos/${GITHUB_REPOSITORY}/releases/${SNAPSHOT_RELEASE_ID}' in workflow_text
    assert 'repos/${GITHUB_REPOSITORY}/releases/tags/${SNAPSHOT_TAG}' not in workflow_text
    assert "./scripts/release_version.py" in workflow_text
    assert 'git tag -a "${SEMANTIC_TAG}" "${RELEASE_COMMIT_SHA}"' in workflow_text
    assert 'gh release create "${SEMANTIC_TAG}"' in workflow_text
    assert 'gh release upload "${SEMANTIC_TAG}"' in workflow_text
    assert 'gh release delete "${SNAPSHOT_TAG}" --yes' in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "tags:" not in workflow_text
    assert "STATIC_FRONTEND_IMAGE" in reusable_workflow_text
    assert '"static_frontend": "STATIC_FRONTEND"' in reusable_workflow_text
    assert "Release manifest requires a freshly built backend image ref" in reusable_workflow_text


def test_sandbox_runner_dockerfile_now_carries_the_heavy_runtime_contract() -> None:
    sandbox_runner_text = (REPO_ROOT / "docker" / "sandbox-runner.Dockerfile").read_text(
        encoding="utf-8"
    )
    sandbox_requirements_text = (REPO_ROOT / "docker" / "sandbox-runner.requirements.txt").read_text(
        encoding="utf-8"
    )

    assert "Sandboxed code execution environment for PoC verification (Python-focused)" in sandbox_runner_text
    assert "COPY docker/sandbox-runner.requirements.txt /tmp/sandbox-runner.requirements.txt" in sandbox_runner_text
    assert 'pip install -r /tmp/sandbox-runner.requirements.txt' in sandbox_runner_text
    assert "requests" in sandbox_requirements_text
    assert "aiohttp" in sandbox_requirements_text
    assert "numpy" in sandbox_requirements_text
    assert "python-jose" in sandbox_requirements_text
    assert "/workspace/.VulHunter/runtime/xdg-data" in sandbox_runner_text
    assert "build-essential" in sandbox_runner_text
    assert "Lightweight sandbox runner for on-demand code execution" not in sandbox_runner_text
    assert not (REPO_ROOT / "docker" / "sandbox.Dockerfile").exists()
