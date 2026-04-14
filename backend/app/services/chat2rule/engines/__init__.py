from __future__ import annotations

from app.services.chat2rule.engines.base import Chat2RulePromptEngine
from app.services.chat2rule.engines.multi import (
    BanditChat2RulePromptEngine,
    GitleaksChat2RulePromptEngine,
    PhpstanChat2RulePromptEngine,
    PmdChat2RulePromptEngine,
    YasaChat2RulePromptEngine,
)
from app.services.chat2rule.engines.opengrep import OpengrepChat2RulePromptEngine


def get_chat2rule_prompt_engine(engine_type: str) -> Chat2RulePromptEngine:
    normalized_engine_type = str(engine_type or "").strip().lower()
    if normalized_engine_type == "opengrep":
        return OpengrepChat2RulePromptEngine()
    if normalized_engine_type == "gitleaks":
        return GitleaksChat2RulePromptEngine()
    if normalized_engine_type == "bandit":
        return BanditChat2RulePromptEngine()
    if normalized_engine_type == "phpstan":
        return PhpstanChat2RulePromptEngine()
    if normalized_engine_type == "pmd":
        return PmdChat2RulePromptEngine()
    if normalized_engine_type == "yasa":
        return YasaChat2RulePromptEngine()
    raise ValueError(f"不支持的 Chat2Rule 引擎: {engine_type}")


__all__ = [
    "BanditChat2RulePromptEngine",
    "Chat2RulePromptEngine",
    "GitleaksChat2RulePromptEngine",
    "OpengrepChat2RulePromptEngine",
    "PhpstanChat2RulePromptEngine",
    "PmdChat2RulePromptEngine",
    "YasaChat2RulePromptEngine",
    "get_chat2rule_prompt_engine",
]
