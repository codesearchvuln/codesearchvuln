from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = REPO_ROOT / "scripts" / "release-bundle-contract.json"
GENERATE_RELEASE_BRANCH_PATH = REPO_ROOT / "scripts" / "generate-release-branch.sh"
PACKAGE_RELEASE_IMAGES_PATH = REPO_ROOT / "scripts" / "package-release-images.sh"
WRITE_RELEASE_SNAPSHOT_LOCK_PATH = REPO_ROOT / "scripts" / "write-release-snapshot-lock.py"


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
            "static_frontend": {"ref": "ghcr.io/acme-sec/static-frontend@sha256:" + "e" * 64},
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
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
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
    output_dir: Path,
    manifest_path: Path,
    frontend_bundle_path: Path,
) -> subprocess.CompletedProcess[str]:
    GENERATE_RELEASE_BRANCH_PATH.chmod(GENERATE_RELEASE_BRANCH_PATH.stat().st_mode | stat.S_IXUSR)
    return subprocess.run(
        [
            str(GENERATE_RELEASE_BRANCH_PATH),
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
    tmp_path: Path,
    manifest_path: Path,
    *,
    bundle: str,
    arch: str,
    output_dir: Path,
) -> subprocess.CompletedProcess[str]:
    PACKAGE_RELEASE_IMAGES_PATH.chmod(PACKAGE_RELEASE_IMAGES_PATH.stat().st_mode | stat.S_IXUSR)

    bin_dir = _install_fake_runtime_tools(tmp_path)
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env['PATH']}"
    env["FAKE_DOCKER_LOG"] = str(tmp_path / "docker.log")
    env["FAKE_ZSTD_LOG"] = str(tmp_path / "zstd.log")

    return subprocess.run(
        [
            str(PACKAGE_RELEASE_IMAGES_PATH),
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


def _run_snapshot_lock_writer(
    release_root: Path,
    manifest_path: Path,
    assets_dir: Path,
    *,
    snapshot_tag: str,
) -> subprocess.CompletedProcess[str]:
    WRITE_RELEASE_SNAPSHOT_LOCK_PATH.chmod(WRITE_RELEASE_SNAPSHOT_LOCK_PATH.stat().st_mode | stat.S_IXUSR)
    return subprocess.run(
        [
            str(WRITE_RELEASE_SNAPSHOT_LOCK_PATH),
            "--release-tree",
            str(release_root),
            "--release-manifest",
            str(manifest_path),
            "--asset-dir",
            str(assets_dir),
            "--snapshot-tag",
            snapshot_tag,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )


def _prepare_valid_release_snapshot_inputs(tmp_path: Path) -> tuple[dict[str, object], Path, Path, Path]:
    manifest_path = tmp_path / "release-manifest.json"
    manifest = _write_release_manifest(manifest_path)

    frontend_bundle_path = _write_frontend_bundle(tmp_path / "frontend-release-bundle")
    release_root = tmp_path / "release-tree"
    release_result = _run_release_generator(release_root, manifest_path, frontend_bundle_path)
    release_output = "\n".join(part for part in [release_result.stdout, release_result.stderr] if part)
    assert release_result.returncode == 0, release_output

    assets_dir = tmp_path / "release-assets"
    for bundle in ("services", "scanner"):
        for arch in ("amd64", "arm64"):
            package_result = _run_package_release_images(
                tmp_path / f"package-{bundle}-{arch}",
                manifest_path,
                bundle=bundle,
                arch=arch,
                output_dir=assets_dir,
            )
            package_output = "\n".join(part for part in [package_result.stdout, package_result.stderr] if part)
            assert package_result.returncode == 0, package_output

    return manifest, manifest_path, release_root, assets_dir


def test_release_bundle_contract_schema_is_authoritative() -> None:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    assert contract["schema_version"] == 1
    assert set(contract["bundles"]) == {"services", "scanner"}
    assert contract["bundles"]["services"]["tree_metadata_filename"] == "images-manifest-services.json"
    assert contract["bundles"]["services"]["asset_name_template"] == "vulhunter-services-images-{arch}.tar.zst"
    assert (
        contract["bundles"]["services"]["metadata_asset_name_template"]
        == "images-manifest-services-{arch}.json"
    )
    assert contract["bundles"]["services"]["images"] == [
        "backend",
        "postgres",
        "redis",
        "adminer",
        "scan_workspace_init",
        "static_frontend",
    ]
    assert contract["bundles"]["scanner"]["tree_metadata_filename"] == "images-manifest-scanner.json"
    assert contract["bundles"]["scanner"]["asset_name_template"] == "vulhunter-scanner-images-{arch}.tar.zst"
    assert (
        contract["bundles"]["scanner"]["metadata_asset_name_template"]
        == "images-manifest-scanner-{arch}.json"
    )
    assert contract["bundles"]["scanner"]["images"] == [
        "sandbox_runner",
        "scanner_yasa",
        "scanner_opengrep",
        "scanner_bandit",
        "scanner_gitleaks",
        "scanner_phpstan",
        "scanner_pmd",
        "flow_parser_runner",
    ]
    assert contract["images"]["backend"]["env_var"] == "BACKEND_IMAGE"
    assert contract["images"]["backend"]["local_repo"] == "vulhunter-local/backend"
    assert contract["images"]["scanner_yasa"]["env_var"] == "SCANNER_YASA_IMAGE"
    assert contract["images"]["scanner_yasa"]["local_repo"] == "vulhunter-local/yasa-runner"

    package_script = PACKAGE_RELEASE_IMAGES_PATH.read_text(encoding="utf-8")
    generate_script = GENERATE_RELEASE_BRANCH_PATH.read_text(encoding="utf-8")
    snapshot_lock_script = WRITE_RELEASE_SNAPSHOT_LOCK_PATH.read_text(encoding="utf-8")

    assert "release-bundle-contract.json" in package_script
    assert "release-bundle-contract.json" in generate_script
    assert "release-bundle-contract.json" in snapshot_lock_script


def test_write_release_snapshot_lock_emits_expected_schema_and_checksums(tmp_path: Path) -> None:
    manifest, manifest_path, release_root, assets_dir = _prepare_valid_release_snapshot_inputs(tmp_path)

    result = _run_snapshot_lock_writer(
        release_root,
        manifest_path,
        assets_dir,
        snapshot_tag="release-assets-latest",
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode == 0, combined_output

    lock_path = release_root / "release-snapshot-lock.json"
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    manifest_sha256 = hashlib.sha256(manifest_path.read_bytes()).hexdigest()

    assert lock["schema_version"] == 1
    assert lock["source_sha"] == manifest["revision"]
    assert lock["snapshot_tag"] == "release-assets-latest"
    assert lock["release_manifest_sha256"] == manifest_sha256
    assert set(lock["bundles"]) == {"services", "scanner"}

    services_amd64 = lock["bundles"]["services"]["amd64"]
    assert services_amd64["asset_name"] == "vulhunter-services-images-amd64.tar.zst"
    assert services_amd64["metadata_asset_name"] == "images-manifest-services-amd64.json"
    assert services_amd64["revision"] == manifest["revision"]
    assert services_amd64["bundle_sha256"] == hashlib.sha256(
        (assets_dir / "vulhunter-services-images-amd64.tar.zst").read_bytes()
    ).hexdigest()

    scanner_arm64 = lock["bundles"]["scanner"]["arm64"]
    assert scanner_arm64["asset_name"] == "vulhunter-scanner-images-arm64.tar.zst"
    assert scanner_arm64["metadata_asset_name"] == "images-manifest-scanner-arm64.json"
    assert scanner_arm64["revision"] == manifest["revision"]
    assert scanner_arm64["bundle_sha256"] == hashlib.sha256(
        (assets_dir / "vulhunter-scanner-images-arm64.tar.zst").read_bytes()
    ).hexdigest()


def test_write_release_snapshot_lock_rejects_bundle_membership_mismatch(tmp_path: Path) -> None:
    _manifest, manifest_path, release_root, assets_dir = _prepare_valid_release_snapshot_inputs(tmp_path)

    metadata_path = assets_dir / "images-manifest-services-amd64.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["images"].pop("backend")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    result = _run_snapshot_lock_writer(
        release_root,
        manifest_path,
        assets_dir,
        snapshot_tag="release-assets-latest",
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "bundle membership mismatch" in combined_output
    assert "services/amd64" in combined_output


def test_write_release_snapshot_lock_rejects_noncanonical_asset_names(tmp_path: Path) -> None:
    _manifest, manifest_path, release_root, assets_dir = _prepare_valid_release_snapshot_inputs(tmp_path)

    metadata_path = assets_dir / "images-manifest-services-amd64.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["bundle_file"] = "services-amd64.tar.zst"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    result = _run_snapshot_lock_writer(
        release_root,
        manifest_path,
        assets_dir,
        snapshot_tag="release-assets-latest",
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "non-canonical bundle filename" in combined_output
    assert "services/amd64" in combined_output


def test_write_release_snapshot_lock_rejects_revision_mismatch(tmp_path: Path) -> None:
    _manifest, manifest_path, release_root, assets_dir = _prepare_valid_release_snapshot_inputs(tmp_path)

    tree_metadata_path = release_root / "images-manifest-scanner.json"
    tree_metadata = json.loads(tree_metadata_path.read_text(encoding="utf-8"))
    tree_metadata["revision"] = "ffffffffffffffffffffffffffffffffffffffff"
    tree_metadata_path.write_text(json.dumps(tree_metadata, indent=2) + "\n", encoding="utf-8")

    result = _run_snapshot_lock_writer(
        release_root,
        manifest_path,
        assets_dir,
        snapshot_tag="release-assets-latest",
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "revision mismatch" in combined_output
    assert "scanner" in combined_output


def test_write_release_snapshot_lock_rejects_bundle_checksum_mismatch(tmp_path: Path) -> None:
    _manifest, manifest_path, release_root, assets_dir = _prepare_valid_release_snapshot_inputs(tmp_path)

    bundle_path = assets_dir / "vulhunter-scanner-images-arm64.tar.zst"
    bundle_path.write_bytes(bundle_path.read_bytes() + b"tampered\n")

    result = _run_snapshot_lock_writer(
        release_root,
        manifest_path,
        assets_dir,
        snapshot_tag="release-assets-latest",
    )
    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)

    assert result.returncode != 0
    assert "bundle checksum mismatch" in combined_output
    assert "scanner/arm64" in combined_output
