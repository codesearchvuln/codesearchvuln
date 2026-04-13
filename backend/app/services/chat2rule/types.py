from __future__ import annotations

from dataclasses import dataclass

from app.services.chat2rule.context import (
    Chat2RuleSelection,
    format_chat2rule_selection_anchor,
)


@dataclass(frozen=True, slots=True)
class Chat2RuleSnippet:
    file_path: str
    start_line: int
    end_line: int
    language: str
    code: str
    truncated: bool = False

    @property
    def anchor(self) -> str:
        return format_chat2rule_selection_anchor(
            Chat2RuleSelection(
                file_path=self.file_path,
                start_line=self.start_line,
                end_line=self.end_line,
            )
        )
