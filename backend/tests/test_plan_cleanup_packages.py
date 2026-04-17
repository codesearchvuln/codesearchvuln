import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "plan_cleanup_packages.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("plan_cleanup_packages", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_build_cleanup_plan_keeps_latest_three_publish_batches() -> None:
    module = _load_module()

    versions = [
        {
            "id": 10,
            "updated_at": "2026-04-10T00:00:00Z",
            "metadata": {"container": {"tags": []}},
        },
        {
            "id": 20,
            "updated_at": "2026-04-17T00:00:00Z",
            "metadata": {"container": {"tags": ["latest"]}},
        },
        {
            "id": 21,
            "updated_at": "2026-04-17T00:00:00Z",
            "metadata": {"container": {"tags": ["buildcache-runtime-plain-amd64"]}},
        },
        {
            "id": 22,
            "updated_at": "2026-04-17T00:00:00Z",
            "metadata": {"container": {"tags": ["buildcache-runtime-plain-arm64"]}},
        },
        {
            "id": 101,
            "updated_at": "2026-04-17T10:00:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-amd64"]}},
        },
        {
            "id": 102,
            "updated_at": "2026-04-17T10:01:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-arm64"]}},
        },
        {
            "id": 103,
            "updated_at": "2026-04-17T10:02:00Z",
            "metadata": {"container": {"tags": ["latest"]}},
        },
        {
            "id": 203,
            "updated_at": "2026-04-16T10:02:00Z",
            "metadata": {"container": {"tags": ["release-2026.04.16"]}},
        },
        {
            "id": 204,
            "updated_at": "2026-04-16T10:03:00Z",
            "metadata": {"container": {"tags": ["release-2026.04.16-103-1-amd64"]}},
        },
        {
            "id": 205,
            "updated_at": "2026-04-16T10:04:00Z",
            "metadata": {"container": {"tags": ["release-2026.04.16-103-1-arm64"]}},
        },
        {
            "id": 303,
            "updated_at": "2026-04-15T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.2"]}},
        },
        {
            "id": 304,
            "updated_at": "2026-04-15T10:03:00Z",
            "metadata": {"container": {"tags": ["v1.2.2-102-1-amd64"]}},
        },
        {
            "id": 305,
            "updated_at": "2026-04-15T10:04:00Z",
            "metadata": {"container": {"tags": ["v1.2.2-102-1-arm64"]}},
        },
        {
            "id": 403,
            "updated_at": "2026-04-14T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.1"]}},
        },
        {
            "id": 404,
            "updated_at": "2026-04-14T10:03:00Z",
            "metadata": {"container": {"tags": ["v1.2.1-101-1-amd64"]}},
        },
        {
            "id": 405,
            "updated_at": "2026-04-14T10:04:00Z",
            "metadata": {"container": {"tags": ["v1.2.1-101-1-arm64"]}},
        },
    ]

    plan = module.build_cleanup_plan(versions, keep_publish_batches=3)

    assert plan["untagged_version_ids"] == [10]
    assert plan["tagged_version_ids_to_delete"] == [403, 404, 405]
    assert plan["publish_batches_total"] == 4
    assert plan["publish_batches_retained"] == 3
    assert plan["publish_batches_deleted"] == 1
    assert plan["retained_publish_batches"] == [
        "latest|104|1",
        "release-2026.04.16|103|1",
        "v1.2.2|102|1",
    ]
    assert plan["deleted_publish_batches"] == ["v1.2.1|101|1"]
    assert set(plan["retained_tags"]) == {
        "latest",
        "buildcache-runtime-plain-amd64",
        "buildcache-runtime-plain-arm64",
        "latest-104-1-amd64",
        "latest-104-1-arm64",
        "release-2026.04.16",
        "release-2026.04.16-103-1-amd64",
        "release-2026.04.16-103-1-arm64",
        "v1.2.2",
        "v1.2.2-102-1-amd64",
        "v1.2.2-102-1-arm64",
    }


def test_build_cleanup_plan_can_delete_all_publish_batches() -> None:
    module = _load_module()

    versions = [
        {
            "id": 1,
            "updated_at": "2026-04-17T10:00:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-amd64"]}},
        },
        {
            "id": 2,
            "updated_at": "2026-04-17T10:01:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-arm64"]}},
        },
    ]

    plan = module.build_cleanup_plan(versions, keep_publish_batches=0)

    assert plan["untagged_version_ids"] == []
    assert plan["tagged_version_ids_to_delete"] == [1, 2]
    assert plan["publish_batches_retained"] == 0
    assert plan["publish_batches_deleted"] == 1


