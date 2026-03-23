# Alembic Linear History Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current compatibility-oriented Alembic graph with a single-base, single-head linear history and align tests, startup checks, and entrypoint scripts with `alembic upgrade head`.

**Architecture:** Keep the existing squashed baseline and the real business migrations, but delete compatibility bridges and merge-only revisions. Rewire the retained migrations into one explicit parent chain, then update test fixtures and runtime entrypoints so the rest of the backend treats a single head as the only valid state.

**Tech Stack:** Python 3, Alembic, SQLAlchemy, pytest, bash entrypoint scripts

---

## File Map

**Modify**
- `backend/alembic/versions/6c8d9e0f1a2b_finalize_projects_zip_file_hash.py`
- `backend/alembic/versions/7f8e9d0c1b2a_normalize_static_finding_paths.py`
- `backend/alembic/versions/8c1d2e3f4a5b_add_agent_finding_identity.py`
- `backend/alembic/versions/9a7b6c5d4e3f_enforce_agent_finding_task_uniqueness.py`
- `backend/alembic/versions/9d3e4f5a6b7c_add_bandit_rule_states.py`
- `backend/alembic/versions/a1b2c3d4e5f6_add_phpstan_rule_states.py`
- `backend/alembic/versions/b2c3d4e5f6a7_add_bandit_rule_soft_delete.py`
- `backend/alembic/versions/c3d4e5f6a7b8_add_phpstan_rule_soft_delete.py`
- `backend/alembic/versions/e5f6a7b8c9d0_add_project_management_metrics.py`
- `backend/alembic/versions/b7e8f9a0b1c2_add_yasa_scan_tables.py`
- `backend/alembic/versions/a8f1c2d3e4b5_add_agent_tasks_report_column.py`
- `backend/alembic/versions/b9d8e7f6a5b4_drop_legacy_audit_tables.py`
- `backend/alembic/versions/f6a7b8c9d0e1_remove_fixed_static_finding_status.py`
- `backend/tests/test_alembic_project.py`
- `backend/app/main.py`
- `backend/tests/test_startup_schema_migration.py`
- `backend/docker-entrypoint.sh`
- `backend/scripts/dev-entrypoint.sh`

**Delete**
- `backend/alembic/versions/c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py`
- `backend/alembic/versions/d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py`
- `backend/alembic/versions/5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py`
- `backend/alembic/versions/90a71996ac03_add_project_management_metrics_table.py`

**Do not modify in this plan**
- `backend/app/db/schema_snapshots/baseline_5b0f3c9a6d7e.py`
- `docs/alembic_refact/alembic_refact.md`

## Implementation Notes

- Keep the existing real migration revision IDs unless a specific filename or docstring still communicates bridge-only semantics. The plan should minimize churn while still producing a strictly linear graph.
- The retained linear order should be:
  - `5b0f3c9a6d7e`
  - `6c8d9e0f1a2b`
  - `7f8e9d0c1b2a`
  - `8c1d2e3f4a5b`
  - `9a7b6c5d4e3f`
  - `9d3e4f5a6b7c`
  - `a1b2c3d4e5f6`
  - `b2c3d4e5f6a7`
  - `c3d4e5f6a7b8`
  - `e5f6a7b8c9d0`
  - `b7e8f9a0b1c2`
  - `a8f1c2d3e4b5`
  - `b9d8e7f6a5b4`
  - `f6a7b8c9d0e1`
- The retained migrations should continue to preserve their current upgrade/downgrade behavior unless a bridge-oriented docstring or `down_revision` value needs to change.
- Runtime behavior must stop teaching operators that `heads` is normal. The backend should still read Alembic heads via `ScriptDirectory`, but it should fail fast if the graph unexpectedly exposes more than one head.

---

### Task 1: Lock the target migration graph with failing tests

**Files:**
- Modify: `backend/tests/test_alembic_project.py`

- [ ] **Step 1: Replace compatibility-era graph assertions with the target linear graph**

Update `backend/tests/test_alembic_project.py` so it defines the retained linear chain and obsolete filenames up front:

