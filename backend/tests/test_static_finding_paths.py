from app.db.static_finding_paths import (
    build_legacy_static_finding_path_candidates,
    normalize_static_scan_file_path,
    resolve_legacy_static_finding_path,
)


def test_normalize_static_scan_file_path_converts_absolute_path_under_project_root():
    assert (
        normalize_static_scan_file_path(
            "/tmp/project-root/src/main.py",
            "/tmp/project-root",
        )
        == "src/main.py"
    )


def test_normalize_static_scan_file_path_cleans_relative_path():
    assert (
        normalize_static_scan_file_path(
            "./src//pkg/../main.py",
            "/tmp/project-root",
        )
        == "src/main.py"
    )


def test_build_legacy_static_finding_path_candidates_strips_temp_prefix_and_archive_root():
    candidates = build_legacy_static_finding_path_candidates(
        "/tmp/deepaudit_proj_123/archive-root/./src/app/main.py",
    )

    assert candidates[:3] == [
        "tmp/deepaudit_proj_123/archive-root/src/app/main.py",
        "archive-root/src/app/main.py",
        "src/app/main.py",
    ]


def test_resolve_legacy_static_finding_path_uses_first_known_zip_match():
    resolved = resolve_legacy_static_finding_path(
        "/tmp/deepaudit_proj_123/archive-root/./src/app/main.py",
        {
            "archive-root/src/app/main.py",
            "src/app/main.py",
        },
    )

    assert resolved == "archive-root/src/app/main.py"


def test_resolve_legacy_static_finding_path_returns_none_when_zip_has_no_match():
    assert (
        resolve_legacy_static_finding_path(
            "/tmp/deepaudit_proj_123/archive-root/./src/app/missing.py",
            {"src/app/main.py"},
        )
        is None
    )
