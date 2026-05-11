import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RELEASE_WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "release.yml"
OFFLOAD_IMAGE_WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "offload-image.yml"
PUBLISH_RUNTIME_IMAGES_WORKFLOW_PATH = (
    REPO_ROOT / ".github" / "workflows" / "publish-runtime-images.yml"
)
MANUAL_BUILD_INPUTS = (
    "build_backend",
    "build_nexus_web",
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


def _offload_image_workflow_text() -> str:
    return OFFLOAD_IMAGE_WORKFLOW_PATH.read_text(encoding="utf-8")


def _publish_runtime_images_workflow_text() -> str:
    return PUBLISH_RUNTIME_IMAGES_WORKFLOW_PATH.read_text(encoding="utf-8")


def test_release_workflow_dispatch_defaults_to_main_source_ref_for_release_default_branch() -> None:
    workflow_text = _workflow_text()

    assert "      source_ref:" in workflow_text
    assert "default: main" in workflow_text
    assert "SOURCE_REF_INPUT: ${{ (github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && inputs.source_ref || github.sha }}" in workflow_text
    assert 'git -C "${RUNNER_TEMP}/source-ref-resolve" fetch --depth=1 origin "${source_ref}"' in workflow_text
    assert 'source_sha="$(git -C "${RUNNER_TEMP}/source-ref-resolve" rev-parse FETCH_HEAD)"' in workflow_text
    assert "checkout_ref: ${{ needs.prepare-release.outputs.source_sha }}" in workflow_text


def test_release_workflow_dispatch_exposes_manual_runtime_image_build_target_input() -> None:
    workflow_text = _workflow_text()

    assert re.search(
        r"      runtime_image_targets:\n"
        r"(?:        .*\n)*?"
        r"        type: string\n"
        r"        default: ''\n",
        workflow_text,
    )
    assert "backend,nexus_web,yasa_runner,opengrep_runner" in workflow_text
    workflow_dispatch_section = workflow_text.split("  workflow_dispatch:\n", maxsplit=1)[1].split(
        "\nenv:", maxsplit=1
    )[0]
    for input_name in MANUAL_BUILD_INPUTS:
        assert f"      {input_name}:" not in workflow_dispatch_section


def test_release_workflow_dispatch_exposes_manual_release_asset_publish_input() -> None:
    workflow_text = _workflow_text()

    assert re.search(
        r"      publish_release_assets:\n"
        r"(?:        .*\n)*?"
        r"        type: boolean\n"
        r"        default: false\n",
        workflow_text,
    )


def test_release_workflow_dispatch_exposes_manual_offline_image_build_input() -> None:
    workflow_text = _workflow_text()

    assert re.search(
        r"      build_offline_images:\n"
        r"(?:        .*\n)*?"
        r"        type: boolean\n"
        r"        default: false\n",
        workflow_text,
    )


def test_release_workflow_call_contract_accepts_manual_build_inputs_for_offload_entry() -> None:
    workflow_text = _workflow_text()
    workflow_call_section = workflow_text.split("  workflow_dispatch:\n", maxsplit=1)[0]

    assert "source_ref:" in workflow_call_section
    assert "default: main" in workflow_call_section
    assert "source_sha:" in workflow_call_section
    assert "release_manifest:" in workflow_call_section
    assert "build_offline_images:" in workflow_call_section

    for input_name in MANUAL_BUILD_INPUTS:
        assert input_name in workflow_call_section


def test_release_workflow_manual_build_mapping_respects_priority_rules() -> None:
    workflow_text = _workflow_text()

    expected_lines = (
        "build_backend: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.backend == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_backend == 'true') || false }}",
        "build_nexus_web: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.nexus_web == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_nexus_web == 'true') || false }}",
        "build_yasa_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.yasa_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_yasa_runner == 'true') || false }}",
        "build_opengrep_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.opengrep_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_opengrep_runner == 'true') || false }}",
        "build_bandit_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.bandit_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_bandit_runner == 'true') || false }}",
        "build_gitleaks_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.gitleaks_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_gitleaks_runner == 'true') || false }}",
        "build_phpstan_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.phpstan_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_phpstan_runner == 'true') || false }}",
        "build_flow_parser_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.flow_parser_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_flow_parser_runner == 'true') || false }}",
        "build_pmd_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.pmd_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_pmd_runner == 'true') || false }}",
        "build_sandbox_runner: ${{ (github.event_name == 'push' && needs.detect-changes.outputs.sandbox_runner == 'true') || ((github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && needs.prepare-release.outputs.build_sandbox_runner == 'true') || false }}",
    )

    for expected_line in expected_lines:
        assert expected_line in workflow_text


def test_release_workflow_manual_asset_publish_runs_full_finalize_asset_flow() -> None:
    workflow_text = _workflow_text()
    package_offline_images_if = (
        "if: ${{ always() && !cancelled() && needs.prepare-release.result == 'success' && "
        "needs.create-draft-release.result == 'success' && "
        "needs.resolve-release-manifest.result == 'success' && "
        "((github.event_name != 'workflow_dispatch' && github.event_name != 'workflow_call') || inputs.build_offline_images || "
        "inputs.publish_release_assets) }}"
    )
    finalize_publish_if = (
        "if: ${{ always() && !cancelled() && needs.prepare-release.result == 'success' && "
        "needs.create-draft-release.result == 'success' && "
        "needs.resolve-release-manifest.result == 'success' && "
        "(needs.package-offline-images.result == 'success' || "
        "needs.package-offline-images.result == 'skipped') }}"
    )
    force_release_assets_env = (
        "FORCE_RELEASE_ASSETS: ${{ (github.event_name == 'workflow_dispatch' || github.event_name == 'workflow_call') && "
        "(inputs.build_offline_images || inputs.publish_release_assets) || false }}"
    )

    assert package_offline_images_if in workflow_text
    assert finalize_publish_if in workflow_text
    assert force_release_assets_env in workflow_text
    assert "--force-patch" in workflow_text


def test_release_workflow_dispatch_release_chain_survives_push_only_skips() -> None:
    workflow_text = _workflow_text()

    assert "commit-gate:\n    if: ${{ github.event_name == 'push' }}" in workflow_text
    assert (
        "resolve-entry:\n"
        "    needs: await-turn\n"
        "    if: ${{ always() && !cancelled() && "
        "needs.await-turn.result == 'success' }}"
    ) in workflow_text
    assert (
        "prepare-release:\n"
        "    needs: resolve-entry\n"
        "    if: ${{ always() && !cancelled() && "
        "needs.resolve-entry.result == 'success' }}"
    ) in workflow_text
    assert (
        "if: ${{ always() && !cancelled() && "
        "needs.prepare-release.result == 'success' && "
        "(github.event_name == 'push' || github.event_name == 'workflow_dispatch' || (github.event_name == 'workflow_call' && inputs.release_manifest == '')) && "
        "(github.event_name != 'push' || needs.detect-changes.result == 'success') }}"
    ) in workflow_text


def test_release_workflow_summarizes_manual_runtime_image_build_plan() -> None:
    workflow_text = _workflow_text()

    assert "Manual Runtime Image Build Plan" in workflow_text
    assert "refresh_all_runtime_images" in workflow_text
    assert "runtime_image_targets" in workflow_text
    assert "select_csv_targets" in workflow_text
    assert "selected_builds" in workflow_text
    assert "frontend_release_image" in workflow_text
    assert "publish_release_assets" in workflow_text
    assert "release flow uses STATIC_FRONTEND_IMAGE" in workflow_text


def test_release_workflow_dispatch_not_blocked_by_push_only_detect_changes_job() -> None:
    workflow_text = _workflow_text()

    assert (
        "if: ${{ always() && !cancelled() && needs.prepare-release.result == "
        "'success' && (github.event_name == 'push' || github.event_name == "
        "'workflow_dispatch' || (github.event_name == 'workflow_call' && "
        "inputs.release_manifest == '')) && (github.event_name != 'push' || "
        "needs.detect-changes.result == 'success') }}"
    ) in workflow_text


def test_offload_image_workflow_is_explicit_manual_dispatch_entry() -> None:
    workflow_text = _offload_image_workflow_text()

    assert "name: Offload Image Build" in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "source_ref:" in workflow_text
    assert "default: main" in workflow_text
    assert "uses: ./.github/workflows/release.yml" in workflow_text
    assert "source_ref: ${{ inputs.source_ref }}" in workflow_text
    assert "build_offline_images: true" in workflow_text
    assert "publish_release_assets: ${{ inputs.publish_release_assets }}" in workflow_text


def test_runtime_image_reusable_workflow_checks_out_requested_source_ref() -> None:
    workflow_text = _publish_runtime_images_workflow_text()

    assert "checkout_ref:" in workflow_text
    assert "ref: ${{ inputs.checkout_ref || github.sha }}" in workflow_text
