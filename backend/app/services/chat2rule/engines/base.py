from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Sequence

from app.services.chat2rule.types import Chat2RuleSnippet


@dataclass(frozen=True, slots=True)
class Chat2RuleFewShotExample:
    user_request: str
    snippets: Sequence[Chat2RuleSnippet]
    response_payload: dict[str, str]
    draft_rule_text: Optional[str] = None


class Chat2RulePromptEngine(ABC):
    engine_type: str

    @abstractmethod
    def build_system_prompt(self) -> str:
        raise NotImplementedError

    def get_few_shot_examples(self) -> Sequence[Chat2RuleFewShotExample]:
        return ()

    def build_llm_messages(
        self,
        *,
        snippets: Sequence[Chat2RuleSnippet],
        messages: Sequence[dict[str, str]],
        draft_rule_text: Optional[str],
    ) -> list[dict[str, str]]:
        llm_messages: list[dict[str, str]] = [
            {"role": "system", "content": self.build_system_prompt()},
        ]

        for example in self.get_few_shot_examples():
            llm_messages.extend(self._build_few_shot_messages(example))

        llm_messages.append(
            {
                "role": "user",
                "content": self._render_runtime_context_message(
                    snippets=snippets,
                    draft_rule_text=draft_rule_text,
                ),
            }
        )
        llm_messages.extend(messages)
        return llm_messages

    def _build_few_shot_messages(
        self,
        example: Chat2RuleFewShotExample,
    ) -> list[dict[str, str]]:
        return [
            {
                "role": "user",
                "content": self._render_example_user_message(example),
            },
            {
                "role": "assistant",
                "content": json.dumps(
                    example.response_payload,
                    ensure_ascii=False,
                    indent=2,
                ),
            },
        ]

    def _render_runtime_context_message(
        self,
        *,
        snippets: Sequence[Chat2RuleSnippet],
        draft_rule_text: Optional[str],
    ) -> str:
        return (
            "你将基于以下代码片段与对话继续生成或修订规则。\n\n"
            f"{self._render_snippet_bundle(snippets, draft_rule_text=draft_rule_text)}"
        )

    def _render_example_user_message(
        self,
        example: Chat2RuleFewShotExample,
    ) -> str:
        return (
            "下面是一个示例，请学习该引擎的规则组织方式、解释风格和 JSON 输出格式。\n\n"
            f"示例用户需求：\n{example.user_request.strip()}\n\n"
            f"{self._render_snippet_bundle(example.snippets, draft_rule_text=example.draft_rule_text)}"
        )

    def _render_snippet_bundle(
        self,
        snippets: Sequence[Chat2RuleSnippet],
        *,
        draft_rule_text: Optional[str],
    ) -> str:
        selection_summary = []
        snippet_blocks = []

        for snippet in snippets:
            suffix = "（已截断到前 160 行）" if snippet.truncated else ""
            selection_summary.append(f"- {snippet.anchor} [{snippet.language}]{suffix}")
            snippet_blocks.append(
                "\n".join(
                    [
                        f"文件片段: {snippet.anchor}",
                        f"语言: {snippet.language}",
                        "```text",
                        snippet.code,
                        "```",
                    ]
                )
            )

        draft_block = ""
        if draft_rule_text and draft_rule_text.strip():
            draft_block = (
                "\n当前规则草案（如果用户要求修改，请在此基础上迭代，而不是完全忽略上下文）：\n"
                "```yaml\n"
                f"{draft_rule_text.strip()}\n"
                "```\n"
            )

        return (
            "当前代码片段摘要：\n"
            f"{chr(10).join(selection_summary)}\n\n"
            "代码片段详情：\n\n"
            f"{chr(10).join(snippet_blocks)}"
            f"{draft_block}"
        )
