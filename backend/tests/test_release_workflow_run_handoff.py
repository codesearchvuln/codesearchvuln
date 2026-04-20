from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _release_workflow_text() -> str:
    return (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")


def _docker_publish_workflow_text() -> str:
    return (REPO_ROOT / ".github" / "workflows" / "docker-publish.yml").read_text(
        encoding="utf-8"
    )


def test_release_workflow_push_path_replaces_workflow_run_handoff() -> None:
    workflow_text = _release_workflow_text()

    assert "workflow_call:" in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "\n  push:\n" in workflow_text
    assert "\n    branches:\n      - main\n" in workflow_text
    assert "workflow_run:" not in workflow_text
    assert "WORKFLOW_RUN_ID" not in workflow_text
    assert "github.event.workflow_run" not in workflow_text
    assert "release-manifest-json" not in workflow_text


def test_release_workflow_waits_for_earlier_runs_before_publishing() -> None:
    workflow_text = _release_workflow_text()

    assert "await-turn:" in workflow_text
    assert "Wait for earlier release runs to finish" in workflow_text
    assert 'repos/{repo}/actions/workflows/release.yml/runs?per_page=100' in workflow_text
    assert "current_run_id = int(os.environ[\"CURRENT_RUN_ID\"])" in workflow_text
    assert "queue_status: `ready`" in workflow_text


def test_release_workflow_push_and_dispatch_paths_own_runtime_builds() -> None:
    workflow_text = _release_workflow_text()

    assert "uses: ./.github/workflows/publish-runtime-images.yml" in workflow_text
    assert (
        "if: ${{ always() && (github.event_name == 'push' || github.event_name == "
        "'workflow_dispatch') }}"
    ) in workflow_text
    assert "detect-changes:" in workflow_text
    assert "dorny/paths-filter@v3" in workflow_text
    assert "build_frontend: false" in workflow_text


def test_release_workflow_manifest_resolution_supports_workflow_call_and_built_manifests() -> None:
    workflow_text = _release_workflow_text()

    assert "Load release manifest from resolved entry context" in workflow_text
    assert "Load release manifest from release build outputs" in workflow_text
    assert (
        "if: ${{ always() && needs.resolve-entry.result == 'success' && "
        "needs.prepare-release.result == 'success' && ((github.event_name == "
        "'workflow_call' && (needs.publish-runtime-images.result == 'skipped' || "
        "needs.publish-runtime-images.result == 'success')) || ((github.event_name == "
        "'push' || github.event_name == 'workflow_dispatch') && "
        "needs.publish-runtime-images.result == 'success')) }}"
    ) in workflow_text


def test_docker_publish_remains_manual_only_and_does_not_nest_release_workflow() -> None:
    workflow_text = _docker_publish_workflow_text()

    assert "workflow_dispatch:" in workflow_text
    assert "\n  push:\n" not in workflow_text
    assert "actions/upload-artifact@v4" in workflow_text
    assert "release-manifest-json" in workflow_text
    assert "release-manifest.json" in workflow_text
    assert "uses: ./.github/workflows/release.yml" not in workflow_text