```python
EXPECTED_LINEAR_REVISIONS = [
    "5b0f3c9a6d7e",
    "6c8d9e0f1a2b",
    "7f8e9d0c1b2a",
    "8c1d2e3f4a5b",
    "9a7b6c5d4e3f",
    "9d3e4f5a6b7c",
    "a1b2c3d4e5f6",
    "b2c3d4e5f6a7",
    "c3d4e5f6a7b8",
    "e5f6a7b8c9d0",
    "b7e8f9a0b1c2",
    "a8f1c2d3e4b5",
    "b9d8e7f6a5b4",
    "f6a7b8c9d0e1",
]

OBSOLETE_MIGRATION_FILES = {
    "c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py",
    "d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py",
    "5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py",
    "90a71996ac03_add_project_management_metrics_table.py",
}
```

- [ ] **Step 2: Add/replace tests for single-base, single-head, single-parent history**

Rewrite the compatibility-focused tests so the file now asserts:

```python
def test_alembic_versions_directory_is_linear():
    revisions, down_revisions, file_names = _load_revision_graph()

    base_revisions = sorted(
        revision for revision, parents in down_revisions.items() if not parents
    )
    assert base_revisions == ["5b0f3c9a6d7e"]

    for revision, parents in down_revisions.items():
        assert len(parents) <= 1, (revision, parents)

    actual_order = []
    current_revision = "f6a7b8c9d0e1"
    while current_revision:
        actual_order.append(current_revision)
        parents = down_revisions[current_revision]
        current_revision = parents[0] if parents else None

    assert list(reversed(actual_order)) == EXPECTED_LINEAR_REVISIONS
    assert set(file_names.values()).isdisjoint(OBSOLETE_MIGRATION_FILES)
    assert len(revisions) == len(EXPECTED_LINEAR_REVISIONS)
```

- [ ] **Step 3: Add a focused filename/content test for removed compatibility files**

Replace the old bridge-specific tests with one assertion that obsolete files are gone and one assertion that the retained zip-file-hash migration still does not drop the new column/index in `downgrade()`.

```python
def test_obsolete_merge_and_bridge_files_are_removed():
    file_names = {path.name for path in VERSIONS_DIR.glob("*.py")}
    assert file_names.isdisjoint(OBSOLETE_MIGRATION_FILES)
```

- [ ] **Step 4: Run the graph test file and confirm it fails before migration rewrites**

Run:

```bash
cd /home/xyf/AuditTool/backend
.venv/bin/pytest tests/test_alembic_project.py -q
```

Expected:
- FAIL because the old bridge and merge files still exist and the graph still has two bases / tuple parents

---

### Task 2: Rewire retained Alembic revisions into one linear chain

**Files:**
- Modify: `backend/alembic/versions/6c8d9e0f1a2b_finalize_projects_zip_file_hash.py`
- Modify: `backend/alembic/versions/7f8e9d0c1b2a_normalize_static_finding_paths.py`
- Modify: `backend/alembic/versions/8c1d2e3f4a5b_add_agent_finding_identity.py`
- Modify: `backend/alembic/versions/9a7b6c5d4e3f_enforce_agent_finding_task_uniqueness.py`
- Modify: `backend/alembic/versions/9d3e4f5a6b7c_add_bandit_rule_states.py`
- Modify: `backend/alembic/versions/a1b2c3d4e5f6_add_phpstan_rule_states.py`
- Modify: `backend/alembic/versions/b2c3d4e5f6a7_add_bandit_rule_soft_delete.py`
- Modify: `backend/alembic/versions/c3d4e5f6a7b8_add_phpstan_rule_soft_delete.py`
- Modify: `backend/alembic/versions/e5f6a7b8c9d0_add_project_management_metrics.py`
- Modify: `backend/alembic/versions/b7e8f9a0b1c2_add_yasa_scan_tables.py`
- Modify: `backend/alembic/versions/a8f1c2d3e4b5_add_agent_tasks_report_column.py`
- Modify: `backend/alembic/versions/b9d8e7f6a5b4_drop_legacy_audit_tables.py`
- Modify: `backend/alembic/versions/f6a7b8c9d0e1_remove_fixed_static_finding_status.py`
- Delete: `backend/alembic/versions/c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py`
- Delete: `backend/alembic/versions/d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py`
- Delete: `backend/alembic/versions/5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py`
- Delete: `backend/alembic/versions/90a71996ac03_add_project_management_metrics_table.py`
- Test: `backend/tests/test_alembic_project.py`

