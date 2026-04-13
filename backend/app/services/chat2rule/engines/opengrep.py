from __future__ import annotations

from typing import Sequence

from app.services.chat2rule.engines.base import (
    Chat2RuleFewShotExample,
    Chat2RulePromptEngine,
)
from app.services.chat2rule.types import Chat2RuleSnippet


class OpengrepChat2RulePromptEngine(Chat2RulePromptEngine):
    engine_type = "opengrep"

    def build_system_prompt(self) -> str:
        return """
你是资深静态分析规则工程师。你的任务是根据用户描述和给定代码片段，生成一条可保存的 Opengrep 规则草案。

只允许输出 JSON 对象，禁止输出 markdown 解释、额外前后缀或自然语言包裹。
JSON 结构必须为：
{
  "assistant_message": "string",
  "title": "string",
  "explanation": "string",
  "rule_text": "string"
}

Opengrep 规则语法速查：
1. rule_text 必须是完整 YAML，根节点为 rules，且只包含 1 条规则。
2. 单条规则至少包含：id、message、severity、languages。
3. 单条规则必须至少包含以下模式字段之一：
   - pattern
   - patterns
   - pattern-either
   - pattern-regex
4. 常用语法：
   - $X / $CALL / $VALUE：匹配并捕获任意代码片段或标识符
   - ...：匹配任意参数或任意语句序列
   - pattern：匹配单个结构
   - patterns：其中所有子条件都必须同时满足
   - pattern-either：多个候选结构中命中任意一个即可
   - pattern-not：排除某个不应命中的结构
   - pattern-inside：要求命中出现在指定上下文中
   - metavariable-regex / metavariable-pattern：对捕获变量进一步加约束
5. severity 只能是 ERROR、WARNING、INFO。
6. languages 应与片段语言一致，使用列表形式，例如 [python]、[javascript]。
7. 优先生成简洁、可解释、可落地的模式，不要编造高级数据流能力；除非用户明确要求，否则不要启用 taint mode。
8. 如果用户是在修改现有草案，请输出一版完整的新 YAML，而不是增量 diff。
9. title 适合直接作为规则名称。
10. assistant_message 和 explanation 使用简体中文。
""".strip()

    def get_few_shot_examples(self) -> Sequence[Chat2RuleFewShotExample]:
        return (
            Chat2RuleFewShotExample(
                user_request="请为 Python 中使用 shell=True 的 subprocess 调用生成一条规则，避免写成过于宽泛的匹配。",
                snippets=[
                    Chat2RuleSnippet(
                        file_path="app/runner.py",
                        start_line=12,
                        end_line=17,
                        language="python",
                        code="\n".join(
                            [
                                "  12 | import subprocess",
                                "  13 | ",
                                "  14 | def run_cmd(user_input):",
                                "  15 |     subprocess.run(user_input, shell=True)",
                                "  16 |     subprocess.Popen(user_input, shell=True)",
                                "  17 |     return True",
                            ]
                        ),
                    )
                ],
                response_payload={
                    "assistant_message": "我根据示例代码生成了一条聚焦 subprocess shell=True 的 Opengrep 规则。",
                    "title": "python-subprocess-shell-true",
                    "explanation": "这条规则使用 pattern-either 覆盖常见的 subprocess API，并且只在显式传入 shell=True 时触发。",
                    "rule_text": "\n".join(
                        [
                            "rules:",
                            "  - id: python-subprocess-shell-true",
                            "    message: 检测显式传入 shell=True 的 subprocess 调用，这类写法容易引入命令注入风险。",
                            "    severity: ERROR",
                            "    languages:",
                            "      - python",
                            "    pattern-either:",
                            "      - pattern: subprocess.run(..., shell=True, ...)",
                            "      - pattern: subprocess.Popen(..., shell=True, ...)",
                            "      - pattern: subprocess.call(..., shell=True, ...)",
                            "      - pattern: subprocess.check_call(..., shell=True, ...)",
                            "      - pattern: subprocess.check_output(..., shell=True, ...)",
                        ]
                    ),
                },
            ),
            Chat2RuleFewShotExample(
                user_request="请生成一条 JavaScript 规则，检测把变量直接赋给 innerHTML 的场景，但要排除 DOMPurify.sanitize 的安全写法。",
                snippets=[
                    Chat2RuleSnippet(
                        file_path="src/render.js",
                        start_line=8,
                        end_line=13,
                        language="javascript",
                        code="\n".join(
                            [
                                "   8 | export function render(target, html) {",
                                "   9 |   target.innerHTML = html;",
                                "  10 | }",
                                "  11 | ",
                                "  12 | export function safeRender(target, html) {",
                                "  13 |   target.innerHTML = DOMPurify.sanitize(html);",
                            ]
                        ),
                    )
                ],
                response_payload={
                    "assistant_message": "我给这类 innerHTML 赋值场景生成了一条带排除条件的规则。",
                    "title": "javascript-unsafe-innerhtml-assignment",
                    "explanation": "这条规则使用 patterns 组合必选命中条件和 pattern-not 排除净化后的安全写法，适合降低误报。",
                    "rule_text": "\n".join(
                        [
                            "rules:",
                            "  - id: javascript-unsafe-innerhtml-assignment",
                            "    message: 检测将变量直接写入 innerHTML 的场景，建议改用 textContent 或在写入前执行净化。",
                            "    severity: WARNING",
                            "    languages:",
                            "      - javascript",
                            "    patterns:",
                            "      - pattern: $TARGET.innerHTML = $VALUE",
                            "      - pattern-not: $TARGET.innerHTML = DOMPurify.sanitize($VALUE)",
                        ]
                    ),
                },
            ),
        )
