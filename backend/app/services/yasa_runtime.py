from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

_YASA_UAST_BINARY_BY_LANGUAGE: dict[str, str] = {
    "golang": "uast4go",
    "python": "uast4py",
}

_YASA_UAST_SEARCH_ROOTS: tuple[Path, ...] = (
    Path("/opt/yasa/engine/deps"),
    Path("/snapshot/YASA-Engine/deps"),
)


def resolve_yasa_uast_sdk_path(language: Optional[str]) -> Optional[str]:
    normalized = str(language or "").strip().lower()
    binary_name = _YASA_UAST_BINARY_BY_LANGUAGE.get(normalized)
    if not binary_name:
        return None

    for root in _YASA_UAST_SEARCH_ROOTS:
        candidate = root / binary_name / binary_name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def build_yasa_scan_command(
    *,
    binary: str,
    source_path: str,
    language: str,
    report_dir: str,
    checker_pack_ids: list[str],
    checker_ids: Optional[list[str]] = None,
    rule_config_file: Optional[str] = None,
) -> list[str]:
    cmd = [
        binary,
        "--sourcePath",
        source_path,
        "--language",
        language,
        "--report",
        report_dir,
        "--checkerPackIds",
        ",".join(checker_pack_ids),
    ]
    if checker_ids:
        cmd.extend(["--checkerIds", ",".join(checker_ids)])
    if rule_config_file:
        cmd.extend(["--ruleConfigFile", rule_config_file])

    uast_sdk_path = resolve_yasa_uast_sdk_path(language)
    if uast_sdk_path:
        cmd.extend(["--uastSDKPath", uast_sdk_path])

    return cmd
