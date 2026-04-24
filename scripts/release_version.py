#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


SEMVER_TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
FEAT_RE = re.compile(r"^feat(?:\(.+\))?!?:")
FIX_RE = re.compile(r"^fix(?:\(.+\))?!?:")
REFACTOR_RE = re.compile(r"^refactor(?:\(.+\))?!?:")
BOOTSTRAP_VERSION = (0, 0, 1)
REQUIRED_TAG_FIELDS = ("source_sha", "bump_type", "generated_by")


class ReleaseVersionError(RuntimeError):
    pass


@dataclass(frozen=True)
class SemanticTag:
    name: str
    version: tuple[int, int, int]


@dataclass(frozen=True)
class ManagedSemanticTag:
    semantic: SemanticTag
    metadata: dict[str, str]


def _run_git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise ReleaseVersionError(f"git {' '.join(args)}: {stderr}")
    return result.stdout.strip()


def _list_semantic_tags(repo: Path) -> list[SemanticTag]:
    raw_tags = _run_git(repo, "tag", "--list")
    tags: list[SemanticTag] = []
    for raw_tag in raw_tags.splitlines():
        tag = raw_tag.strip()
        if not tag:
            continue
        match = SEMVER_TAG_RE.fullmatch(tag)
        if not match:
            continue
        tags.append(
            SemanticTag(
                name=tag,
                version=tuple(int(part) for part in match.groups()),
            )
        )
    return sorted(tags, key=lambda item: item.version)


def _parse_tag_annotation(repo: Path, tag: str) -> dict[str, str]:
    contents = _run_git(repo, "for-each-ref", f"refs/tags/{tag}", "--format=%(contents)")
    metadata: dict[str, str] = {}
    for line in contents.splitlines():
        line = line.strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key in REQUIRED_TAG_FIELDS and value:
            metadata[key] = value
    missing = [field for field in REQUIRED_TAG_FIELDS if field not in metadata]
    if missing:
        raise ReleaseVersionError(
            f"annotated release tag {tag} is missing required metadata fields: {', '.join(missing)}. "
            "Managed v0.0.* tags must keep release metadata intact."
        )
    return metadata


def _is_managed_track(version: tuple[int, int, int]) -> bool:
    major, minor, _patch = version
    return (major, minor) == (0, 0)


def _list_managed_tags(repo: Path, semantic_tags: list[SemanticTag]) -> list[ManagedSemanticTag]:
    managed_tags: list[ManagedSemanticTag] = []
    for semantic_tag in semantic_tags:
        if not _is_managed_track(semantic_tag.version):
            continue
        managed_tags.append(
            ManagedSemanticTag(
                semantic=semantic_tag,
                metadata=_parse_tag_annotation(repo, semantic_tag.name),
            )
        )
    return managed_tags


def _commit_subjects_since(repo: Path, previous_source_sha: str, source_sha: str) -> list[str]:
    raw_subjects = _run_git(repo, "log", "--format=%s", f"{previous_source_sha}..{source_sha}")
    return [line.strip() for line in raw_subjects.splitlines() if line.strip()]


def _classify_bump(commit_subjects: list[str]) -> str | None:
    for subject in commit_subjects:
        if FEAT_RE.match(subject) or REFACTOR_RE.match(subject) or FIX_RE.match(subject) or ":" not in subject:
            return "patch"
    return None


def _format_version(version: tuple[int, int, int]) -> str:
    return f"v{version[0]}.{version[1]}.{version[2]}"


def _increment_version(current: tuple[int, int, int], bump_type: str) -> tuple[int, int, int]:
    major, minor, patch = current
    if bump_type == "patch":
        return (major, minor, patch + 1)
    raise ReleaseVersionError(f"unsupported bump type: {bump_type}")


def _resolve_current_subject(repo: Path, source_sha: str) -> list[str]:
    subject = _run_git(repo, "show", "-s", "--format=%s", source_sha)
    return [subject] if subject else []


