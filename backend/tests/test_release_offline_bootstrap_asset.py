from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tarfile
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "release-assets" / "offline-bootstrap.sh"


def _write_release_root(root: Path, *, existing_bundle_name: str | None = None) -> Path:
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    (root / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (root / "release-snapshot-lock.json").write_text("{}\n", encoding="utf-8")
    if existing_bundle_name is not None:
        (root / existing_bundle_name).write_text("existing-bundle\n", encoding="utf-8")
    offline_up = root / "scripts" / "offline-up.sh"
    offline_up.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'cwd=%s\\n' "$PWD" >> "${OFFLINE_UP_LOG:?}"
for bundle in "${EXPECTED_SERVICES_BUNDLE:?}" "${EXPECTED_SCANNER_BUNDLE:?}"; do
  [[ -f "$bundle" ]] || { echo "missing bundle: $bundle" >&2; exit 1; }
done
""",
        encoding="utf-8",
    )
    offline_up.chmod(offline_up.stat().st_mode | stat.S_IXUSR)
    return root


def _write_invalid_archive_root(root: Path) -> Path:
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    (root / "scripts" / "offline-up.sh").write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    return root


def _create_archive(workdir: Path, archive_name: str, *, valid_root: bool = True, existing_bundle_name: str | None = None) -> Path:
    source_parent = workdir / "source"
    archive_stem = archive_name[:-4] if archive_name.endswith(".zip") else archive_name[:-7]
    release_root = source_parent / archive_stem
    release_root.mkdir(parents=True, exist_ok=True)
    if valid_root:
        _write_release_root(release_root, existing_bundle_name=existing_bundle_name)
    else:
        _write_invalid_archive_root(release_root)

    archive_path = workdir / archive_name
    if archive_name.endswith(".zip"):
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(release_root.rglob("*")):
                archive.write(path, arcname=path.relative_to(source_parent))
    else:
        with tarfile.open(archive_path, "w:gz") as archive:
            archive.add(release_root, arcname=release_root.name)
    return archive_path


def _write_bundle(workdir: Path, bundle_name: str) -> Path:
    path = workdir / bundle_name
    path.write_text(f"{bundle_name}\n", encoding="utf-8")
    return path


def _run_wrapper(workdir: Path, *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["/bin/bash", str(SCRIPT_PATH)],
        cwd=workdir,
        env=env,
        capture_output=True,
        text=True,
    )


def _base_env(workdir: Path, *, services_bundle: str, scanner_bundle: str) -> dict[str, str]:
    env = os.environ.copy()
    env["OFFLINE_UP_LOG"] = str(workdir / "offline-up.log")
    env["EXPECTED_SERVICES_BUNDLE"] = services_bundle
    env["EXPECTED_SCANNER_BUNDLE"] = scanner_bundle
    return env


def _symlink_command(bin_dir: Path, name: str) -> None:
    target = shutil.which(name)
    assert target is not None, name
    (bin_dir / name).symlink_to(target)


def _write_os_release(path: Path, *, distro_id: str, version_id: str, codename: str) -> None:
    path.write_text(
        f'ID={distro_id}\nVERSION_ID="{version_id}"\nUBUNTU_CODENAME={codename}\nVERSION_CODENAME={codename}\n',
        encoding="utf-8",
    )


def test_offline_bootstrap_supports_zip_release_archive(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.zip")
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    result = _run_wrapper(workdir, env=env)

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode == 0, combined_output
    extracted_root = workdir / "AuditTool-1.2.3"
    assert extracted_root.exists()
    assert (extracted_root / services_bundle).exists()
    assert (extracted_root / scanner_bundle).exists()
    assert not (workdir / services_bundle).exists()
    assert not (workdir / scanner_bundle).exists()
    assert f"cwd={extracted_root}" in (workdir / "offline-up.log").read_text(encoding="utf-8")


def test_offline_bootstrap_supports_tar_gz_release_archive(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    services_bundle = "vulhunter-services-images-arm64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-arm64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    result = _run_wrapper(workdir, env=env)

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode == 0, combined_output
    extracted_root = workdir / "AuditTool-1.2.3"
    assert extracted_root.exists()
    assert (extracted_root / services_bundle).exists()
    assert (extracted_root / scanner_bundle).exists()
    assert f"cwd={extracted_root}" in (workdir / "offline-up.log").read_text(encoding="utf-8")


def test_offline_bootstrap_fails_when_multiple_release_archives_exist(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.zip")
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    _write_bundle(workdir, "vulhunter-services-images-amd64.tar.zst")
    _write_bundle(workdir, "vulhunter-scanner-images-amd64.tar.zst")

    result = _run_wrapper(
        workdir,
        env=_base_env(
            workdir,
            services_bundle="vulhunter-services-images-amd64.tar.zst",
            scanner_bundle="vulhunter-scanner-images-amd64.tar.zst",
        ),
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "expected exactly one release archive" in combined_output


def test_offline_bootstrap_ignores_supplementary_source_and_release_code_assets(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    for archive_name in (
        "release_code.zip",
        "release_code.tar.gz",
        "source_code.zip",
        "source_code.tar.gz",
    ):
        (workdir / archive_name).write_text("supplementary semantic asset\n", encoding="utf-8")

    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    result = _run_wrapper(workdir, env=env)

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode == 0, combined_output
    extracted_root = workdir / "AuditTool-1.2.3"
    assert extracted_root.exists()
    assert (extracted_root / services_bundle).exists()
    assert (extracted_root / scanner_bundle).exists()


def test_offline_bootstrap_fails_when_both_arch_pairs_exist(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    _write_bundle(workdir, "vulhunter-services-images-amd64.tar.zst")
    _write_bundle(workdir, "vulhunter-scanner-images-amd64.tar.zst")
    _write_bundle(workdir, "vulhunter-services-images-arm64.tar.zst")
    _write_bundle(workdir, "vulhunter-scanner-images-arm64.tar.zst")

    result = _run_wrapper(
        workdir,
        env=_base_env(
            workdir,
            services_bundle="vulhunter-services-images-amd64.tar.zst",
            scanner_bundle="vulhunter-scanner-images-amd64.tar.zst",
        ),
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "expected exactly one services bundle" in combined_output or "expected exactly one scanner bundle" in combined_output


def test_offline_bootstrap_fails_when_bundle_arches_do_not_match(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    _write_bundle(workdir, "vulhunter-services-images-amd64.tar.zst")
    _write_bundle(workdir, "vulhunter-scanner-images-arm64.tar.zst")

    result = _run_wrapper(
        workdir,
        env=_base_env(
            workdir,
            services_bundle="vulhunter-services-images-amd64.tar.zst",
            scanner_bundle="vulhunter-scanner-images-arm64.tar.zst",
        ),
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "bundle architectures do not match" in combined_output


def test_offline_bootstrap_fails_when_release_root_cannot_be_resolved(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz", valid_root=False)
    _write_bundle(workdir, "vulhunter-services-images-amd64.tar.zst")
    _write_bundle(workdir, "vulhunter-scanner-images-amd64.tar.zst")

    result = _run_wrapper(
        workdir,
        env=_base_env(
            workdir,
            services_bundle="vulhunter-services-images-amd64.tar.zst",
            scanner_bundle="vulhunter-scanner-images-amd64.tar.zst",
        ),
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "unable to resolve release root" in combined_output


def test_offline_bootstrap_refuses_to_overwrite_existing_bundle_in_release_root(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz", existing_bundle_name=services_bundle)
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    result = _run_wrapper(
        workdir,
        env=_base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle),
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "target bundle already exists" in combined_output


def test_offline_bootstrap_reports_missing_unzip_for_zip_archives(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.zip")
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name in ("bash", "find", "mv", "tar", "mktemp", "rm", "mkdir", "dirname", "cat"):
        _symlink_command(bin_dir, name)

    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    env["PATH"] = str(bin_dir)
    result = _run_wrapper(workdir, env=env)

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "required command not found: unzip" in combined_output


def test_offline_bootstrap_standalone_asset_refuses_auto_install_on_unsupported_host(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    standalone_script = workdir / "Vulhunter-offline-bootstrap.sh"
    standalone_script.write_text(SCRIPT_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    standalone_script.chmod(standalone_script.stat().st_mode | stat.S_IXUSR)

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name in ("bash", "find", "mv", "tar", "mktemp", "rm", "mkdir", "grep", "awk", "id", "cat"):
        _symlink_command(bin_dir, name)

    docker_path = bin_dir / "docker"
    docker_path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "compose" ] && [ "${2:-}" = "version" ]; then
  echo "Docker Compose version fake"
  exit 0
fi
exit 0
""",
        encoding="utf-8",
    )
    docker_path.chmod(docker_path.stat().st_mode | stat.S_IXUSR)

    python3_path = bin_dir / "python3"
    python3_target = shutil.which("python3")
    assert python3_target is not None
    python3_path.symlink_to(python3_target)

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
exit 0
""",
        encoding="utf-8",
    )
    apt_get_path.chmod(apt_get_path.stat().st_mode | stat.S_IXUSR)

    os_release = tmp_path / "os-release"
    _write_os_release(os_release, distro_id="debian", version_id="12", codename="bookworm")
    apt_log = tmp_path / "apt.log"
    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    env["PATH"] = str(bin_dir)
    env["OFFLINE_UP_OS_RELEASE_PATH"] = str(os_release)
    env["FAKE_APT_LOG"] = str(apt_log)

    result = subprocess.run(
        ["/bin/bash", str(standalone_script)],
        cwd=workdir,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode != 0
    assert "unsupported host for automatic prerequisite installation" in combined_output
    assert not (workdir / "offline-up.log").exists()
    assert not apt_log.exists() or apt_log.read_text(encoding="utf-8") == ""


def test_offline_bootstrap_invokes_release_tree_offline_up_from_resolved_root(tmp_path: Path) -> None:
    workdir = tmp_path / "downloads"
    workdir.mkdir()
    _create_archive(workdir, "AuditTool-1.2.3.tar.gz")
    services_bundle = "vulhunter-services-images-amd64.tar.zst"
    scanner_bundle = "vulhunter-scanner-images-amd64.tar.zst"
    _write_bundle(workdir, services_bundle)
    _write_bundle(workdir, scanner_bundle)

    env = _base_env(workdir, services_bundle=services_bundle, scanner_bundle=scanner_bundle)
    result = _run_wrapper(workdir, env=env)

    combined_output = "\n".join(part for part in (result.stdout, result.stderr) if part)
    assert result.returncode == 0, combined_output
    extracted_root = workdir / "AuditTool-1.2.3"
    log_text = (workdir / "offline-up.log").read_text(encoding="utf-8")
    assert f"cwd={extracted_root}" in log_text
