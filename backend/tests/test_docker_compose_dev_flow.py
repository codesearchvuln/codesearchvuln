from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_dev_overlay_wires_compose_and_dev_targets() -> None:
    overlay_path = REPO_ROOT / "docker-compose.dev.yml"
    backend_dockerfile = REPO_ROOT / "backend" / "Dockerfile"
    frontend_dockerfile = REPO_ROOT / "frontend" / "Dockerfile"
    backend_entrypoint = REPO_ROOT / "backend" / "scripts" / "dev-entrypoint.sh"

    assert overlay_path.exists()

    overlay_text = overlay_path.read_text(encoding="utf-8")
    assert "target: dev-runtime" in overlay_text
    assert "target: dev" in overlay_text
    assert "./backend:/app" in overlay_text
    assert "./frontend:/app" in overlay_text
    assert "/app/.venv" in overlay_text
    assert "/root/.cache/uv" in overlay_text
    assert "/app/node_modules" in overlay_text
    assert "/pnpm/store" in overlay_text
    assert "${VULHUNTER_FRONTEND_PORT:-3000}:5173" in overlay_text
    assert 'MCP_REQUIRE_ALL_READY_ON_STARTUP: "false"' in overlay_text
    assert 'SKILL_REGISTRY_AUTO_SYNC_ON_STARTUP: "false"' in overlay_text

    backend_text = backend_dockerfile.read_text(encoding="utf-8")
    assert "FROM runtime-base AS dev-runtime" in backend_text
    assert "dev-entrypoint.sh" in backend_text

    frontend_text = frontend_dockerfile.read_text(encoding="utf-8")
    assert " AS dev" in frontend_text

    entrypoint_text = backend_entrypoint.read_text(encoding="utf-8")
    assert "uv sync --frozen --no-dev" in entrypoint_text
    assert "app.main:app --reload" in entrypoint_text
    assert 'rm -rf "${VENV_DIR}"' not in entrypoint_text
    assert 'find "${VENV_DIR}" -mindepth 1 -maxdepth 1' in entrypoint_text
