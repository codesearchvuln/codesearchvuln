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
            "backend": {
                "ref": "ghcr.io/acme-sec/vulhunter-backend@sha256:" + "1" * 64,
            },
            "sandbox": {
                "ref": "ghcr.io/acme-sec/vulhunter-sandbox@sha256:" + "2" * 64,
            },
            "sandbox_runner": {
                "ref": "ghcr.io/acme-sec/vulhunter-sandbox-runner@sha256:" + "3" * 64,
            },
            "scanner_yasa": {
                "ref": "ghcr.io/acme-sec/vulhunter-yasa-runner@sha256:" + "4" * 64,
            },
            "scanner_opengrep": {
                "ref": "ghcr.io/acme-sec/vulhunter-opengrep-runner@sha256:" + "5" * 64,
            },
            "scanner_bandit": {
                "ref": "ghcr.io/acme-sec/vulhunter-bandit-runner@sha256:" + "6" * 64,
            },
            "scanner_gitleaks": {
                "ref": "ghcr.io/acme-sec/vulhunter-gitleaks-runner@sha256:" + "7" * 64,
            },
            "scanner_phpstan": {
                "ref": "ghcr.io/acme-sec/vulhunter-phpstan-runner@sha256:" + "8" * 64,
            },
            "scanner_pmd": {
                "ref": "ghcr.io/acme-sec/vulhunter-pmd-runner@sha256:" + "9" * 64,
            },
            "flow_parser_runner": {
                "ref": "ghcr.io/acme-sec/vulhunter-flow-parser-runner@sha256:" + "a" * 64,
            },
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
            "    location /api/ { proxy_pass http://backend:8000/api/; }\n"
            "}\n"
        ),
        encoding="utf-8",
    )
    return path


def _run_release_generator(
    output_dir: Path, manifest_path: Path, frontend_bundle_path: Path
) -> subprocess.CompletedProcess[str]:
    script_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    env = os.environ.copy()
    env["PATH"] = f"/usr/bin:/bin:{env['PATH']}"

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
        env=env,
        capture_output=True,
        text=True,
    )


def _assert_nexus_runtime_bundle(output_dir: Path, bundle_name: str) -> None:
    bundle_root = output_dir / bundle_name
    assert bundle_root.exists(), bundle_name
    assert (bundle_root / "dist" / "index.html").exists(), f"{bundle_name}/dist/index.html"
    assert (bundle_root / "nginx.conf").exists(), f"{bundle_name}/nginx.conf"
    assert {path.name for path in bundle_root.iterdir()} == {"dist", "nginx.conf"}
    assert not (bundle_root / "src").exists(), f"{bundle_name}/src"
    assert not (bundle_root / "node_modules").exists(), f"{bundle_name}/node_modules"
    assert not (bundle_root / "tests").exists(), f"{bundle_name}/tests"
    assert not (bundle_root / "package.json").exists(), f"{bundle_name}/package.json"


