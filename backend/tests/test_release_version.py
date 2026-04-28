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


def _create_lightweight_tag(repo: Path, tag: str) -> None:
    _git(repo, "tag", tag)


def _run_helper(repo: Path, source_sha: str, *extra_args: str) -> dict[str, object]:
    result = subprocess.run(
        [
            "python3",
            str(RELEASE_VERSION_SCRIPT),
            "--repo",
            str(repo),
            "--source-sha",
            source_sha,
            *extra_args,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout or "release_version.py failed")
    return json.loads(result.stdout)


def _run_helper_error(repo: Path, source_sha: str) -> str:
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
    if result.returncode == 0:
        raise AssertionError("release_version.py unexpectedly succeeded")
    return result.stderr or result.stdout or "release_version.py failed"


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


def test_release_version_bumps_patch_for_feat_commits(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "feat: ship managed patch release")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["commit_subjects"] == [
        "feat: ship managed patch release",
    ]


def test_release_version_bumps_patch_for_refactor_commits(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    _commit(repo, "fix: warm up release assets")
    source_sha = _commit(repo, "refactor: simplify release publish flow")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["commit_subjects"] == [
        "refactor: simplify release publish flow",
        "fix: warm up release assets",
    ]


def test_release_version_skips_release_for_non_whitelisted_prefixed_commit_types(
    tmp_path: Path,
) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    for subject in (
        "docs: update deployment note",
        "chore: sync local release instructions",
        "test: extend release helper coverage",
        "ci: adjust workflow comment",
    ):
        source_sha = _commit(repo, subject)

        payload = _run_helper(repo, source_sha)

        assert payload["should_release"] is False
        assert payload["version"] is None
        assert payload["bump_type"] is None
        assert payload["previous_version"] == "v0.0.1"
        assert payload["previous_source_sha"] == initial_sha


def test_release_version_force_patch_bumps_for_ci_commits(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "ci: refresh release assets")

    payload = _run_helper(repo, source_sha, "--force-patch")

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["existing_tag"] is False
    assert payload["previous_version"] == "v0.0.1"
    assert payload["previous_source_sha"] == initial_sha
    assert payload["commit_subjects"] == ["ci: refresh release assets"]


def test_release_version_reuses_existing_managed_tag_without_force_patch(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "ci: refresh release assets")
    _create_semantic_tag(repo, "v0.0.2", source_sha=source_sha, bump_type="patch")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.2"
    assert payload["bump_type"] == "patch"
    assert payload["existing_tag"] is True
    assert payload["previous_source_sha"] == source_sha
    assert payload["commit_subjects"] == []


def test_release_version_force_patch_increments_even_when_source_sha_already_tagged(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    initial_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=initial_sha, bump_type="bootstrap")
    source_sha = _commit(repo, "ci: refresh release assets")
    _create_semantic_tag(repo, "v0.0.2", source_sha=source_sha, bump_type="patch")

    payload = _run_helper(repo, source_sha, "--force-patch")

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.3"
    assert payload["bump_type"] == "patch"
    assert payload["existing_tag"] is False
    assert payload["previous_version"] == "v0.0.2"
    assert payload["previous_source_sha"] == source_sha


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


def test_release_version_uses_latest_managed_v0_0_tag_and_ignores_legacy_semantic_tags(
    tmp_path: Path,
) -> None:
    repo = _init_repo(tmp_path)
    bootstrap_sha = _commit(repo, "feat: initial release")
    _create_semantic_tag(repo, "v0.0.1", source_sha=bootstrap_sha, bump_type="bootstrap")
    patch_one_sha = _commit(repo, "fix: first managed patch")
    _create_semantic_tag(repo, "v0.0.2", source_sha=patch_one_sha, bump_type="patch")
    patch_two_sha = _commit(repo, "fix: second managed patch")
    _create_semantic_tag(repo, "v0.0.3", source_sha=patch_two_sha, bump_type="patch")
    legacy_managed_sha = _commit(repo, "feat: legacy minor stream release")
    _create_semantic_tag(repo, "v0.16.0", source_sha=legacy_managed_sha, bump_type="patch")
    _commit(repo, "fix: legacy public tag missing metadata")
    _create_lightweight_tag(repo, "v2.2.1")
    source_sha = _commit(repo, "refactor: keep managed track on patch releases")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.4"
    assert payload["bump_type"] == "patch"
    assert payload["existing_tag"] is False
    assert payload["previous_version"] == "v0.0.3"
    assert payload["previous_source_sha"] == patch_two_sha


def test_release_version_bootstraps_when_only_legacy_semantic_tags_exist(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    legacy_sha = _commit(repo, "feat: old legacy release")
    _create_semantic_tag(repo, "v0.16.0", source_sha=legacy_sha, bump_type="patch")
    _commit(repo, "fix: lightweight legacy public release")
    _create_lightweight_tag(repo, "v2.2.1")
    source_sha = _commit(repo, "feat: start managed release line")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.1"
    assert payload["bump_type"] == "bootstrap"
    assert payload["existing_tag"] is False
    assert payload["previous_version"] is None
    assert payload["previous_source_sha"] is None


def test_release_version_errors_for_malformed_managed_v0_0_tags(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    source_sha = _commit(repo, "fix: validate managed metadata")
    _create_lightweight_tag(repo, "v0.0.3")

    error_output = _run_helper_error(repo, source_sha)

    assert "annotated release tag v0.0.3 is missing required metadata fields" in error_output


def test_release_version_does_not_reuse_legacy_same_source_tags(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    source_sha = _commit(repo, "feat: legacy tag should not short-circuit managed track")
    _create_semantic_tag(repo, "v0.16.0", source_sha=source_sha, bump_type="patch")

    payload = _run_helper(repo, source_sha)

    assert payload["should_release"] is True
    assert payload["version"] == "v0.0.1"
    assert payload["bump_type"] == "bootstrap"
    assert payload["existing_tag"] is False