- [ ] **Step 1: Change the parent links to the planned single chain**

Update the retained migration files so `down_revision` values form the exact order from the spec:

```python
# backend/alembic/versions/6c8d9e0f1a2b_finalize_projects_zip_file_hash.py
down_revision = "5b0f3c9a6d7e"

# backend/alembic/versions/9d3e4f5a6b7c_add_bandit_rule_states.py
down_revision = "9a7b6c5d4e3f"

# backend/alembic/versions/e5f6a7b8c9d0_add_project_management_metrics.py
down_revision = "c3d4e5f6a7b8"

# backend/alembic/versions/b7e8f9a0b1c2_add_yasa_scan_tables.py
down_revision = "e5f6a7b8c9d0"

# backend/alembic/versions/a8f1c2d3e4b5_add_agent_tasks_report_column.py
down_revision = "b7e8f9a0b1c2"
```

Leave already-correct single-parent links untouched except for refreshing their `Revises:` docstrings if needed.

- [ ] **Step 2: Delete the obsolete bridge and merge files**

Remove these files entirely:

```text
backend/alembic/versions/c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py
backend/alembic/versions/d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py
backend/alembic/versions/5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py
backend/alembic/versions/90a71996ac03_add_project_management_metrics_table.py
```

- [ ] **Step 3: Clean up bridge-oriented comments and docstrings in retained files**

Update retained migrations so their docstrings describe the actual business change, not compatibility history. At minimum, fix:

```python
"""add projects zip_file_hash column and unique index"""
```

and ensure no retained migration docstring contains `bridge`, `merge`, or `compatibility`.

- [ ] **Step 4: Re-run the graph tests**

Run:

```bash
cd /home/xyf/AuditTool/backend
.venv/bin/pytest tests/test_alembic_project.py -q
```

Expected:
- PASS

- [ ] **Step 5: Commit the linearized migration graph**

Run:

```bash
git add /home/xyf/AuditTool/backend/alembic/versions /home/xyf/AuditTool/backend/tests/test_alembic_project.py
git commit -m "refactor: linearize alembic migration history"
```

---

### Task 3: Lock single-head startup behavior with failing tests

**Files:**
- Modify: `backend/tests/test_startup_schema_migration.py`

- [ ] **Step 1: Stop using compatibility-specific revision IDs in the startup tests**

Replace the hard-coded fake revisions with generic linear-history fixtures:

```python
CURRENT_REVISION = "prev_linear_revision"
LATEST_REVISION = "linear_head_revision"
```

Use them in both tests instead of `90a71996ac03` and `a8f1c2d3e4b5`.

- [ ] **Step 2: Make the tests assert `head` language, not `heads` language**

Update the failure assertion to expect the new single-head wording:

```python
with pytest.raises(
    RuntimeError,
    match="current=\\['prev_linear_revision'\\] expected=\\['linear_head_revision'\\]",
):
    await assert_database_schema_is_latest()
```

- [ ] **Step 3: Add a test that rejects multiple Alembic heads as an invalid graph**

Add a new async test that patches `ScriptDirectory.from_config` to return two heads and expects a fast failure like:

```python
with pytest.raises(RuntimeError, match="Alembic migration graph is not linear"):
    await assert_database_schema_is_latest()
```

- [ ] **Step 4: Run the startup test file and confirm it fails before runtime changes**

Run:

```bash
cd /home/xyf/AuditTool/backend
.venv/bin/pytest tests/test_startup_schema_migration.py -q
```

Expected:
- FAIL because `app.main` still executes `alembic upgrade heads` and still emits `heads`-based messages

---

### Task 4: Update runtime migration entrypoints to single-head semantics

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/docker-entrypoint.sh`
- Modify: `backend/scripts/dev-entrypoint.sh`
- Test: `backend/tests/test_startup_schema_migration.py`

- [ ] **Step 1: Add a helper that enforces exactly one Alembic head**

In `backend/app/main.py`, add a small helper near `assert_database_schema_is_latest()`:

```python
def _get_expected_database_heads(script: ScriptDirectory) -> set[str]:
    heads = [str(item).strip() for item in script.get_heads() if str(item).strip()]
    if len(heads) > 1:
        raise RuntimeError(
            f"Alembic migration graph is not linear: heads={sorted(heads)}"
        )
    return set(heads)