def resolve_release_version(
    repo: Path,
    source_sha: str,
    *,
    force_patch: bool = False,
) -> dict[str, object]:
    managed_tags = _list_managed_tags(repo, _list_semantic_tags(repo))
    latest_tag = managed_tags[-1] if managed_tags else None

    if latest_tag is None:
        return {
            "should_release": True,
            "version": _format_version(BOOTSTRAP_VERSION),
            "bump_type": "bootstrap",
            "existing_tag": False,
            "previous_version": None,
            "previous_source_sha": None,
            "source_sha": source_sha,
            "commit_subjects": _resolve_current_subject(repo, source_sha),
        }

    existing_managed_tag = next(
        (managed_tag for managed_tag in reversed(managed_tags) if managed_tag.metadata["source_sha"] == source_sha),
        None,
    )
    if existing_managed_tag is not None:
        return {
            "should_release": True,
            "version": existing_managed_tag.semantic.name,
            "bump_type": existing_managed_tag.metadata["bump_type"],
            "existing_tag": True,
            "previous_version": existing_managed_tag.semantic.name,
            "previous_source_sha": existing_managed_tag.metadata["source_sha"],
            "source_sha": source_sha,
            "commit_subjects": [],
        }

    previous_source_sha = latest_tag.metadata["source_sha"]

    commit_subjects = _commit_subjects_since(repo, previous_source_sha, source_sha)
    bump_type = _classify_bump(commit_subjects)
    if bump_type is None:
        if force_patch:
            bump_type = "patch"
        else:
            return {
                "should_release": False,
                "version": None,
                "bump_type": None,
                "existing_tag": False,
                "previous_version": latest_tag.semantic.name,
                "previous_source_sha": previous_source_sha,
                "source_sha": source_sha,
                "commit_subjects": commit_subjects,
            }

    return {
        "should_release": True,
        "version": _format_version(_increment_version(latest_tag.semantic.version, bump_type)),
        "bump_type": bump_type,
        "existing_tag": False,
        "previous_version": latest_tag.semantic.name,
        "previous_source_sha": previous_source_sha,
        "source_sha": source_sha,
        "commit_subjects": commit_subjects,
    }


def _write_github_output(path: Path, payload: dict[str, object]) -> None:
    lines: list[str] = []
    for key in (
        "should_release",
        "version",
        "bump_type",
        "existing_tag",
        "previous_version",
        "previous_source_sha",
        "source_sha",
    ):
        value = payload.get(key)
        if isinstance(value, bool):
            rendered = "true" if value else "false"
        elif value is None:
            rendered = ""
        else:
            rendered = str(value)
        lines.append(f"{key}={rendered}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _render_text(payload: dict[str, object]) -> str:
    version = payload.get("version") or "(none)"
    bump_type = payload.get("bump_type") or "(none)"
    previous_version = payload.get("previous_version") or "(none)"
    previous_source_sha = payload.get("previous_source_sha") or "(none)"
    subjects = payload.get("commit_subjects") or []
    lines = [
        f"should_release: {payload['should_release']}",
        f"version: {version}",
        f"bump_type: {bump_type}",
        f"existing_tag: {payload['existing_tag']}",
        f"previous_version: {previous_version}",
        f"previous_source_sha: {previous_source_sha}",
        f"source_sha: {payload['source_sha']}",
        "commit_subjects:",
    ]
    if subjects:
        lines.extend(f"- {subject}" for subject in subjects)
    else:
        lines.append("- (none)")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve the next semantic release tag for the release branch workflow")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Git repository root (default: current directory)")
    parser.add_argument("--source-sha", required=True, help="Source commit SHA from main used to generate the release branch")
    parser.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format for stdout",
    )
    parser.add_argument(
        "--github-output",
        type=Path,
        help="Optional path to a GitHub Actions output file",
    )
    parser.add_argument(
        "--force-patch",
        action="store_true",
        help="Treat otherwise non-releasing commit subjects as a managed patch release.",
    )
    args = parser.parse_args()

    try:
        payload = resolve_release_version(
            args.repo.resolve(),
            args.source_sha.strip(),
            force_patch=args.force_patch,
        )
    except ReleaseVersionError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.github_output is not None:
        _write_github_output(args.github_output, payload)

    if args.format == "text":
        print(_render_text(payload))
    else:
        print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
