import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
VERSIONS_DIR = BACKEND_ROOT / "alembic" / "versions"


def _literal_eval_revision_value(source: str, variable_name: str):
    module = ast.parse(source)
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == variable_name:
                    return ast.literal_eval(node.value)
        if isinstance(node, ast.AnnAssign):
            target = node.target
            if isinstance(target, ast.Name) and target.id == variable_name:
                return ast.literal_eval(node.value)
    raise AssertionError(f"Could not find {variable_name} in migration source")


def _load_revision_graph():
    revisions: dict[str, str] = {}
    down_revisions: dict[str, tuple[str, ...]] = {}
    file_names: dict[str, str] = {}

    for path in sorted(VERSIONS_DIR.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        revision = _literal_eval_revision_value(source, "revision")
        raw_down_revision = _literal_eval_revision_value(source, "down_revision")
        if raw_down_revision is None:
            normalized_down_revision = ()
        elif isinstance(raw_down_revision, str):
            normalized_down_revision = (raw_down_revision,)
        else:
            normalized_down_revision = tuple(raw_down_revision)

        revisions[path.name] = revision
        down_revisions[revision] = normalized_down_revision
        file_names[revision] = path.name

    return revisions, down_revisions, file_names


def test_alembic_revisions_form_a_single_head_graph():
    revisions, down_revisions, _ = _load_revision_graph()
    all_revisions = set(down_revisions)
    referenced_revisions = {
        down_revision
        for item in down_revisions.values()
        for down_revision in item
    }
    heads = sorted(all_revisions - referenced_revisions)

    assert len(heads) == 1, f"Expected a single Alembic head, got {heads}"
    assert heads == ["5f6a7b8c9d0e"], heads
    assert len(revisions) == len(down_revisions)


def test_alembic_versions_directory_keeps_expected_base_revisions_and_merge_files():
    _, down_revisions, file_names = _load_revision_graph()
    base_revisions = sorted(
        revision for revision, parents in down_revisions.items() if len(parents) == 0
    )

    assert base_revisions == ["5b0f3c9a6d7e", "c4b1a7e8d9f0"]
    assert file_names["6c8d9e0f1a2b"] == "6c8d9e0f1a2b_finalize_projects_zip_file_hash.py"
    assert file_names["d4e5f6a7b8c9"] == "d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py"
    assert file_names["048836873140"] == "048836873140_merge_yasa_and_phpstan_agent_branches.py"
    assert file_names["5f6a7b8c9d0e"] == "5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py"


def test_bridge_downgrade_keeps_zip_file_hash_baseline_contract():
    bridge_file = (
        BACKEND_ROOT
        / "alembic"
        / "versions"
        / "6c8d9e0f1a2b_finalize_projects_zip_file_hash.py"
    )
    bridge_source = bridge_file.read_text(encoding="utf-8")

    assert "DROP COLUMN IF EXISTS zip_file_hash" not in bridge_source
    assert "DROP INDEX IF EXISTS ix_projects_zip_file_hash" not in bridge_source


def test_static_finding_path_migration_downgrade_keeps_data_normalization_contract():
    migration_file = (
        BACKEND_ROOT
        / "alembic"
        / "versions"
        / "7f8e9d0c1b2a_normalize_static_finding_paths.py"
    )
    migration_source = migration_file.read_text(encoding="utf-8")

    assert "bandit_findings" in migration_source
    assert "opengrep_findings" in migration_source
    assert "downgrade" in migration_source
    assert "UPDATE bandit_findings" not in migration_source.split("def downgrade", 1)[1]
    assert "UPDATE opengrep_findings" not in migration_source.split("def downgrade", 1)[1]
