import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RELEASE_WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "release.yml"
MANUAL_BUILD_INPUTS = (
    "build_backend",
    "build_yasa_runner",
    "build_opengrep_runner",
    "build_bandit_runner",
    "build_gitleaks_runner",
    "build_phpstan_runner",
    "build_flow_parser_runner",
    "build_pmd_runner",
    "build_sandbox_runner",
)


def _workflow_text() -> str:
    return RELEASE_WORKFLOW_PATH.read_text(encoding="utf-8")


def test_release_workflow_dispatch_exposes_manual_runtime_image_build_inputs() -> None:
    workflow_text = _workflow_text()

    for input_name in MANUAL_BUILD_INPUTS:
        assert re.search(
            rf"      {input_name}:\n(?:        .*\n)*?        type: boolean\n        default: false\n",
            workflow_text,
        ), input_name


def test_release_workflow_dispatch_exposes_manual_release_asset_publish_input() -> None:
    workflow_text = _workflow_text()

    assert re.search(
        r"      publish_release_assets:\n"
        r"(?:        .*\n)*?"
        r"        type: boolean\n"
        r"        default: false\n",
        workflow_text,
    )


def test_release_workflow_call_contract_stays_unchanged() -> None:
    workflow_text = _workflow_text()
    workflow_call_section = workflow_text.split("  workflow_dispatch:\n", maxsplit=1)[0]

    assert "source_sha:" in workflow_call_section
    assert "release_manifest:" in workflow_call_section

    for input_name in MANUAL_BUILD_INPUTS:
        assert input_name not in workflow_call_section


def test_release_workflow_manual_build_mapping_respects_priority_rules() -> None:
    workflow_text = _workflow_text()

    expected_lines = (
        "build_backend: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.backend == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_backend)) || false }}",
        "build_yasa_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.yasa_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_yasa_runner)) || false }}",
        "build_opengrep_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.opengrep_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_opengrep_runner)) || false }}",
        "build_bandit_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.bandit_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_bandit_runner)) || false }}",
        "build_gitleaks_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.gitleaks_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_gitleaks_runner)) || false }}",
        "build_phpstan_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.phpstan_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_phpstan_runner)) || false }}",
        "build_flow_parser_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.flow_parser_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_flow_parser_runner)) || false }}",
        "build_pmd_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.pmd_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_pmd_runner)) || false }}",
        "build_sandbox_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.sandbox_runner == 'true') || (github.event_name == 'workflow_dispatch' && !inputs.reuse_existing_images && (inputs.refresh_all_runtime_images || inputs.build_sandbox_runner)) || false }}",
    )

    for expected_line in expected_lines:
        assert expected_line in workflow_text


def test_release_workflow_manual_asset_publish_runs_full_finalize_asset_flow() -> None:
    workflow_text = _workflow_text()
    force_release_assets_env = (
        "FORCE_RELEASE_ASSETS: ${{ github.event_name == 'workflow_dispatch' && "
        "(inputs.build_offline_images || inputs.publish_release_assets) || false }}"
    )

    assert (
        "if: ${{ github.event_name != 'workflow_dispatch' || "
        "inputs.build_offline_images || inputs.publish_release_assets }}"
    ) in workflow_text
    assert force_release_assets_env in workflow_text
    assert "--force-patch" in workflow_text


def test_release_workflow_summarizes_manual_runtime_image_build_plan() -> None:
    workflow_text = _workflow_text()

    assert "Manual Runtime Image Build Plan" in workflow_text
    assert "selected_builds" in workflow_text
    assert "frontend_release_image" in workflow_text
    assert "publish_release_assets" in workflow_text
    assert "release flow uses STATIC_FRONTEND_IMAGE" in workflow_text


def test_release_workflow_dispatch_not_blocked_by_push_only_detect_changes_job() -> None:
    workflow_text = _workflow_text()

    assert (
        "if: ${{ always() && (github.event_name == 'push' || github.event_name == "
        "'workflow_dispatch') && (github.event_name != 'push' || "
        "needs.detect-changes.result == 'success') }}"
    ) in workflow_text
