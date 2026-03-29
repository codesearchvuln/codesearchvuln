from app.api.v1.endpoints.agent_tasks import build_task_write_scope_guard


def test_build_task_write_scope_guard_seeds_target_files(tmp_path):
    guard = build_task_write_scope_guard(
        project_root=str(tmp_path),
        target_files=["src/demo.py", "./src/other.py"],
        bootstrap_findings=None,
    )

    assert guard.writable_files == {"src/demo.py", "src/other.py"}


def test_build_task_write_scope_guard_seeds_bootstrap_findings(tmp_path):
    guard = build_task_write_scope_guard(
        project_root=str(tmp_path),
        target_files=None,
        bootstrap_findings=[
            {"file_path": "src/from_finding.py"},
            {"file_path": "./src/other.py"},
            {"file_path": "../outside.py"},
        ],
    )

    assert guard.writable_files == {"src/from_finding.py", "src/other.py"}