def test_build_cleanup_plan_attaches_standalone_manifest_tags_to_publish_batches() -> None:
    module = _load_module()

    versions = [
        {
            "id": 1,
            "updated_at": "2026-04-17T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.2.4-104-1-amd64"]}},
        },
        {
            "id": 2,
            "updated_at": "2026-04-17T10:01:00Z",
            "metadata": {"container": {"tags": ["v1.2.4-104-1-arm64"]}},
        },
        {
            "id": 3,
            "updated_at": "2026-04-17T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.4"]}},
        },
        {
            "id": 4,
            "updated_at": "2026-04-16T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.2.3-103-1-amd64"]}},
        },
        {
            "id": 5,
            "updated_at": "2026-04-16T10:01:00Z",
            "metadata": {"container": {"tags": ["v1.2.3-103-1-arm64"]}},
        },
        {
            "id": 6,
            "updated_at": "2026-04-16T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.3"]}},
        },
        {
            "id": 7,
            "updated_at": "2026-04-15T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.2.2-102-1-amd64"]}},
        },
        {
            "id": 8,
            "updated_at": "2026-04-15T10:01:00Z",
            "metadata": {"container": {"tags": ["v1.2.2-102-1-arm64"]}},
        },
        {
            "id": 9,
            "updated_at": "2026-04-15T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.2"]}},
        },
        {
            "id": 10,
            "updated_at": "2026-04-14T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.2.1-101-1-amd64"]}},
        },
        {
            "id": 11,
            "updated_at": "2026-04-14T10:01:00Z",
            "metadata": {"container": {"tags": ["v1.2.1-101-1-arm64"]}},
        },
        {
            "id": 12,
            "updated_at": "2026-04-14T10:02:00Z",
            "metadata": {"container": {"tags": ["v1.2.1"]}},
        },
    ]

    plan = module.build_cleanup_plan(versions, keep_publish_batches=3)

    assert plan["publish_batches_total"] == 4
    assert plan["publish_batches_retained"] == 3
    assert plan["tagged_version_ids_to_delete"] == [10, 11, 12]


def test_build_cleanup_plan_groups_mixed_manifest_and_arch_tags() -> None:
    module = _load_module()

    versions = [
        {
            "id": 1,
            "updated_at": "2026-04-17T10:00:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-amd64", "latest"]}},
        },
        {
            "id": 2,
            "updated_at": "2026-04-17T10:01:00Z",
            "metadata": {"container": {"tags": ["latest-104-1-arm64"]}},
        },
        {
            "id": 3,
            "updated_at": "2026-04-16T10:00:00Z",
            "metadata": {"container": {"tags": ["latest-103-1-amd64"]}},
        },
        {
            "id": 4,
            "updated_at": "2026-04-16T10:01:00Z",
            "metadata": {"container": {"tags": ["latest-103-1-arm64"]}},
        },
    ]

    plan = module.build_cleanup_plan(versions, keep_publish_batches=1)

    assert plan["publish_batches_total"] == 2
    assert plan["publish_batches_retained"] == 1
    assert plan["tagged_version_ids_to_delete"] == [3, 4]


def test_build_cleanup_plan_ages_out_single_tag_releases() -> None:
    module = _load_module()

    versions = [
        {
            "id": 1,
            "updated_at": "2026-04-17T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.3.0"]}},
        },
        {
            "id": 2,
            "updated_at": "2026-04-16T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.2.0"]}},
        },
        {
            "id": 3,
            "updated_at": "2026-04-15T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.1.0"]}},
        },
        {
            "id": 4,
            "updated_at": "2026-04-14T10:00:00Z",
            "metadata": {"container": {"tags": ["v1.0.0"]}},
        },
        {
            "id": 5,
            "updated_at": "2026-04-17T09:00:00Z",
            "metadata": {"container": {"tags": ["buildcache-runtime-plain-amd64"]}},
        },
    ]

    plan = module.build_cleanup_plan(versions, keep_publish_batches=3)

    assert plan["publish_batches_total"] == 4
    assert plan["publish_batches_retained"] == 3
    assert plan["publish_batches_deleted"] == 1
    assert plan["tagged_version_ids_to_delete"] == [4]
    assert plan["retained_tags"] == [
        "buildcache-runtime-plain-amd64",
        "v1.1.0",
        "v1.2.0",
        "v1.3.0",
    ]
