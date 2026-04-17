from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_release_workflow_listens_for_docker_publish_workflow_run() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )

    assert "workflow_run:" in workflow_text
    assert '      - "Docker Publish"' in workflow_text or "      - Docker Publish" in workflow_text
    assert "types:" in workflow_text
    assert "completed" in workflow_text


def test_release_workflow_run_path_downloads_release_manifest_artifact() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )

    assert "WORKFLOW_RUN_ID: ${{ github.event.workflow_run.id }}" in workflow_text
    assert 'gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/artifacts"' in workflow_text
    assert "release-manifest-json" in workflow_text
    assert 'actions/artifacts/${artifact_id}/zip' in workflow_text
    assert "release-manifest.json" in workflow_text


def test_release_workflow_dispatch_path_still_owns_manual_runtime_builds() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )

    assert "workflow_dispatch:" in workflow_text
    assert "workflow_call:" in workflow_text
    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert "if: ${{ github.event_name == 'workflow_dispatch' }}" in workflow_text


def test_docker_publish_uploads_release_manifest_artifact_without_nested_release_call() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "docker-publish.yml").read_text(
        encoding="utf-8"
    )

    assert "actions/upload-artifact@v4" in workflow_text
    assert "release-manifest-json" in workflow_text
    assert "release-manifest.json" in workflow_text
    assert "uses: ./.github/workflows/release.yml" not in workflow_text