def test_release_workflow_orchestrates_manifest_driven_release_branch() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )
    publish_workflow_text = (REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml").read_text(
        encoding="utf-8"
    )

    generator_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    publish_workflow_path = REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"

    assert generator_path.exists()
    assert publish_workflow_path.exists()
    assert "workflow_run:" in workflow_text
    assert "Docker Publish" in workflow_text
    assert "types:" in workflow_text
    assert "- completed" in workflow_text
    assert "\n  push:\n" not in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "refresh_backend_image:" in workflow_text
    assert "publish_backend_hardened:" in workflow_text
    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert "build_frontend: false" in workflow_text
    assert (
        "build_backend: ${{ github.event_name == 'workflow_dispatch' && (inputs.refresh_backend_image || inputs.refresh_all_runtime_images) || false }}"
    ) in workflow_text
    assert (
        "publish_backend_hardened: ${{ github.event_name == 'workflow_dispatch' && "
        "inputs.publish_backend_hardened || false }}"
    ) in workflow_text
    assert "build-frontend-bundle:" in workflow_text
    assert "assemble-release-tree:" in workflow_text
    assert "package-offline-images:" in workflow_text
    assert "smoke-test-release-tree:" in workflow_text
    assert "publish-release-assets-and-branch:" in workflow_text
    assert "Setup Node.js for frontend release bundle" in workflow_text
    assert "Setup pnpm for frontend release bundle" in workflow_text
    assert "uses: pnpm/action-setup@v5" in workflow_text
    assert "package_json_file: frontend/package.json" in workflow_text
    assert workflow_text.index("uses: pnpm/action-setup@v5") < workflow_text.index("cache: pnpm")
    assert "pnpm install --frozen-lockfile" in workflow_text
    assert "pnpm build" in workflow_text
    assert "upload-artifact@v4" in workflow_text
    assert "download-artifact@v4" in workflow_text
    assert "--frontend-bundle" in workflow_text
    assert "release-manifest.json" in workflow_text
    assert "images-manifest-amd64.json" in workflow_text
    assert "images-manifest-arm64.json" in workflow_text
    assert "vulhunter-images-amd64.tar.zst" in workflow_text
    assert "vulhunter-images-arm64.tar.zst" in workflow_text
    assert "package-release-images.sh" in workflow_text
    assert "--arch ${{ matrix.arch }}" in workflow_text
    assert "matrix:" in workflow_text
    assert "gh release create" in workflow_text
    assert "gh release upload" in workflow_text
    assert "--image-manifest" in workflow_text
    assert "docker compose config" in workflow_text
    assert "docker compose up -d db redis backend frontend" in workflow_text
    assert "/health" in workflow_text
    assert "http://127.0.0.1:3000/" in workflow_text
    assert "git push --force origin HEAD:release" in workflow_text
    assert "fetch-depth: 0" in workflow_text
    assert "git checkout --orphan" in workflow_text
    assert "origin/release" not in workflow_text
    assert "git fetch origin release" not in workflow_text
    assert "git checkout -B release origin/release" not in workflow_text
    assert "git ls-remote --tags" in workflow_text
    assert "git push origin --delete" in workflow_text
    assert "release-tag-cleanup.txt" in workflow_text
    assert 'release_id=""' in workflow_text
    assert "docker-publish.yml" not in workflow_text
    assert "publish_backend_hardened:" in publish_workflow_text
    assert "target: runtime-release" in publish_workflow_text
    assert "target: runtime-cython" in publish_workflow_text
    assert "buildcache-runtime-release-amd64" in publish_workflow_text
    assert "buildcache-runtime-release-arm64" in publish_workflow_text
    assert "buildcache-runtime-cython" in publish_workflow_text
    assert "-hardened" in publish_workflow_text


def test_scheduled_release_workflow_triggers_end_to_end_release_pipeline() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "scheduled-release.yml").read_text(
        encoding="utf-8"
    )

    assert "git describe --tags" not in workflow_text
    assert "git tag -a" not in workflow_text
    assert "git push origin ${{ steps.check.outputs.version }}" not in workflow_text
    assert "gh workflow run release.yml" in workflow_text
    assert "docker-publish.yml" not in workflow_text
    assert "-f build_frontend=true" not in workflow_text
    assert "-f build_backend=true" not in workflow_text
    assert "-f refresh_backend_image=true" not in workflow_text


def test_release_helper_script_no_longer_creates_or_pushes_git_tags() -> None:
    script_text = (REPO_ROOT / "scripts" / "release.sh").read_text(encoding="utf-8")

    assert 'git tag -a "v$NEW_VERSION"' not in script_text
    assert 'git push origin "v$NEW_VERSION"' not in script_text
    assert "已创建本地 tag" not in script_text


