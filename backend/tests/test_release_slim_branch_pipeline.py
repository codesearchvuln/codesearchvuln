import hashlib
import json
import os
import re
import stat
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_workflows_pin_setup_node_to_24_and_force_js_actions_to_node24() -> None:
    workflow_dir = REPO_ROOT / ".github" / "workflows"
    workflow_paths = sorted(workflow_dir.glob("*.yml"))

    assert workflow_paths

    for workflow_path in workflow_paths:
        text = workflow_path.read_text(encoding="utf-8")
        assert 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"' in text
        assert "node-version: 20" not in text
        if "actions/setup-node@v4" in text:
            assert "node-version: 24" in text


def _write_release_manifest(path: Path) -> dict[str, object]:
    manifest = {
        "revision": "deadbeefcafebabe0123456789abcdef01234567",
        "generated_at": "2026-04-13T12:00:00Z",
        "images": {
            "backend": {
                "ref": "ghcr.io/acme-sec/vulhunter-backend@sha256:" + "1" * 64,
            },
            "postgres": {
                "ref": "ghcr.io/acme-sec/postgres@sha256:" + "a" * 64,
            },
            "redis": {
                "ref": "ghcr.io/acme-sec/redis@sha256:" + "b" * 64,
            },
            "adminer": {
                "ref": "ghcr.io/acme-sec/adminer@sha256:" + "c" * 64,
            },
            "scan_workspace_init": {
                "ref": "ghcr.io/acme-sec/scan-workspace-init@sha256:" + "d" * 64,
            },
            "static_frontend": {
                "ref": "ghcr.io/acme-sec/static-frontend@sha256:" + "e" * 64,
            },
            "sandbox_runner": {
                "ref": "ghcr.io/acme-sec/vulhunter-sandbox-runner@sha256:" + "2" * 64,
            },
            "scanner_yasa": {
                "ref": "ghcr.io/acme-sec/vulhunter-yasa-runner@sha256:" + "3" * 64,
            },
            "scanner_opengrep": {
                "ref": "ghcr.io/acme-sec/vulhunter-opengrep-runner@sha256:" + "4" * 64,
            },
            "scanner_bandit": {
                "ref": "ghcr.io/acme-sec/vulhunter-bandit-runner@sha256:" + "5" * 64,
            },
            "scanner_gitleaks": {
                "ref": "ghcr.io/acme-sec/vulhunter-gitleaks-runner@sha256:" + "6" * 64,
            },
            "scanner_phpstan": {
                "ref": "ghcr.io/acme-sec/vulhunter-phpstan-runner@sha256:" + "7" * 64,
            },
            "scanner_pmd": {
                "ref": "ghcr.io/acme-sec/vulhunter-pmd-runner@sha256:" + "8" * 64,
            },
            "flow_parser_runner": {
                "ref": "ghcr.io/acme-sec/vulhunter-flow-parser-runner@sha256:" + "9" * 64,
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
        (REPO_ROOT / "frontend" / "nginx.conf").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    return path


def _run_release_generator(
    output_dir: Path, manifest_path: Path, frontend_bundle_path: Path, *, validate: bool = False
) -> subprocess.CompletedProcess[str]:
    script_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    env = os.environ.copy()
    env["PATH"] = f"/usr/bin:/bin:{env['PATH']}"

    command = [
        str(script_path),
        "--output",
        str(output_dir),
        "--image-manifest",
        str(manifest_path),
        "--frontend-bundle",
        str(frontend_bundle_path),
    ]
    if validate:
        command.append("--validate")

    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def _install_fake_runtime_tools(tmp_path: Path) -> Path:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    docker_script = bin_dir / "docker"
    docker_script.write_text(
        """#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


log_path = Path(os.environ["FAKE_DOCKER_LOG"])
log_path.parent.mkdir(parents=True, exist_ok=True)

with log_path.open("a", encoding="utf-8") as handle:
    handle.write(" ".join(sys.argv[1:]) + "\\n")

cmd = sys.argv[1:]
if not cmd:
    raise SystemExit("missing docker command")

if cmd[0] == "pull":
    raise SystemExit(0)
if cmd[0] == "tag":
    raise SystemExit(0)
if cmd[0] == "save":
    for image in cmd[1:]:
        sys.stdout.buffer.write(f"{image}\\n".encode("utf-8"))
    sys.stdout.buffer.flush()
    raise SystemExit(0)
if cmd[:2] == ["image", "rm"]:
    raise SystemExit(0)

raise SystemExit(f"unsupported docker command: {' '.join(cmd)}")
""",
        encoding="utf-8",
    )
    docker_script.chmod(docker_script.stat().st_mode | stat.S_IXUSR)

    zstd_script = bin_dir / "zstd"
    zstd_script.write_text(
        """#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


args = sys.argv[1:]
log_path = Path(os.environ["FAKE_ZSTD_LOG"])
log_path.parent.mkdir(parents=True, exist_ok=True)
with log_path.open("a", encoding="utf-8") as handle:
    handle.write(" ".join(args) + "\\n")
output_path = Path(args[args.index("-o") + 1])
output_path.write_bytes(b"fake-zstd\\n" + sys.stdin.buffer.read())
""",
        encoding="utf-8",
    )
    zstd_script.chmod(zstd_script.stat().st_mode | stat.S_IXUSR)
    return bin_dir


def _run_package_release_images(
    tmp_path: Path, manifest_path: Path, *, bundle: str, arch: str = "amd64"
) -> tuple[subprocess.CompletedProcess[str], Path, Path, Path]:
    script_path = REPO_ROOT / "scripts" / "package-release-images.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    bin_dir = _install_fake_runtime_tools(tmp_path)
    docker_log = tmp_path / "docker.log"
    zstd_log = tmp_path / "zstd.log"
    output_dir = tmp_path / "release-assets"
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(docker_log)
    env["FAKE_ZSTD_LOG"] = str(zstd_log)

    result = subprocess.run(
        [
            str(script_path),
            "--image-manifest",
            str(manifest_path),
            "--output-dir",
            str(output_dir),
            "--bundle",
            bundle,
            "--arch",
            arch,
        ],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    return result, output_dir, docker_log, zstd_log


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
    docker_publish_text = (REPO_ROOT / ".github" / "workflows" / "docker-publish.yml").read_text(
        encoding="utf-8"
    )
    publish_workflow_text = (REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml").read_text(
        encoding="utf-8"
    )

    generator_path = REPO_ROOT / "scripts" / "generate-release-branch.sh"
    publish_workflow_path = REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"

    assert generator_path.exists()
    assert publish_workflow_path.exists()
    assert "workflow_call:" in workflow_text
    assert "source_sha:" in workflow_text
    assert "release_manifest:" in workflow_text
    assert "workflow_run:" in workflow_text
    assert "WORKFLOW_RUN_ID" in workflow_text
    assert "Docker Publish" in workflow_text
    assert "\n  push:\n" not in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "reuse_existing_images:" in workflow_text
    assert (
        "Skip runtime image builds and reuse the current `latest` digests on GHCR"
        in workflow_text
    )
    assert "prepare-release:" in workflow_text
    assert "create-draft-release:" in workflow_text
    assert "GH_REPO: ${{ github.repository }}" in workflow_text
    assert "publish-runtime-images:" in workflow_text
    assert "resolve-release-manifest:" in workflow_text
    assert (
        "if: ${{ always() && needs.resolve-entry.result == 'success' && "
        "needs.prepare-release.result == 'success' && ((github.event_name == "
        "'workflow_dispatch' && needs.publish-runtime-images.result == 'success') || "
        "(github.event_name != 'workflow_dispatch' && "
        "(needs.publish-runtime-images.result == 'skipped' || "
        "needs.publish-runtime-images.result == 'success'))) }}"
    ) in workflow_text
    assert "package-offline-images:" in workflow_text
    assert "finalize-publish:" in workflow_text
    assert "cleanup-draft-release:" in workflow_text
    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert "if: ${{ github.event_name == 'workflow_dispatch' }}" in workflow_text
    assert "build_frontend: false" in workflow_text
    assert (
        "build_backend: ${{ github.event_name == 'workflow_dispatch' && "
        "!inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_backend) || false }}"
    ) in workflow_text
    assert "build_backend: true" not in workflow_text
    assert (
        "build_yasa_runner: ${{ github.event_name == 'workflow_dispatch' && "
        "!inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_yasa_runner) || false }}"
    ) in workflow_text
    assert (
        "build_sandbox_runner: ${{ github.event_name == 'workflow_dispatch' && "
        "!inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_sandbox_runner) || false }}"
    ) in workflow_text
    assert "build_sandbox:" not in workflow_text
    assert "runtime_tag" in workflow_text
    assert "snapshot_tag" in workflow_text
    assert "snapshot_title" in workflow_text
    assert "snapshot_release_id" in workflow_text
    assert 'repos/${GITHUB_REPOSITORY}/releases/${SNAPSHOT_RELEASE_ID}' in workflow_text
    assert 'repos/${GITHUB_REPOSITORY}/releases/tags/${SNAPSHOT_TAG}' not in workflow_text
    assert "release-assets-${source_sha}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" in workflow_text
    assert "build-frontend-bundle:" not in workflow_text
    assert "assemble-release-tree:" not in workflow_text
    assert "smoke-test-release-tree:" not in workflow_text
    assert "publish-release-assets-and-branch:" not in workflow_text
    assert "Setup Node.js for frontend release bundle" in workflow_text
    assert "Setup pnpm for frontend release bundle" in workflow_text
    assert "uses: pnpm/action-setup@v5" in workflow_text
    assert "package_json_file: frontend/package.json" in workflow_text
    assert workflow_text.index("uses: pnpm/action-setup@v5") < workflow_text.index("cache: pnpm")
    assert "pnpm --dir frontend install --frozen-lockfile" in workflow_text
    assert "pnpm --dir frontend build" in workflow_text
    assert "cp -R frontend/dist/. " in workflow_text
    assert "cp frontend/nginx.conf " in workflow_text
    assert "deploy/frontend/default.conf" not in workflow_text
    assert "upload-artifact@v4" not in workflow_text
    assert "download-artifact@v4" not in workflow_text
    assert 'gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/artifacts"' in workflow_text
    assert 'actions/artifacts/${artifact_id}/zip' in workflow_text
    assert "release-manifest-json" in workflow_text
    assert "name: frontend-release-bundle" not in workflow_text
    assert "name: release-tree" not in workflow_text
    assert "name: release-assets-services-amd64" not in workflow_text
    assert "name: release-assets-services-arm64" not in workflow_text
    assert "name: release-assets-scanner-amd64" not in workflow_text
    assert "name: release-assets-scanner-arm64" not in workflow_text
    assert "--frontend-bundle" in workflow_text
    assert "release-manifest.json" in workflow_text
    assert "release-snapshot-lock.json" in workflow_text
    assert "images-manifest-services-amd64.json" in workflow_text
    assert "images-manifest-services-arm64.json" in workflow_text
    assert "images-manifest-scanner-amd64.json" in workflow_text
    assert "images-manifest-scanner-arm64.json" in workflow_text
    assert "vulhunter-services-images-amd64.tar.zst" in workflow_text
    assert "vulhunter-services-images-arm64.tar.zst" in workflow_text
    assert "vulhunter-scanner-images-amd64.tar.zst" in workflow_text
    assert "vulhunter-scanner-images-arm64.tar.zst" in workflow_text
    assert "package-release-images.sh" in workflow_text
    assert "BUNDLE: ${{ matrix.bundle }}" in workflow_text
    assert '--bundle "${BUNDLE}"' in workflow_text
    assert "ARCH: ${{ matrix.arch }}" in workflow_text
    assert '--arch "${ARCH}"' in workflow_text
    assert "matrix:" in workflow_text
    assert "compression-level: 0" not in workflow_text
    assert "gh release create" in workflow_text
    assert "gh release upload" in workflow_text
    assert "gh release edit" in workflow_text
    assert "--draft" in workflow_text
    assert "--draft=false" not in workflow_text
    assert workflow_text.count("--latest=false") >= 3
    assert 'gh release upload "${SNAPSHOT_TAG}"' in workflow_text
    assert 'gh release download "${SNAPSHOT_TAG}"' not in workflow_text
    assert 'gh release create "${SEMANTIC_TAG}"' in workflow_text
    assert 'gh release edit "${SEMANTIC_TAG}"' in workflow_text
    assert 'gh release upload "${SEMANTIC_TAG}"' in workflow_text
    assert "./scripts/release-assets/offline-bootstrap.sh#AuditTool-offline-bootstrap.sh" in workflow_text
    assert workflow_text.count("AuditTool-offline-bootstrap.sh") == 1
    assert 'git tag -a "${SEMANTIC_TAG}" "${RELEASE_COMMIT_SHA}"' in workflow_text
    assert "generated_by=release.yml" in workflow_text
    assert "./scripts/release_version.py" in workflow_text
    assert "./scripts/download-release-assets.py" in workflow_text
    assert "--github-output \"$GITHUB_OUTPUT\"" in workflow_text
    assert "write-release-snapshot-lock.py" in workflow_text
    assert "--image-manifest" in workflow_text
    assert "docker compose config" in workflow_text
    assert workflow_text.count("set -euo pipefail") >= 10
    assert "DOCKER_SOCKET_GID" in workflow_text
    assert "stat -c '%g'" in workflow_text
    assert 'mkdir -p "${RUNNER_TEMP}/release-tree/images"' in workflow_text
    assert 'cp --reflink=auto "${SNAPSHOT_ASSET_DIR}/"* "${RUNNER_TEMP}/release-tree/images/"' in workflow_text
    assert "bash ./scripts/offline-up.sh" in workflow_text
    assert "SNAPSHOT_ASSET_DIR: ${{ runner.temp }}/snapshot-assets" in workflow_text
    assert "SNAPSHOT_RELEASE_ID: ${{ needs.create-draft-release.outputs.snapshot_release_id }}" in workflow_text
    assert "Finalize preflight" in workflow_text
    assert "Inspect snapshot draft release" in workflow_text
    assert "docker compose up -d db redis backend" not in workflow_text
    assert "docker compose up -d frontend" not in workflow_text
    assert "docker compose logs db redis scan-workspace-init db-bootstrap backend frontend" in workflow_text
    assert "service_cid()" not in workflow_text
    assert "docker compose ps -q \"$1\"" not in workflow_text
    assert "service_health()" not in workflow_text
    assert "curl -fsS http://127.0.0.1:8000/health" not in workflow_text
    assert "actions/upload-artifact@v4" in docker_publish_text
    assert "upload-release-manifest-artifact:" in docker_publish_text
    assert "release-manifest-json" in docker_publish_text
    assert "uses: ./.github/workflows/release.yml" not in docker_publish_text
    assert "curl -fsS http://127.0.0.1:3000/" not in workflow_text
    assert "curl -fsS http://127.0.0.1:3000/api/v1/openapi.json" not in workflow_text
    assert "dashboard_status_code=" not in workflow_text
    assert "projects_status_code=" not in workflow_text
    assert 'case "${dashboard_status_code}" in' not in workflow_text
    assert 'case "${projects_status_code}" in' not in workflow_text
    assert "http://127.0.0.1:3000/" not in workflow_text
    assert "git push origin HEAD:release" in workflow_text
    assert "- name: Download snapshot draft release assets" in workflow_text
    assert "./scripts/download-release-assets.py" in workflow_text
    assert workflow_text.index("write-release-snapshot-lock.py") < workflow_text.index(
        'git push origin HEAD:release'
    )
    assert workflow_text.index('git push origin HEAD:release') < workflow_text.index(
        '- name: Resolve semantic release version'
    )
    assert "fetch-depth: 0" in workflow_text
    assert "git checkout --orphan" in workflow_text
    assert "git ls-remote --exit-code --heads origin release" in workflow_text
    assert "git fetch --force origin release:refs/remotes/origin/release" in workflow_text
    assert "git checkout -B release origin/release" in workflow_text
    assert "git fetch --force --tags origin" in workflow_text
    assert "git push origin --delete" not in workflow_text
    assert "git push --force origin HEAD:release" not in workflow_text
    assert "release-tag-cleanup.txt" not in workflow_text
    assert "release-assets-latest" not in workflow_text
    assert "docker-publish.yml" not in workflow_text
    assert "actions: write" not in workflow_text
    assert "actions: read" in workflow_text
    assert "if: ${{ failure() || cancelled() }}" in workflow_text
    assert workflow_text.count("GH_REPO: ${{ github.repository }}") == 4
    assert "isDraft" in workflow_text
    assert 'gh release delete "${SNAPSHOT_TAG}" --yes' in workflow_text
    assert 'gh release edit "${SNAPSHOT_TAG}"' not in workflow_text

    assert "upload-release-manifest-artifact:" in docker_publish_text
    assert "uses: ./.github/workflows/release.yml" not in docker_publish_text
    assert "source_sha: ${{ github.sha }}" not in docker_publish_text
    assert "release_manifest: ${{ needs.publish-runtime-images.outputs.release_manifest }}" not in docker_publish_text
    assert "actions/upload-artifact@v4" in docker_publish_text
    assert "release-manifest-json" in docker_publish_text
    assert (
        "if: ${{ always() && needs.publish-runtime-images.result == 'success' && "
        "needs.publish-runtime-images.outputs.release_manifest != '' }}"
    ) in docker_publish_text
    assert "frontend/**" in docker_publish_text

    assert "build_sandbox:" not in publish_workflow_text
    assert "publish-sandbox:" not in publish_workflow_text
    assert "target: runtime-plain" in publish_workflow_text
    assert "Release manifest requires a freshly built backend image ref" in publish_workflow_text
    assert "BUILD_BACKEND: ${{ inputs.build_backend }}" in publish_workflow_text
    assert (
        'if [[ "${REQUIRE_COMPLETE_MANIFEST}" == "true" && '
        '"${BUILD_BACKEND}" == "true" && -z "${BACKEND_REF}" ]]; then'
    ) in publish_workflow_text
    assert "built_this_run" in publish_workflow_text
    assert "resolved_fallback" in publish_workflow_text
    assert "release-manifest fallback images" in publish_workflow_text
    assert "buildcache-runtime-plain-amd64" in publish_workflow_text
    assert "buildcache-runtime-plain-arm64" in publish_workflow_text


def test_scheduled_release_workflow_has_been_removed() -> None:
    workflow_path = REPO_ROOT / ".github" / "workflows" / "scheduled-release.yml"

    assert not workflow_path.exists()


def test_docker_publish_backend_trigger_respects_paths_filter() -> None:
    """
    Guard against the永真 regression where every push to main rebuilt backend
    regardless of whether backend paths changed, burning quota on no-op runs.
    The trigger must only fire when either (a) workflow_dispatch with
    inputs.build_backend, or (b) the paths-filter detected backend changes.
    """
    docker_publish_text = (
        REPO_ROOT / ".github" / "workflows" / "docker-publish.yml"
    ).read_text(encoding="utf-8")
    build_backend_line = next(
        line for line in docker_publish_text.splitlines() if line.strip().startswith("build_backend:")
    )

    assert (
        "build_backend: ${{ github.event_name == 'workflow_dispatch' && "
        "inputs.build_backend || needs.detect-changes.outputs.backend == 'true' }}"
    ) in docker_publish_text
    # Regression: the永真 clause previously ORed in `github.event_name == 'push'`.
    assert "|| github.event_name == 'push'" not in build_backend_line


def test_docker_publish_paths_ignore_skips_doc_only_pushes() -> None:
    """
    Extended paths-ignore prevents the whole publish-runtime-images + release
    pipeline from firing on doc-only pushes. `*.md` (root) must be ignored but
    `**/*.md` must NOT be used because docker/backend.Dockerfile copies
    backend/README.md as a real image input.
    """
    docker_publish_text = (
        REPO_ROOT / ".github" / "workflows" / "docker-publish.yml"
    ).read_text(encoding="utf-8")

    assert "paths-ignore:" in docker_publish_text
    for pattern in (
        "'**/tests/**'",
        "'**/docs/**'",
        "'tests/**'",
        "'docs/**'",
        "'*.md'",
        "'LICENSE'",
        "'NOTICE'",
        "'.github/ISSUE_TEMPLATE/**'",
        "'.github/PULL_REQUEST_TEMPLATE.md'",
    ):
        assert pattern in docker_publish_text, pattern
    # `**/*.md` would mask backend/README.md which backend.Dockerfile COPYs.
    assert "'**/*.md'" not in docker_publish_text

    backend_dockerfile = (REPO_ROOT / "docker" / "backend.Dockerfile").read_text(
        encoding="utf-8"
    )
    assert "backend/README.md" in backend_dockerfile


def test_release_helper_script_no_longer_creates_or_pushes_git_tags() -> None:
    script_text = (REPO_ROOT / "scripts" / "release.sh").read_text(encoding="utf-8")

    assert 'git tag -a "v$NEW_VERSION"' not in script_text
    assert 'git push origin "v$NEW_VERSION"' not in script_text
    assert "已创建本地 tag" not in script_text
    assert "只读预览模式" in script_text
    assert "release_version.py" in script_text


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
        "images-manifest-services.json",
        "images-manifest-scanner.json",
        "scripts/README-COMPOSE.md",
        "scripts/offline-up.sh",
        "scripts/online-up.sh",
        "scripts/lib/compose-env.sh",
        "scripts/lib/startup-banner.sh",
        "scripts/lib/release-refresh.sh",
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

    release_index = (output_dir / "deploy" / "runtime" / "frontend" / "site" / "index.html").read_text(
        encoding="utf-8"
    )
    assert "fonts.googleapis.com" not in release_index
    assert "fonts.gstatic.com" not in release_index

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
        "scripts/load-images.sh",
        "scripts/use-offline-env.sh",
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
    assert manifest["images"]["postgres"]["ref"] in compose_text
    assert manifest["images"]["redis"]["ref"] in compose_text
    assert manifest["images"]["adminer"]["ref"] in compose_text
    assert manifest["images"]["scan_workspace_init"]["ref"] in compose_text
    assert manifest["images"]["static_frontend"]["ref"] in compose_text
    assert manifest["images"]["sandbox_runner"]["ref"] in compose_text
    assert manifest["images"]["scanner_yasa"]["ref"] in compose_text
    assert manifest["images"]["scanner_opengrep"]["ref"] in compose_text
    assert manifest["images"]["scanner_bandit"]["ref"] in compose_text
    assert manifest["images"]["scanner_gitleaks"]["ref"] in compose_text
    assert manifest["images"]["scanner_phpstan"]["ref"] in compose_text
    assert manifest["images"]["scanner_pmd"]["ref"] in compose_text
    assert manifest["images"]["flow_parser_runner"]["ref"] in compose_text
    assert "image: ${BACKEND_IMAGE:-ghcr.io/acme-sec/vulhunter-backend@sha256:" in compose_text
    assert "image: ${STATIC_FRONTEND_IMAGE:-ghcr.io/acme-sec/static-frontend@sha256:" in compose_text
    assert "SANDBOX_IMAGE" not in compose_text
    assert "start_period: 180s" in compose_text
    assert "./deploy/runtime/frontend/site:/usr/share/nginx/html:ro" in compose_text
    assert "./deploy/runtime/frontend/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" in compose_text
    assert 'group_add:\n      - "${DOCKER_SOCKET_GID:-1001}"' in compose_text
    assert "./nexus-web/dist:/srv/nexus-web:ro" in compose_text
    assert "./nexus-itemDetail/dist:/srv/nexus-item-detail:ro" in compose_text
    assert "/usr/share/nginx/html/nexus:ro" not in compose_text
    assert "/usr/share/nginx/html/nexus-item-detail:ro" not in compose_text
    assert "vulhunter-backend:${VULHUNTER_IMAGE_TAG:-latest}" not in compose_text
    assert "image: ${FRONTEND_IMAGE:-" not in compose_text

    generated_nginx = (output_dir / "deploy" / "runtime" / "frontend" / "nginx" / "default.conf").read_text(
        encoding="utf-8"
    )
    source_nginx = (REPO_ROOT / "frontend" / "nginx.conf").read_text(encoding="utf-8")
    assert generated_nginx == source_nginx
    assert "location /api/" in generated_nginx
    assert "proxy_pass http://backend:8000/api/;" in generated_nginx
    assert "location ^~ /nexus/" in generated_nginx
    assert "alias /srv/nexus-web/;" in generated_nginx
    assert "try_files $uri $uri/ /nexus/index.html;" in generated_nginx
    assert "location ^~ /nexus-item-detail/" in generated_nginx
    assert "alias /srv/nexus-item-detail/;" in generated_nginx
    assert "try_files $uri $uri/ /nexus-item-detail/index.html;" in generated_nginx


def test_release_generator_rejects_incomplete_release_manifest(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    del manifest["images"]["static_frontend"]
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "missing required image ref: static_frontend" in combined_output


def test_release_generator_rejects_nondigest_static_frontend_ref(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    manifest["images"]["static_frontend"]["ref"] = "ghcr.io/acme-sec/static-frontend:latest"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "image ref must be digest-pinned: static_frontend" in combined_output


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
        assert "offline-up.sh" in doc
        assert "online-up.sh" in doc
        assert "VULHUNTER_RELEASE_PROJECT_NAME" in doc
        assert "vulhunter-release" in doc
        assert "volume" in doc.lower() or "卷" in doc
        assert "load-images.sh" not in doc
        assert "use-offline-env.sh" not in doc
        assert "offline-images.env" in doc
        assert "vulhunter-services-images-" in doc
        assert "vulhunter-scanner-images-" in doc
        assert "docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build" not in doc
        assert "在线" in doc or "offline" in doc or "离线" in doc or "online" in doc
        assert "docker-compose.full.yml" not in doc
        assert "docker-compose.self-contained.yml" not in doc
        assert "docker/env/backend/env.example" in doc
        assert "docker/env/backend/.env" in doc
        assert "LLM_API_KEY" in doc
        assert "STATIC_FRONTEND_IMAGE" in doc or "静态文件" in doc or "static assets" in doc
        assert "/api/v1/openapi.json" in doc
        assert "http://localhost:3000/" in doc
        assert "http://localhost:3000/api/v1" in doc
        assert "generated release tree" in doc or "release 包" in doc or "release tree" in doc
        assert "/nexus/" in doc
        assert "/nexus-item-detail/" in doc
        assert "curl -fsS http://localhost:3000/nexus/ >/dev/null" in doc
        assert "curl -fsS http://localhost:3000/nexus-item-detail/ >/dev/null" in doc
        assert "WSL" in doc or "Bash" in doc
        assert "cp " in doc
        assert "./scripts/offline-up.sh" in doc
        assert "./scripts/online-up.sh" in doc
        assert "LLM_API_KEY" in doc
        assert "cloud" in doc.lower() or "云端" in doc
        assert "chmod +x" not in doc
        assert "chmod 666" not in doc
        assert "docker compose down" not in doc or "down -v" in doc

    compose_doc = docs[2]
    assert "VULHUNTER_RELEASE_PROJECT_NAME" in compose_doc
    assert "vulhunter-release" in compose_doc


def test_release_generator_validate_mode_accepts_static_frontend_release_docs(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path, validate=True)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    docs = (
        (output_dir / "README.md").read_text(encoding="utf-8"),
        (output_dir / "README_EN.md").read_text(encoding="utf-8"),
        (output_dir / "scripts" / "README-COMPOSE.md").read_text(encoding="utf-8"),
    )
    for doc in docs:
        assert re.search(r"(^|[^A-Z_])FRONTEND_IMAGE([^A-Z_]|$)", doc) is None


def test_release_generator_emits_offline_metadata_and_scripts(tmp_path: Path) -> None:
    output_dir = tmp_path / "release-tree"
    manifest_path = tmp_path / "release-manifest.json"
    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    manifest = _write_release_manifest(manifest_path)
    result = _run_release_generator(output_dir, manifest_path, frontend_bundle_path)
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    services_metadata = json.loads((output_dir / "images-manifest-services.json").read_text(encoding="utf-8"))
    scanner_metadata = json.loads((output_dir / "images-manifest-scanner.json").read_text(encoding="utf-8"))
    offline_env = (output_dir / "docker" / "env" / "backend" / "offline-images.env.example").read_text(
        encoding="utf-8"
    )
    offline_up_script = (output_dir / "scripts" / "offline-up.sh").read_text(encoding="utf-8")
    online_up_script = (output_dir / "scripts" / "online-up.sh").read_text(encoding="utf-8")
    compose_env_helper = (output_dir / "scripts" / "lib" / "compose-env.sh").read_text(encoding="utf-8")
    startup_banner_helper = (output_dir / "scripts" / "lib" / "startup-banner.sh").read_text(encoding="utf-8")
    release_refresh_helper = (output_dir / "scripts" / "lib" / "release-refresh.sh").read_text(encoding="utf-8")

    assert services_metadata["revision"] == manifest["revision"]
    assert services_metadata["bundle_template"] == "images/vulhunter-services-images-{arch}.tar.zst"
    assert services_metadata["images"]["backend"]["source_ref"] == manifest["images"]["backend"]["ref"]
    assert services_metadata["images"]["backend"]["local_tag"] == f"vulhunter-local/backend:{manifest['revision']}"
    assert services_metadata["images"]["postgres"]["local_tag"] == f"vulhunter-local/postgres:{manifest['revision']}"
    assert services_metadata["images"]["redis"]["local_tag"] == f"vulhunter-local/redis:{manifest['revision']}"
    assert services_metadata["images"]["adminer"]["local_tag"] == f"vulhunter-local/adminer:{manifest['revision']}"
    assert services_metadata["images"]["scan_workspace_init"]["local_tag"] == (
        f"vulhunter-local/scan-workspace-init:{manifest['revision']}"
    )
    assert services_metadata["images"]["static_frontend"]["env_var"] == "STATIC_FRONTEND_IMAGE"
    assert services_metadata["images"]["static_frontend"]["source_ref"] == manifest["images"]["static_frontend"]["ref"]
    assert services_metadata["images"]["static_frontend"]["local_tag"] == (
        f"vulhunter-local/static-frontend:{manifest['revision']}"
    )
    assert "sandbox_runner" not in services_metadata["images"]
    assert "nexus_web" not in services_metadata["images"]
    assert "nexus_item_detail" not in services_metadata["images"]
    assert scanner_metadata["revision"] == manifest["revision"]
    assert scanner_metadata["bundle_template"] == "images/vulhunter-scanner-images-{arch}.tar.zst"
    assert scanner_metadata["images"]["sandbox_runner"]["source_ref"] == manifest["images"]["sandbox_runner"]["ref"]
    assert scanner_metadata["images"]["sandbox_runner"]["local_tag"] == (
        f"vulhunter-local/sandbox-runner:{manifest['revision']}"
    )
    assert scanner_metadata["images"]["scanner_yasa"]["local_tag"] == f"vulhunter-local/yasa-runner:{manifest['revision']}"
    assert "backend" not in scanner_metadata["images"]
    assert "postgres" not in scanner_metadata["images"]
    assert "redis" not in scanner_metadata["images"]
    assert f"BACKEND_IMAGE=vulhunter-local/backend:{manifest['revision']}" in offline_env
    assert f"POSTGRES_IMAGE=vulhunter-local/postgres:{manifest['revision']}" in offline_env
    assert f"REDIS_IMAGE=vulhunter-local/redis:{manifest['revision']}" in offline_env
    assert f"ADMINER_IMAGE=vulhunter-local/adminer:{manifest['revision']}" in offline_env
    assert f"SCAN_WORKSPACE_INIT_IMAGE=vulhunter-local/scan-workspace-init:{manifest['revision']}" in offline_env
    assert f"STATIC_FRONTEND_IMAGE=vulhunter-local/static-frontend:{manifest['revision']}" in offline_env
    assert "\nSANDBOX_IMAGE=" not in offline_env
    assert f"SANDBOX_RUNNER_IMAGE=vulhunter-local/sandbox-runner:{manifest['revision']}" in offline_env
    assert "\nNEXUS_WEB_IMAGE=" not in offline_env
    assert "\nNEXUS_ITEM_DETAIL_IMAGE=" not in offline_env
    assert "\nFRONTEND_IMAGE=" not in offline_env
    assert "RUNNER_PREFLIGHT_OFFLINE_MODE=true" in offline_env
    assert "offline-up" in offline_env
    assert "[offline-up]" in offline_up_script
    assert "RELEASE_REFRESH_HELPER" in offline_up_script
    assert "compose_release" in offline_up_script
    assert "cleanup_release_stack" in offline_up_script
    assert "images-manifest-services.json" in offline_up_script
    assert "images-manifest-scanner.json" in offline_up_script
    assert "docker/env/backend/offline-images.env" in offline_up_script
    assert "docker compose up -d" in offline_up_script
    assert "load_container_socket_env" in offline_up_script
    assert "compose exec -T frontend sh -lc" not in offline_up_script
    assert "urllib.request" in offline_up_script
    assert "VULHUNTER_FRONTEND_PORT" in offline_up_script
    assert "startup-banner.sh" in offline_up_script
    assert "RELEASE_REFRESH_HELPER" in online_up_script
    assert "pull" in online_up_script
    assert "compose_release pull" in online_up_script
    assert "cleanup_release_stack" in online_up_script
    assert "docker compose up -d" in online_up_script
    assert "startup-banner.sh" in online_up_script
    assert "VULHUNTER_RELEASE_PROJECT_NAME" in release_refresh_helper
    assert "vulhunter-release" in release_refresh_helper
    assert "release_compose_project_name" in release_refresh_helper
    assert 'docker ps -aq --filter "label=com.docker.compose.project=' in release_refresh_helper
    assert "compose_release down --remove-orphans" in release_refresh_helper
    assert "docker image rm" in release_refresh_helper
    assert "所有服务已启动" in startup_banner_helper
    assert "All services are up." in startup_banner_helper
    assert "urllib.request" in startup_banner_helper
    assert "deploy/runtime/frontend/site/index.html" in startup_banner_helper
    assert "frontend-nexus" in startup_banner_helper
    assert "frontend-item-detail" in startup_banner_helper
    assert "load_container_socket_gid_env" in offline_up_script
    assert "load_container_socket_env" in compose_env_helper
    assert "load_container_socket_gid_env" in compose_env_helper


def test_package_release_images_script_supports_single_arch_mode() -> None:
    script_text = (REPO_ROOT / "scripts" / "package-release-images.sh").read_text(encoding="utf-8")

    assert (
        "Usage: package-release-images.sh --image-manifest <file> --output-dir <dir> --bundle <services|scanner> --arch <amd64|arm64>"
        in script_text
    )
    assert 'BUNDLE=""' in script_text
    assert 'ARCH=""' in script_text
    assert "--bundle)" in script_text
    assert '[[ -n "$BUNDLE" ]] || die "--bundle is required"' in script_text
    assert '[[ "$BUNDLE" == "services" || "$BUNDLE" == "scanner" ]] || die "unsupported bundle: $BUNDLE"' in script_text
    assert "--arch)" in script_text
    assert '[[ -n "$ARCH" ]] || die "--arch is required"' in script_text
    assert '[[ "$ARCH" == "amd64" || "$ARCH" == "arm64" ]] || die "unsupported arch: $ARCH"' in script_text
    assert 'python3 - "$IMAGE_MANIFEST" "$OUTPUT_DIR" "$BUNDLE" "$ARCH"' in script_text
    assert 'bundle_path = output_dir / f"vulhunter-{bundle}-images-{arch}.tar.zst"' in script_text
    assert 'metadata_path = output_dir / f"images-manifest-{bundle}-{arch}.json"' in script_text
    assert 'for arch in ("amd64", "arm64"):' not in script_text


def test_package_release_images_embedded_python_compiles() -> None:
    script_text = (REPO_ROOT / "scripts" / "package-release-images.sh").read_text(encoding="utf-8")
    start_marker = "<<'PY'\n"
    start = script_text.index(start_marker) + len(start_marker)
    end = script_text.rindex("\nPY")

    compile(script_text[start:end], str(REPO_ROOT / "scripts" / "package-release-images.sh"), "exec")


def test_package_release_images_script_logs_progress_and_preserves_expected_services_order(tmp_path: Path) -> None:
    manifest_path = tmp_path / "release-manifest.json"
    manifest = _write_release_manifest(manifest_path)

    result, output_dir, docker_log, zstd_log = _run_package_release_images(
        tmp_path, manifest_path, bundle="services"
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output
    for marker in (
        "package start:",
        "image order:",
        "pull start: backend",
        "pull end: static_frontend",
        "all pulls complete",
        "bundle stream start:",
        "compression heartbeat:",
        "checksum start:",
        "checksum end:",
        "cleanup end",
    ):
        assert marker in combined_output

    docker_commands = docker_log.read_text(encoding="utf-8").splitlines()
    pull_commands = [line for line in docker_commands if line.startswith("pull ")]
    expected_pulls = [
        f"pull --platform linux/amd64 {manifest['images']['backend']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['postgres']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['redis']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['adminer']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scan_workspace_init']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['static_frontend']['ref']}",
    ]
    assert pull_commands == expected_pulls
    assert pull_commands[-1].endswith(manifest["images"]["static_frontend"]["ref"])
    assert zstd_log.read_text(encoding="utf-8").splitlines() == [
        f"-T0 -3 -q -o {output_dir / 'vulhunter-services-images-amd64.tar.zst'}"
    ]

    bundle_path = output_dir / "vulhunter-services-images-amd64.tar.zst"
    metadata = json.loads((output_dir / "images-manifest-services-amd64.json").read_text(encoding="utf-8"))
    expected_checksum = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
    assert metadata["bundle_sha256"] == expected_checksum


def test_package_release_images_script_logs_progress_and_preserves_expected_scanner_order(tmp_path: Path) -> None:
    manifest_path = tmp_path / "release-manifest.json"
    manifest = _write_release_manifest(manifest_path)

    result, output_dir, docker_log, zstd_log = _run_package_release_images(
        tmp_path, manifest_path, bundle="scanner"
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output
    for marker in (
        "package start:",
        "image order:",
        "pull start: sandbox_runner",
        "pull end: flow_parser_runner",
        "all pulls complete",
        "bundle stream start:",
        "compression heartbeat:",
        "checksum start:",
        "checksum end:",
        "cleanup end",
    ):
        assert marker in combined_output

    docker_commands = docker_log.read_text(encoding="utf-8").splitlines()
    pull_commands = [line for line in docker_commands if line.startswith("pull ")]
    expected_pulls = [
        f"pull --platform linux/amd64 {manifest['images']['sandbox_runner']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_yasa']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_opengrep']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_bandit']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_gitleaks']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_phpstan']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['scanner_pmd']['ref']}",
        f"pull --platform linux/amd64 {manifest['images']['flow_parser_runner']['ref']}",
    ]
    assert pull_commands == expected_pulls
    assert pull_commands[-1].endswith(manifest["images"]["flow_parser_runner"]["ref"])
    assert zstd_log.read_text(encoding="utf-8").splitlines() == [
        f"-T0 -3 -q -o {output_dir / 'vulhunter-scanner-images-amd64.tar.zst'}"
    ]

    bundle_path = output_dir / "vulhunter-scanner-images-amd64.tar.zst"
    metadata = json.loads((output_dir / "images-manifest-scanner-amd64.json").read_text(encoding="utf-8"))
    expected_checksum = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
    assert metadata["bundle_sha256"] == expected_checksum


def test_package_release_images_script_rejects_invalid_manifest_contract(tmp_path: Path) -> None:
    missing_manifest_path = tmp_path / "missing-manifest.json"
    missing_manifest = _write_release_manifest(missing_manifest_path)
    del missing_manifest["images"]["backend"]
    missing_manifest_path.write_text(json.dumps(missing_manifest), encoding="utf-8")

    missing_result, _, _, _ = _run_package_release_images(
        tmp_path / "missing", missing_manifest_path, bundle="services"
    )
    missing_output = "\n".join(part for part in [missing_result.stdout, missing_result.stderr] if part)
    assert missing_result.returncode != 0
    assert "missing required image ref: backend" in missing_output

    nondigest_manifest_path = tmp_path / "nondigest-manifest.json"
    nondigest_manifest = _write_release_manifest(nondigest_manifest_path)
    nondigest_manifest["images"]["backend"]["ref"] = "ghcr.io/acme-sec/vulhunter-backend:latest"
    nondigest_manifest_path.write_text(json.dumps(nondigest_manifest), encoding="utf-8")

    nondigest_result, _, _, _ = _run_package_release_images(
        tmp_path / "nondigest", nondigest_manifest_path, bundle="services"
    )
    nondigest_output = "\n".join(part for part in [nondigest_result.stdout, nondigest_result.stderr] if part)
    assert nondigest_result.returncode != 0
    assert "manifest image ref must be digest-pinned: backend" in nondigest_output

    missing_static_frontend_manifest_path = tmp_path / "missing-static-frontend-manifest.json"
    missing_static_frontend_manifest = _write_release_manifest(missing_static_frontend_manifest_path)
    del missing_static_frontend_manifest["images"]["static_frontend"]
    missing_static_frontend_manifest_path.write_text(
        json.dumps(missing_static_frontend_manifest), encoding="utf-8"
    )

    missing_static_frontend_result, _, _, _ = _run_package_release_images(
        tmp_path / "missing-static-frontend", missing_static_frontend_manifest_path, bundle="services"
    )
    missing_static_frontend_output = "\n".join(
        part for part in [missing_static_frontend_result.stdout, missing_static_frontend_result.stderr] if part
    )
    assert missing_static_frontend_result.returncode != 0
    assert "missing required image ref: static_frontend" in missing_static_frontend_output

    nondigest_static_frontend_manifest_path = tmp_path / "nondigest-static-frontend-manifest.json"
    nondigest_static_frontend_manifest = _write_release_manifest(nondigest_static_frontend_manifest_path)
    nondigest_static_frontend_manifest["images"]["static_frontend"]["ref"] = (
        "ghcr.io/acme-sec/static-frontend:latest"
    )
    nondigest_static_frontend_manifest_path.write_text(
        json.dumps(nondigest_static_frontend_manifest), encoding="utf-8"
    )

    nondigest_static_frontend_result, _, _, _ = _run_package_release_images(
        tmp_path / "nondigest-static-frontend", nondigest_static_frontend_manifest_path, bundle="services"
    )
    nondigest_static_frontend_output = "\n".join(
        part for part in [nondigest_static_frontend_result.stdout, nondigest_static_frontend_result.stderr] if part
    )
    assert nondigest_static_frontend_result.returncode != 0
    assert "manifest image ref must be digest-pinned: static_frontend" in nondigest_static_frontend_output


def test_package_release_images_script_uses_streaming_checksum_implementation() -> None:
    script_text = (REPO_ROOT / "scripts" / "package-release-images.sh").read_text(encoding="utf-8")

    assert "read_bytes()" not in script_text
    assert "sha256_file(bundle_path)" in script_text
