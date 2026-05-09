from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolFailureState:
    error: str = ""
    error_code: str = "internal_error"
    diagnostics: list[str] = field(default_factory=list)
    reflection: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolCallContext:
    tool_name: str
    requested_tool_name: str
    phase: str = ""
    agent_type: str = ""
    raw_input: dict[str, Any] = field(default_factory=dict)
    normalized_input: dict[str, Any] = field(default_factory=dict)
    validated_input: dict[str, Any] = field(default_factory=dict)
    attempt: int = 1
    caller: str = ""
    trace_id: str = ""
    runtime_policy: dict[str, Any] = field(default_factory=dict)
    failure_state: ToolFailureState | None = None
