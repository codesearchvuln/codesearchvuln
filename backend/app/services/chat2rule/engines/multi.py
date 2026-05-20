from __future__ import annotations

from app.services.chat2rule.engines.base import Chat2RulePromptEngine


class _GenericChat2RulePromptEngine(Chat2RulePromptEngine):
    engine_type = "generic"
    _target_format = "text"
    _engine_label = "静态分析"
    _rules_hint = ""

    def build_system_prompt(self) -> str:
        return f"""
你是资深静态分析规则工程师。你的任务是根据用户描述和给定代码片段，生成一条可用于 {self._engine_label} 的规则草案。

只允许输出 JSON 对象，禁止输出 markdown 解释、额外前后缀或自然语言包裹。
JSON 结构必须为：
{{
  "assistant_message": "string",
  "title": "string",
  "explanation": "string",
  "rule_text": "string"
}}

生成要求：
1. rule_text 必须是可直接保存/复制的完整规则草案，目标格式为: {self._target_format}
2. 如用户要求修改现有草案，必须输出完整新版本而不是增量 diff。
3. title 适合作为规则名称。
4. assistant_message 和 explanation 使用简体中文。
5. 严格结合提供代码片段，不要编造不存在的 API 或上下文。
{self._rules_hint}
""".strip()


class GitleaksChat2RulePromptEngine(_GenericChat2RulePromptEngine):
    engine_type = "gitleaks"
    _target_format = "JSON（单条 gitleaks 规则对象）"
    _engine_label = "Gitleaks"
    _rules_hint = """
Gitleaks 规则字段建议包含：
- name
- description
- rule_id
- secret_group
- regex
- keywords (array)
- tags (array)
- path (optional)
- entropy (optional)
""".strip()


class BanditChat2RulePromptEngine(_GenericChat2RulePromptEngine):
    engine_type = "bandit"
    _target_format = "YAML 或文本草案（供规则策略讨论）"
    _engine_label = "Bandit"
    _rules_hint = """
Bandit 在本系统中当前仅支持生成草案，不支持直接保存为自定义规则。
请优先输出可执行的检测思路、匹配逻辑和可落地的规则建议文本。
""".strip()


class PhpstanChat2RulePromptEngine(_GenericChat2RulePromptEngine):
    engine_type = "phpstan"
    _target_format = "NEON 或文本草案（供规则策略讨论）"
    _engine_label = "PHPStan"
    _rules_hint = """
PHPStan 在本系统中当前仅支持生成草案，不支持直接保存为自定义规则。
请输出可落地的规则建议，尽量给出可实现的 rule 标识与触发条件。
""".strip()


class PmdChat2RulePromptEngine(_GenericChat2RulePromptEngine):
    engine_type = "pmd"
    _target_format = "XML（PMD ruleset）"
    _engine_label = "PMD"


class YasaChat2RulePromptEngine(_GenericChat2RulePromptEngine):
    engine_type = "yasa"
    _target_format = "JSON（YASA rule-config）"
    _engine_label = "YASA"
    _rules_hint = """
YASA rule-config JSON 必须包含 checkerIds（非空数组）。
若给出 checkerPackIds，请保证与 checkerIds 能对应。
""".strip()

