from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ProbeAction = Literal["tool", "cleanup_file"]


@dataclass(frozen=True)
class TOOL_RUNTIMEProbeCheck:
    step: str
    action: ProbeAction = "tool"
    tool_name: str | None = None
    arguments: dict[str, Any] = field(default_factory=dict)
    expect_success: bool = True
    accept_any_result: bool = False
    required: bool = True
    cleanup_path: str | None = None


TOOL_RUNTIME_VERIFICATION_TOOLS: dict[str, list[str]] = {}


def get_verification_tools(tool_runtime_id: str) -> list[str]:
    return list(TOOL_RUNTIME_VERIFICATION_TOOLS.get(str(tool_runtime_id or "").strip(), []))


def build_probe_checks(
    *,
    tool_runtime_id: str,
    filesystem_probe_file: str | None = None,
    code_probe_file: str | None = None,
    code_probe_function: str | None = None,
    code_probe_line: int | None = None,
) -> list[TOOL_RUNTIMEProbeCheck]:
    _ = tool_runtime_id
    _ = filesystem_probe_file
    _ = code_probe_file
    _ = code_probe_function
    _ = code_probe_line
    return []
