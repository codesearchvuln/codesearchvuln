#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

RUN_TAG_PATTERN = re.compile(
    r"^(?P<base>.+)-(?P<run_id>\d+)-(?P<run_attempt>\d+)-(?P<arch>amd64|arm64)$"
)


def _version_tags(version: dict[str, Any]) -> list[str]:
    metadata = version.get("metadata") or {}
    container = metadata.get("container") or {}
    tags = container.get("tags") or []
    return [tag for tag in tags if isinstance(tag, str) and tag]


def _version_sort_key(version: dict[str, Any]) -> str:
    return str(version.get("updated_at") or version.get("created_at") or "")


def _run_tag_metadata(tags: list[str]) -> tuple[str | None, str | None]:
    matched_keys: set[str] = set()
    matched_bases: set[str] = set()
    non_run_tags: list[str] = []

    for tag in tags:
        match = RUN_TAG_PATTERN.fullmatch(tag)
        if match:
            matched_bases.add(match.group("base"))
            matched_keys.add(
                f"{match.group('base')}|{match.group('run_id')}|{match.group('run_attempt')}"
            )
            continue
        non_run_tags.append(tag)

    if len(matched_keys) != 1 or len(matched_bases) != 1:
        return None, None

    matched_base = next(iter(matched_bases))
    if non_run_tags and set(non_run_tags) != {matched_base}:
        return None, None

    return next(iter(matched_keys)), matched_base


def _is_sticky_alias(tags: list[str]) -> bool:
    return bool(tags) and all(tag.startswith("buildcache-") for tag in tags)


def build_cleanup_plan(
    versions: list[dict[str, Any]], keep_publish_batches: int
) -> dict[str, Any]:
    if keep_publish_batches < 0:
        raise ValueError("keep_publish_batches must be >= 0")

    untagged_version_ids: list[int] = []
    sticky_alias_versions: list[dict[str, Any]] = []
    publish_batches: dict[str, dict[str, Any]] = {}
    deferred_tagged_versions: list[dict[str, Any]] = []

    for version in versions:
        version_id = version["id"]
        tags = _version_tags(version)
        if not tags:
            untagged_version_ids.append(version_id)
            continue

        publish_batch_key, publish_batch_base = _run_tag_metadata(tags)
        if publish_batch_key is None or publish_batch_base is None:
            deferred_tagged_versions.append(version)
            continue

        batch = publish_batches.setdefault(
            publish_batch_key,
            {
                "key": publish_batch_key,
                "base": publish_batch_base,
                "sort_key": "",
                "tags": set(),
                "version_ids": [],
            },
        )
        batch["sort_key"] = max(batch["sort_key"], _version_sort_key(version))
        batch["tags"].update(tags)
        batch["version_ids"].append(version_id)

    newest_publish_batch_by_base: dict[str, dict[str, Any]] = {}
    for batch in sorted(
        publish_batches.values(),
        key=lambda item: (item["sort_key"], item["key"]),
        reverse=True,
    ):
        newest_publish_batch_by_base.setdefault(batch["base"], batch)

    for version in deferred_tagged_versions:
        tags = _version_tags(version)
        if len(set(tags)) == 1:
            matched_batch = newest_publish_batch_by_base.get(tags[0])
            if matched_batch is not None:
                matched_batch["sort_key"] = max(
                    matched_batch["sort_key"], _version_sort_key(version)
                )
                matched_batch["tags"].update(tags)
                matched_batch["version_ids"].append(version["id"])
                continue

        if _is_sticky_alias(tags):
            sticky_alias_versions.append(version)
            continue

        synthetic_batch_key = f"standalone|{version['id']}"
        publish_batches[synthetic_batch_key] = {
            "key": synthetic_batch_key,
            "base": synthetic_batch_key,
            "sort_key": _version_sort_key(version),
            "tags": set(tags),
            "version_ids": [version["id"]],
        }

    sorted_publish_batches = sorted(
        publish_batches.values(),
        key=lambda item: (item["sort_key"], item["key"]),
        reverse=True,
    )
    retained_publish_batches = sorted_publish_batches[:keep_publish_batches]
    deleted_publish_batches = sorted_publish_batches[keep_publish_batches:]

    tagged_version_ids_to_delete = sorted(
        version_id
        for batch in deleted_publish_batches
        for version_id in batch["version_ids"]
    )
    retained_tags = sorted(
        {
            *(
                tag
                for version in sticky_alias_versions
                for tag in _version_tags(version)
            ),
            *(tag for batch in retained_publish_batches for tag in batch["tags"]),
        }
    )

    tagged_versions_total = sum(
        1 for version in versions if _version_tags(version)
    )

    return {
        "untagged_version_ids": sorted(untagged_version_ids),
        "tagged_version_ids_to_delete": tagged_version_ids_to_delete,
        "tagged_versions_total": tagged_versions_total,
        "untagged_versions_total": len(untagged_version_ids),
        "publish_batches_total": len(sorted_publish_batches),
        "publish_batches_retained": len(retained_publish_batches),
        "publish_batches_deleted": len(deleted_publish_batches),
        "retained_publish_batches": [
            batch["key"] for batch in retained_publish_batches
        ],
        "deleted_publish_batches": [
            batch["key"] for batch in deleted_publish_batches
        ],
        "retained_tags": retained_tags,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Plan GHCR cleanup for tagged publish batches and untagged versions."
    )
    parser.add_argument(
        "--versions-file",
        required=True,
        type=Path,
        help="Path to a JSON file containing GitHub package versions.",
    )
    parser.add_argument(
        "--keep-publish-batches",
        required=True,
        type=int,
        help="How many tagged publish batches to retain.",
    )
    args = parser.parse_args()

    versions = json.loads(args.versions_file.read_text(encoding="utf-8"))
    plan = build_cleanup_plan(
        versions=versions,
        keep_publish_batches=args.keep_publish_batches,
    )
    json.dump(plan, fp=sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