```

Then replace the direct `script.get_heads()` set construction with this helper.

- [ ] **Step 2: Change startup upgrade commands and error text from `heads` to `head`**

In `backend/app/main.py`, change the runtime migration command and messages:

```python
subprocess.run(["alembic", "upgrade", "head"], cwd=str(backend_root), check=True)
```

and update the related strings to:

```python
"自动执行 alembic upgrade head 失败"
"数据库缺少迁移版本元数据（alembic_version），请先运行 alembic upgrade head"
"数据库未记录迁移版本，请先运行 alembic upgrade head"
```

Also change the mismatch log / exception to use `expected=%s` and `expected=...` instead of `heads=%s` and `heads=...`.

- [ ] **Step 3: Update shell entrypoints to run `alembic upgrade head`**

Change both scripts:

```bash
.venv/bin/alembic upgrade head
```

and

```bash
"${VENV_DIR}/bin/alembic" upgrade head
```

- [ ] **Step 4: Re-run the startup test file**

Run:

```bash
cd /home/xyf/AuditTool/backend
.venv/bin/pytest tests/test_startup_schema_migration.py -q
```

Expected:
- PASS

- [ ] **Step 5: Commit the single-head runtime changes**

Run:

```bash
git add /home/xyf/AuditTool/backend/app/main.py /home/xyf/AuditTool/backend/tests/test_startup_schema_migration.py /home/xyf/AuditTool/backend/docker-entrypoint.sh /home/xyf/AuditTool/backend/scripts/dev-entrypoint.sh
git commit -m "refactor: enforce single-head alembic startup flow"
```

---

### Task 5: Run the full verification sweep and clean remaining compatibility references

**Files:**
- Modify if needed: `backend/app/main.py`
- Modify if needed: `backend/docker-entrypoint.sh`
- Modify if needed: `backend/scripts/dev-entrypoint.sh`
- Modify if needed: `backend/tests/test_alembic_project.py`
- Modify if needed: `backend/tests/test_startup_schema_migration.py`

- [ ] **Step 1: Search for obsolete revision IDs and `upgrade heads` references**

Run:

```bash
cd /home/xyf/AuditTool
rg -n "c4b1a7e8d9f0|d4e5f6a7b8c9|5f6a7b8c9d0e|90a71996ac03|upgrade heads|heads=" backend docs
```

Expected:
- No matches in maintained code paths
- Any remaining matches should be intentional historical references only, not runtime behavior or test expectations

- [ ] **Step 2: Run both focused pytest files together**

Run:

```bash
cd /home/xyf/AuditTool/backend
.venv/bin/pytest tests/test_alembic_project.py tests/test_startup_schema_migration.py -q
```

Expected:
- PASS

- [ ] **Step 3: Run a clean empty-database migration to the new single head**

With the backend environment loaded and `DATABASE_URL` pointing at a disposable empty database, run:

```bash
cd /home/xyf/AuditTool/backend
DATABASE_URL="${DATABASE_URL:?set DATABASE_URL to an empty disposable database}" .venv/bin/alembic upgrade head
DATABASE_URL="${DATABASE_URL:?set DATABASE_URL to an empty disposable database}" .venv/bin/alembic current
```

Expected:
- `upgrade head` completes without merge-resolution errors
- `current` prints exactly one revision, which should be `f6a7b8c9d0e1`

- [ ] **Step 4: Sanity-check the final schema objects the spec calls out**

Using the same disposable database, verify:
- `projects.zip_file_hash` exists with its unique index
- `agent_findings.finding_identity` and both task-level unique indexes exist
- `bandit_rule_states` and `phpstan_rule_states` each include `is_deleted`
- `project_management_metrics` exists without `audit_tasks`
- `yasa_scan_tasks` and `yasa_findings` exist
- `agent_tasks.report` exists
- `audit_tasks` and `audit_issues` are absent

- [ ] **Step 5: Commit any final cleanup**

Run:

```bash
git add /home/xyf/AuditTool/backend
git commit -m "test: finish alembic linear-history verification"
```

