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
            "Clean up legacy public tags before enabling this workflow; see scripts/release-tag-cleanup.txt."
        )
    return metadata


def _commit_subjects_since(repo: Path, previous_source_sha: str, source_sha: str) -> list[str]:
    raw_subjects = _run_git(repo, "log", "--format=%s", f"{previous_source_sha}..{source_sha}")
    return [line.strip() for line in raw_subjects.splitlines() if line.strip()]


def _classify_bump(commit_subjects: list[str]) -> str | None:
    saw_fix = False
    for subject in commit_subjects:
        if FEAT_RE.match(subject) or REFACTOR_RE.match(subject):
            return "minor"
        if FIX_RE.match(subject) or ":" not in subject:
            saw_fix = True
    return "patch" if saw_fix else None


def _format_version(version: tuple[int, int, int]) -> str:
    return f"v{version[0]}.{version[1]}.{version[2]}"


def _increment_version(current: tuple[int, int, int], bump_type: str) -> tuple[int, int, int]:
    major, minor, patch = current
    if bump_type == "minor":
        return (major, minor + 1, 0)
    if bump_type == "patch":
        return (major, minor, patch + 1)
    raise ReleaseVersionError(f"unsupported bump type: {bump_type}")


def _resolve_current_subject(repo: Path, source_sha: str) -> list[str]:
    subject = _run_git(repo, "show", "-s", "--format=%s", source_sha)
    return [subject] if subject else []


def resolve_release_version(repo: Path, source_sha: str) -> dict[str, object]:
    semantic_tags = _list_semantic_tags(repo)
    latest_tag = semantic_tags[-1] if semantic_tags else None

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

    latest_metadata = _parse_tag_annotation(repo, latest_tag.name)
    previous_source_sha = latest_metadata["source_sha"]

    if previous_source_sha == source_sha:
        return {
            "should_release": True,
            "version": latest_tag.name,
            "bump_type": latest_metadata["bump_type"],
            "existing_tag": True,
            "previous_version": latest_tag.name,
            "previous_source_sha": previous_source_sha,
            "source_sha": source_sha,
            "commit_subjects": [],
        }

    commit_subjects = _commit_subjects_since(repo, previous_source_sha, source_sha)
    bump_type = _classify_bump(commit_subjects)
    if bump_type is None:
        return {
            "should_release": False,
            "version": None,
            "bump_type": None,
            "existing_tag": False,
            "previous_version": latest_tag.name,
            "previous_source_sha": previous_source_sha,
            "source_sha": source_sha,
            "commit_subjects": commit_subjects,
        }

    return {
        "should_release": True,
        "version": _format_version(_increment_version(latest_tag.version, bump_type)),
        "bump_type": bump_type,
        "existing_tag": False,
        "previous_version": latest_tag.name,
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
    args = parser.parse_args()

    try:
        payload = resolve_release_version(args.repo.resolve(), args.source_sha.strip())
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
