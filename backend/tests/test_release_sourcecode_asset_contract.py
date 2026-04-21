from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_release_workflow_generates_local_sourcecode_archives_for_semantic_release() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )

    assert "generate-sourcecode-branch.sh" in workflow_text
    assert "${RUNNER_TEMP}/sourcecode-tree" in workflow_text
    assert "--validate" in workflow_text
    assert "semantic-release-archives" in workflow_text
    assert "source_code.zip" in workflow_text
    assert "source_code.tar.gz" in workflow_text
    assert "release_code.zip" in workflow_text
    assert "release_code.tar.gz" in workflow_text
    assert 'gh release upload "${SEMANTIC_TAG}"' in workflow_text


def test_release_workflow_does_not_package_source_archives_from_origin_sourcecode_tip() -> None:
    release_workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )
    publish_sourcecode_text = (
        REPO_ROOT / ".github" / "workflows" / "publish-sourcecode.yml"
    ).read_text(encoding="utf-8")

    assert "git fetch --force origin sourcecode:refs/remotes/origin/sourcecode" in publish_sourcecode_text
    assert "git rev-parse refs/remotes/origin/sourcecode^{tree}" in publish_sourcecode_text
    assert "origin/sourcecode" not in release_workflow_text
    assert "refs/remotes/origin/sourcecode" not in release_workflow_text
