from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RELEASE_VERSION_SCRIPT = REPO_ROOT / "scripts" / "release_version.py"


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def _init_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-b", "main")
    _git(repo, "config", "user.name", "Test User")
    _git(repo, "config", "user.email", "test@example.com")
    return repo


def _commit(repo: Path, subject: str) -> str:
    _git(repo, "commit", "--allow-empty", "-m", subject)
    return _git(repo, "rev-parse", "HEAD")


def _create_semantic_tag(repo: Path, tag: str, *, source_sha: str, bump_type: str) -> None:
    _git(
        repo,
        "tag",
        "-a",
        tag,
        "-m",
        tag,
        "-m",
        f"source_sha={source_sha}",
        "-m",
        f"bump_type={bump_type}",
        "-m",
        "generated_by=release.yml",
    )


def _run_helper(repo: Path, source_sha: str) -> dict[str, object]:
    result = subprocess.run(
        [
            "python3",
            str(RELEASE_VERSION_SCRIPT),
            "--repo",
            str(repo),
            "--source-sha",
            source_sha,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout or "release_version.py failed")
    return json.loads(result.stdout)


def test_release_version_bootstraps_when_no_semantic_tags_exist(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    source_sha = _commit(repo, "docs: seed release pipeline")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.1"
    assert payload["bump_type"] == "bootstrap"
    assert payload["existing_tag"] is False
    assert payload["previous_version"] is None
    assert payload["previous_source_sha"] is None


def test_release_version_bumps_patch_for_fix_commits(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "fix: close packaging bug")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["previous_version"] == "v0.0.1"
    assert payload["previous_source_sha"] == initial_sha


def test_release_version_treats_plain_subjects_as_patch(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "Update release docs for mirror fallback")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"


def test_release_version_bumps_minor_for_feat_or_refactor_commits(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    _commit(repo, "fix: warm up release assets")
    source_sha = _commit(repo, "refactor: simplify release publish flow")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.1.0"
    assert payload["bump_type"] == "minor"
    assert payload["commit_subjects"] == [
        "refactor: simplify release publish flow",
        "fix: warm up release assets",
    ]


def test_release_version_skips_release_for_non_versioned_commit_types(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "docs: update deployment note")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is False
    assert payload["version"] is None
    assert payload["bump_type"] is None
    assert payload["previous_version"] == "v0.0.1"
    assert payload["previous_source_sha"] == initial_sha


def test_release_version_ignores_release_asset_tags_and_reuses_existing_tag_for_same_source_sha(
    tmp_path: Path,
) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _git(repo, "tag", "release-assets-deadbeef-100-1")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    patch_sha = _commit(repo, "fix: publish snapshot metadata")
    _create_semantic_tag(repo, "v0.0.2", source_sha=patch_sha, bump_type="patch")

    payload = _run_helper(repo, patch_sha)

    assert payload["should_release"] is True
    assert payload["existing_tag"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["previous_source_sha"] == patch_sha