def test_release_generator_requires_image_manifest(tmp_path: Path) -> None:
    script_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    output_dir = tmp_path / "release-tree"
    result = subprocess.run(
        [str(script_path), "--output", str(output_dir)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode != 0
    assert "--image-manifest is required" in combined_output


def test_release_generator_emits_binary_only_runtime_tree(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    required_paths = [
        "README.md",
        "README_EN.md",
        "docker-compose.yml",
        "images-manifest.json",
        "scripts/README-COMPOSE.md",
        "scripts/load-images.sh",
        "scripts/use-offline-env.sh",
        "docker/env/backend/env.example",
        "docker/env/backend/offline-images.env.example",
        "deploy/runtime/frontend/site/index.html",
        "deploy/runtime/frontend/nginx/default.conf",
        "nexus-web/dist/index.html",
        "nexus-web/nginx.conf",
        "nexus-itemDetail/dist/index.html",
        "nexus-itemDetail/nginx.conf",
    ]
    for rel_path in required_paths:
        assert (output_dir / rel_path).exists(), rel_path

    forbidden_paths = [
        "backend",
        "frontend",
        ".github",
        "docs",
        "docker-compose.full.yml",
        "docker-compose.hybrid.yml",
        "docker-compose.self-contained.yml",
        "docker/backend.Dockerfile",
        "docker/frontend.Dockerfile",
        "scripts/compose-up-local-build.sh",
        "scripts/compose-up-with-fallback.sh",
        "deploy/compose",
    ]
    for rel_path in forbidden_paths:
        assert not (output_dir / rel_path).exists(), rel_path

    _assert_nexus_runtime_bundle(output_dir, "nexus-web")
    _assert_nexus_runtime_bundle(output_dir, "nexus-itemDetail")


def test_release_generator_renders_digest_pinned_runtime_compose(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    compose_text = (output_dir / "docker-compose.yml").read_text(encoding="utf-8")

    assert not (output_dir / "docker-compose.hybrid.yml").exists()
    assert "docker-compose.full.yml" not in compose_text
    assert "docker-compose.self-contained.yml" not in compose_text
    assert "VULHUNTER_IMAGE_TAG" not in compose_text
    assert manifest["images"]["backend"]["ref"] in compose_text
    assert manifest["images"]["sandbox"]["ref"] in compose_text
    assert manifest["images"]["sandbox_runner"]["ref"] in compose_text
    assert manifest["images"]["scanner_yasa"]["ref"] in compose_text
    assert manifest["images"]["scanner_opengrep"]["ref"] in compose_text
    assert manifest["images"]["scanner_bandit"]["ref"] in compose_text
    assert manifest["images"]["scanner_gitleaks"]["ref"] in compose_text
    assert manifest["images"]["scanner_phpstan"]["ref"] in compose_text
    assert manifest["images"]["scanner_pmd"]["ref"] in compose_text
    assert manifest["images"]["flow_parser_runner"]["ref"] in compose_text
    assert "image: ${BACKEND_IMAGE:-ghcr.io/acme-sec/vulhunter-backend@sha256:" in compose_text
    assert "image: ${STATIC_FRONTEND_IMAGE:-${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}/nginx:1.27-alpine}" in compose_text
    assert "./deploy/runtime/frontend/site:/usr/share/nginx/html:ro" in compose_text
    assert "./deploy/runtime/frontend/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" in compose_text
    assert compose_text.count("build:") == 2
    assert "image: ${NEXUS_WEB_IMAGE:-vulhunter/nexus-web-local:latest}" in compose_text
    assert "image: ${NEXUS_ITEM_DETAIL_IMAGE:-vulhunter/nexus-item-detail-local:latest}" in compose_text
    assert "context: ./nexus-web" in compose_text
    assert "context: ./nexus-itemDetail" in compose_text
    assert "dockerfile_inline: |" in compose_text
    assert "FROM ${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}/nginx:alpine" in compose_text
    assert "vulhunter-backend:${VULHUNTER_IMAGE_TAG:-latest}" not in compose_text
    assert "image: ${FRONTEND_IMAGE:-" not in compose_text


def test_release_generator_rejects_incomplete_release_manifest(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    del manifest["images"]["backend"]
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "missing required image ref: backend" in combined_output


def test_generated_release_docs_only_publish_runtime_distribution_command(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    docs = (
        (output_dir / "README.md").read_text(encoding="utf-8"),
        (output_dir / "README_EN.md").read_text(encoding="utf-8"),
        (output_dir / "scripts" / "README-COMPOSE.md").read_text(encoding="utf-8"),
    )
    for doc in docs:
        assert "docker compose up" in doc
        assert "load-images.sh" in doc
        assert "offline-images.env" in doc
        assert "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" not in doc
        assert "在线" in doc or "offline" in doc or "离线" in doc or "online" in doc
        assert "docker-compose.full.yml" not in doc
        assert "docker-compose.self-contained.yml" not in doc
        assert "docker/env/backend/env.example" in doc
        assert "docker/env/backend/.env" in doc
        assert "LLM_API_KEY" in doc
        assert "STATIC_FRONTEND_IMAGE" in doc or "静态文件" in doc or "static assets" in doc
        assert "nexus-web" in doc
        assert "nexus-itemDetail" in doc


def test_release_generator_emits_offline_metadata_and_scripts(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    metadata = json.loads((output_dir / "images-manifest.json").read_text(encoding="utf-8"))
    offline_env = (output_dir / "docker" / "env" / "backend" / "offline-images.env.example").read_text(
        encoding="utf-8"
    )
    load_script = (output_dir / "scripts" / "load-images.sh").read_text(encoding="utf-8")
    use_offline_env_script = (output_dir / "scripts" / "use-offline-env.sh").read_text(encoding="utf-8")

    assert metadata["revision"] == manifest["revision"]
    assert metadata["bundle_template"] == "images/vulhunter-images-{arch}.tar.zst"
    assert metadata["images"]["backend"]["source_ref"] == manifest["images"]["backend"]["ref"]
    assert metadata["images"]["backend"]["local_tag"] == f"vulhunter-local/backend:{manifest['revision']}"
    assert metadata["images"]["static_frontend"]["source_ref"] == "docker.m.daocloud.io/library/nginx:1.27-alpine"
    assert metadata["images"]["static_frontend"]["local_tag"] == f"vulhunter-local/static-frontend-nginx:{manifest['revision']}"
    assert metadata["images"]["scanner_yasa"]["local_tag"] == f"vulhunter-local/yasa-runner:{manifest['revision']}"
    assert f"BACKEND_IMAGE=vulhunter-local/backend:{manifest['revision']}" in offline_env
    assert f"STATIC_FRONTEND_IMAGE=vulhunter-local/static-frontend-nginx:{manifest['revision']}" in offline_env
    assert "\nFRONTEND_IMAGE=" not in offline_env
    assert "RUNNER_PREFLIGHT_OFFLINE_MODE=true" in offline_env
    assert "vulhunter-images-${arch}.tar.zst" in load_script
    assert "images-manifest.json" in load_script
    assert "docker load" in load_script
    assert "docker tag" in load_script
    assert "docker/env/backend/offline-images.env" in use_offline_env_script
    assert "docker compose up -d" in use_offline_env_script


def test_package_release_images_script_supports_single_arch_mode() -> None:
    script_text = (REPO_ROOT / "scripts" / "package-release-images.sh").read_text(encoding="utf-8")

    assert "Usage: package-release-images.sh --image-manifest <file> --output-dir <dir> --arch <amd64|arm64>" in script_text
    assert 'ARCH=""' in script_text
    assert "--arch)" in script_text
    assert '[[ -n "$ARCH" ]] || die "--arch is required"' in script_text
    assert '[[ "$ARCH" == "amd64" || "$ARCH" == "arm64" ]] || die "unsupported arch: $ARCH"' in script_text
    assert 'python3 - "$IMAGE_MANIFEST" "$OUTPUT_DIR" "$ARCH"' in script_text
    assert 'bundle_path = output_dir / f"vulhunter-images-{arch}.tar.zst"' in script_text
    assert 'metadata_path = output_dir / f"images-manifest-{arch}.json"' in script_text
    assert 'for arch in ("amd64", "arm64"):' not in script_text
