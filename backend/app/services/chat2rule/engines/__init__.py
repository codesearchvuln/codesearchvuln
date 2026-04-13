from __future__ import annotations

from app.services.chat2rule.engines.base import Chat2RulePromptEngine
from app.services.chat2rule.engines.opengrep import OpengrepChat2RulePromptEngine


def get_chat2rule_prompt_engine(engine_type: str) -> Chat2RulePromptEngine:
    normalized_engine_type = str(engine_type or "").strip().lower()
    if normalized_engine_type == "opengrep":
        return OpengrepChat2RulePromptEngine()
    raise ValueError(f"不支持的 Chat2Rule 引擎: {engine_type}")


__all__ = [
    "Chat2RulePromptEngine",
    "OpengrepChat2RulePromptEngine",
    "get_chat2rule_prompt_engine",
]
