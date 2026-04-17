from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _cleanup_packages_workflow_text() -> str:
    return (REPO_ROOT / ".github" / "workflows" / "cleanup-packages.yml").read_text(
        encoding="utf-8"
    )


def test_cleanup_packages_workflow_supports_schedule_and_manual_dispatch() -> None:
    workflow_text = _cleanup_packages_workflow_text()

    assert "name: Cleanup Packages" in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "schedule:" in workflow_text
    assert 'cron: "17 3 * * 0"' in workflow_text
    assert "timezone: Asia/Shanghai" in workflow_text
    assert "packages: write" in workflow_text
    assert "contents: read" in workflow_text
    assert "gh api --paginate" in workflow_text
    assert "python scripts/plan_cleanup_packages.py" in workflow_text
    assert "delete_only_untagged_versions:" not in workflow_text
    assert "inputs.package_name == 'all' || inputs.package_name == matrix.package_name" in workflow_text
    assert "secrets.PACKAGES_DELETE_TOKEN || github.token" in workflow_text
    assert "vars.PACKAGE_CLEANUP_OWNER || github.repository_owner" in workflow_text
    assert "vars.PACKAGE_CLEANUP_OWNER_TYPE || github.event.repository.owner.type" in workflow_text
    assert 'DEFAULT_MIN_VERSIONS_TO_KEEP: "3"' in workflow_text


def test_cleanup_packages_workflow_deletes_all_untagged_and_keeps_recent_publish_batches() -> None:
    workflow_text = _cleanup_packages_workflow_text()

    assert "actions/delete-package-versions@v5" not in workflow_text
    assert "Checkout repository" in workflow_text
    assert "Delete container versions by publish-batch policy" in workflow_text
    assert "UNTAGGED_VERSION_IDS" in workflow_text
    assert "TAGGED_VERSION_IDS_TO_DELETE" in workflow_text
    assert "tagged_publish_batches_to_keep" in workflow_text
    assert "publish_batches_total" in workflow_text
    assert "Deleting untagged version" in workflow_text
    assert "Deleting tagged version" in workflow_text


def test_cleanup_packages_workflow_covers_all_runtime_container_packages() -> None:
    workflow_text = _cleanup_packages_workflow_text()

    for package_name in (
        "vulhunter-frontend",
        "vulhunter-backend",
        "vulhunter-yasa-runner",
        "vulhunter-opengrep-runner",
        "vulhunter-bandit-runner",
        "vulhunter-gitleaks-runner",
        "vulhunter-phpstan-runner",
        "vulhunter-flow-parser-runner",
        "vulhunter-pmd-runner",
        "vulhunter-sandbox-runner",
    ):
        assert f"- {package_name}" in workflow_text
