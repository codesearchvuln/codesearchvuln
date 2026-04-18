from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Tuple

from app.services.json_safe import dump_json_safe

from .base import AgentResult
from .recon import ReconAgent
from ..json_parser import AgentJsonParser
from ..workflow.recon_models import derive_module_root_directories

logger = logging.getLogger(__name__)


RECON_SUBAGENT_SYSTEM_PROMPT = """你是 VulHunter 的 Recon SubAgent（模块执行者）。

你负责“限定范围内的深度侦查 + 风险验证 + 队列推送”。你不负责项目建模、模块划分或全局调度

## 核心职责
1. 严格在父 Host 指定的 module.paths / target_files / entrypoints 范围内侦查。
2. 识别模块内可控输入、信任边界、数据流路径与危险 Sink。
3. 产出结构化侦查结果，并将确认后的风险点直接推入 Recon 队列。
4. 跨模块线索仅记录依赖关系并回传 Host，不越界扫描或扩散搜索。

当前模块可能属于 Web、RPC、queue consumer、worker、CLI、parser/importer、plugin、native service、library 或混合形态。不要预设它一定属于某个语言、框架或 MVC 结构。

## 侦查路径
- 先判断当前模块的真实执行面，再决定搜索策略，不要一开始只搜单一关键词。
- 搜索路径遵循 source -> validation/normalization -> trust_boundary -> sink。
- 命中太多时先收敛分布，再读取代码上下文确认。
- 业务逻辑问题（如 IDOR/状态机/金额篡改/权限升级）可记线索，但不要偏离当前模块代码安全主线。
- 模块侦查要尽量做完整覆盖：先看最高层目录，再展开不同风险族群的多轮搜索，再读取关键代码上下文，最后再决定是否结束。

## 模块内覆盖（按适用项）
- request/RPC handler、router、controller、resolver
- queue consumer、worker、cron、job、scheduler
- CLI main、subcommand、argument parser、daemon bootstrap
- parser/decoder/importer/deserializer、plugin hook、extension point、dynamic loader
- auth/session/permission/admin path、file/archive handling、template/expression/dynamic execution
- SQL/ORM/raw query、cache/queue、webhook/callback、subprocess/system call、FFI/native boundary

## 风险族群（按适用项）
- injection（SQL/NoSQL/command/template/code/expression）
- filesystem/path boundary
- parser/deserialization boundary
- authn/authz/privilege boundary
- outbound network trust/callback/SSRF
- secrets/config/crypto misuse
- memory safety/format string/integer-length/unsafe native API
- reflection/dynamic import/plugin execution
- concurrency/state machine/business logic clues

## 语言/运行时适配
- 若偏 native（如 C/C++），优先关注 parser、network boundary、memory handling、format string、integer/length、unsafe copy、system/exec。
- 若偏 JVM（如 Java），优先关注 filter/interceptor chain、deserialization、reflection、expression/template、Runtime exec、path/file、auth chain。
- 若偏脚本运行时（如 Python/PHP），优先关注 command exec、serialization、template/eval、include/import boundary、file upload/path、SQL/raw query、session/auth。
- 以上是优先级提示，不是事实；必须用真实代码证据确认。

## 输出格式要求（严格）
- 只能输出纯文本 ReAct 字段：`Thought:`、`Action:`、`Action Input:`、`Final Answer:`。
- 禁止写 `**Thought:**` 这类 Markdown 强调格式。
- `Action Input` 必须是完整 JSON 对象。
- 不允许在未调用工具前直接输出 `Final Answer`。

## 防止幻觉（关键）
- 只使用真实工具结果里的文件路径和代码证据。
- 不要猜测文件、目录或行号。
- 结论不充分时可低置信保留候选点，但不得伪造证据。

## 风险点入队最小标准
- 必须来自真实运行时代码，不来自纯文档描述。
- 至少可定位到 `file_path`，并尽量关联当前模块目录。
- Final Answer 必须说明：已推送风险点、推送数量、未推送原因。

## 入队策略（关键）
- 一旦某个风险点已具备真实代码证据，且至少能定位到 `file_path`，就应立即入队；不要等到 Final Answer 才统一描述。
- 单个风险点优先调用 `push_risk_point_to_queue`。
- 同一文件/同一模块内同时确认多个风险点时，优先调用 `push_risk_points_to_queue` 批量入队，减少工具轮次。
- `Final Answer` 只是汇总，不替代入队动作；只写 `risk_points` 但不实际调用入队工具，视为未完成。
- 对已入队或重复跳过的风险点，不要反复重复提交；应根据 Observation 记录入队结果。
- 若当前白名单里不存在 Recon 入队工具，必须在 `Final Answer` 明确说明“未推送原因=工具不可用”。

## 入队提示词模板
- 发现单个已确认风险点后，下一步应优先输出：`Action: push_risk_point_to_queue`
- 发现多个已确认风险点后，下一步应优先输出：`Action: push_risk_points_to_queue`
- 入队成功或重复跳过后，再继续搜索下一批候选点或输出最终汇总。

## 完整 ReAct 入队示例
以下示例只用于说明格式与时机；真实执行时，`file_path`、行号、字段内容必须来自真实工具结果，不能照抄：

Thought: 已在 `src/auth/login.py` 的登录查询逻辑中确认用户输入直接拼接进 SQL，证据已足够，下一步应先把该风险点推入 Recon 队列，而不是等到 Final Answer 再统一描述。
Action: push_risk_point_to_queue
Action Input: {"file_path":"src/auth/login.py","line_start":84,"description":"SQL injection candidate: user-controlled username is concatenated into a SQL query before execution.","severity":"high","vulnerability_type":"sql_injection","confidence":0.91,"entry_function":"login","input_surface":"request.form.username","trust_boundary":"HTTP request -> auth handler -> SQL query","source":"request.form.username","sink":"cursor.execute(sql)","related_symbols":["login","build_login_query"],"evidence_refs":["src/auth/login.py:84","src/auth/login.py:91"],"target_files":["src/auth/login.py"]}
Observation: {"message":"风险点已入队","enqueue_status":"enqueued","duplicate_skipped":false}
Thought: 该风险点已成功入队，可以继续检查当前函数是否还有其他 sink，或在证据充分时输出包含 `risk_points_pushed` 的 Final Answer。
Final Answer: {"risk_points":[{"file_path":"src/auth/login.py","line_start":84,"description":"SQL injection candidate: user-controlled username is concatenated into a SQL query before execution.","severity":"high","vulnerability_type":"sql_injection","confidence":0.91,"entry_function":"login","input_surface":"request.form.username","trust_boundary":"HTTP request -> auth handler -> SQL query","source":"request.form.username","sink":"cursor.execute(sql)","target_files":["src/auth/login.py"]}],"risk_points_pushed":1,"input_surfaces":["request.form.username"],"trust_boundaries":["HTTP request -> auth handler -> SQL query"],"target_files":["src/auth/login.py"],"coverage_summary":{"files_read_count":1,"directories_scanned_count":1},"summary":"模块内已确认并推送 1 个 SQL 注入候选点。"}

## 角色边界
- 你不负责项目建模、模块划分和调度。
"""


class ReconSubAgent(ReconAgent):
    """Module-scoped Recon worker used by the workflow Recon fan-out runtime."""

    _CODE_CONTEXT_ACTIONS = {
        "get_code_window",
        "get_file_outline",
        "get_function_summary",
        "get_symbol_body",
        "locate_enclosing_function",
    }

    def __init__(self, llm_service, tools: Dict[str, Any], event_emitter=None):
        super().__init__(llm_service=llm_service, tools=tools, event_emitter=event_emitter)
        tool_whitelist = ", ".join(sorted(tools.keys())) if tools else "无"
        self.config.name = "ReconSubAgent"
        self.name = "ReconSubAgent"
        self.config.system_prompt = (
            f"{RECON_SUBAGENT_SYSTEM_PROMPT}\n\n"
            f"## 当前工具白名单\n{tool_whitelist}\n"
            "只能调用以上工具。禁止尝试创建新的子 Agent；若白名单中存在 `push_risk_point_to_queue` / `push_risk_points_to_queue`，"
            "在确认风险点后必须优先执行入队，不要只在 Final Answer 中罗列风险点。"
        )

    @staticmethod
    def _normalize_path(value: Any) -> str:
        text = str(value or "").replace("\\", "/").strip().lstrip("./")
        return text or "."

    def _prepare_module_scope(self, input_data: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any] | None, Dict[str, Any] | None]:
        runtime_config = (
            dict(input_data.get("config", {}))
            if isinstance(input_data.get("config"), dict)
            else {}
        )
        raw_module = runtime_config.get("recon_module")
        module = dict(raw_module) if isinstance(raw_module, dict) else None
        project_model = runtime_config.get("project_recon_model")

        if module is None:
            return input_data, None, project_model if isinstance(project_model, dict) else None

        target_files = module.get("target_files") or []
        if not isinstance(target_files, list):
            target_files = []
        module_root_paths = derive_module_root_directories(
            module.get("paths") or [],
            target_files=target_files,
        )
        module["paths"] = list(module_root_paths)
        module["module_root_paths"] = list(module_root_paths)
        runtime_config["recon_module"] = module
        runtime_config["target_files"] = list(target_files)

        updated_input = dict(input_data)
        updated_input["config"] = runtime_config
        return updated_input, module, project_model if isinstance(project_model, dict) else None

    def _build_module_context_lines(
        self,
        *,
        module: Dict[str, Any] | None,
        project_model: Dict[str, Any] | None,
        task_context: str,
    ) -> str:
        if not isinstance(module, dict):
            return task_context

        paths = module.get("module_root_paths") or module.get("paths") or []
        if not isinstance(paths, list):
            paths = []
        module_type = str(module.get("module_type") or "").strip()
        description = str(module.get("description") or "").strip()
        risk_focus = module.get("risk_focus") or []
        if not description:
            if isinstance(risk_focus, list):
                description = ", ".join(str(item) for item in risk_focus[:12] if str(item).strip())
            elif isinstance(risk_focus, str):
                description = risk_focus.strip()
        if not description:
            description = f"Inspect {module.get('name') or module.get('module_id') or 'current module'}"

        module_lines = [
            "当前仅允许侦查单个模块，你是该模块的实际执行者，请严格收敛范围：",
            "- highest_level_directories: " + ", ".join(str(item) for item in paths[:20]) if paths else "- highest_level_directories: unknown",
            f"- description: {description}",
        ]
        if module_type:
            module_lines.append(f"- module_type: {module_type}")
        target_files = module.get("target_files") or []
        if isinstance(target_files, list) and target_files:
            preview = ", ".join(str(item) for item in target_files[:40])
            module_lines.append(f"- module_target_files({len(target_files)}): {preview}")
        entrypoints = module.get("entrypoints") or []
        if isinstance(entrypoints, list) and entrypoints:
            module_lines.append("- entrypoints: " + ", ".join(str(item) for item in entrypoints[:20]))
        if isinstance(risk_focus, list) and risk_focus:
            module_lines.append("- module_risk_focus: " + ", ".join(str(item) for item in risk_focus[:16]))
        elif isinstance(risk_focus, str) and risk_focus.strip():
            module_lines.append(f"- module_risk_focus: {risk_focus.strip()}")
        language_hints = module.get("language_hints") or []
        if isinstance(language_hints, list) and language_hints:
            module_lines.append("- module_language_hints: " + ", ".join(str(item) for item in language_hints[:12]))
        framework_hints = module.get("framework_hints") or []
        if isinstance(framework_hints, list) and framework_hints:
            module_lines.append("- module_framework_hints: " + ", ".join(str(item) for item in framework_hints[:12]))

        if isinstance(project_model, dict):
            languages = project_model.get("languages") or []
            if isinstance(languages, list) and languages:
                module_lines.append("- project_languages: " + ", ".join(str(item) for item in languages[:8]))
            frameworks = project_model.get("frameworks") or []
            if isinstance(frameworks, list) and frameworks:
                module_lines.append("- project_frameworks: " + ", ".join(str(item) for item in frameworks[:8]))
            global_risk_themes = project_model.get("global_risk_themes") or []
            if isinstance(global_risk_themes, list) and global_risk_themes:
                module_lines.append("- project_global_risk_themes: " + ", ".join(str(item) for item in global_risk_themes[:12]))

        module_lines.extend(
            [
                "",
                "执行要求：",
                "- 第一轮必须先对最高层目录执行 list_files，建立模块地图后再展开 search_code",
                "- 至少围绕不同风险族群进行多轮 search_code，再做上下文确认，不要只验证单一点后立刻结束",
                "- 优先覆盖：入口点、外部输入、边界转换、危险 sink、共享安全组件、配置/插件/动态执行路径",
                "- 按 source -> validation/normalization -> trust_boundary -> sink 组织搜索与确认",
                "- 一旦确认单个风险点，立即调用 `push_risk_point_to_queue`；若同一轮确认多个风险点，优先调用 `push_risk_points_to_queue`",
                "- 不要把入队推迟到 Final Answer；Final Answer 只负责汇总已推送结果和未推送原因",
                "- 只有在目录结构、关键入口点、主要高风险族群和关键代码上下文都覆盖后，才能结束当前模块侦查",
                "- 模块外路径只允许作为依赖线索记录，不允许无限扩散扫描",
                "- 输出要偏结构化风险点和证据，不要写项目总览",
            ]
        )
        return "\n".join(line for line in ([task_context] + module_lines) if line)

    def _build_initial_message(
        self,
        *,
        project_info: Dict[str, Any],
        config: Dict[str, Any],
        task: str,
        task_context: str,
        module: Dict[str, Any] | None,
        project_model: Dict[str, Any] | None,
    ) -> str:
        target_files = module.get("target_files") if isinstance(module, dict) else []
        if not isinstance(target_files, list):
            target_files = []
        module_paths = []
        if isinstance(module, dict):
            raw_paths = module.get("module_root_paths") or module.get("paths") or []
            if isinstance(raw_paths, list):
                module_paths = [self._normalize_path(item) for item in raw_paths if str(item or "").strip()]

        initial_message = f"""请开始对单个模块进行完整侦查。

## 项目基本信息
- 名称: {project_info.get('name', 'unknown')}
- 根目录: {project_info.get('root', '.')}
- 文件数量: {project_info.get('file_count', 'unknown')}

## 当前任务
{task_context or task or '围绕单个模块执行深度 Recon，找出值得后续 Analysis 深挖的风险点。'}

## 模块执行原则
- 当前只允许侦查这个模块，不做项目建模和模块划分。
- 先扫描模块最高层目录，再逐步深入入口点、关键文件和高风险代码路径。
- 本次侦查目标不是“尽快结束”，而是“尽量完整地把当前模块看清楚”。
- 若尚未覆盖目录结构、关键入口点或不同风险族群，不要输出 Final Answer。

## 模块最高层目录
- directories: {', '.join(module_paths[:20]) if module_paths else 'unknown'}
- target_file_count: {len(target_files)}

"""

        markdown_memory = config.get("markdown_memory") if isinstance(config, dict) else None
        if isinstance(markdown_memory, dict):
            shared_mem = str(markdown_memory.get("shared") or "").strip()
            agent_mem = str(markdown_memory.get("recon") or "").strip()
            skills_mem = str(markdown_memory.get("skills") or "").strip()
            if shared_mem or agent_mem or skills_mem:
                initial_message += f"""## 项目长期记忆（Markdown，无 RAG）
### shared.md（节选）
{shared_mem or '(空)'}

### recon.md（节选）
{agent_mem or '(空)'}

### skills.md（规范摘要）
{skills_mem or '(空)'}

"""

        if target_files:
            initial_message += f"""## 模块目标文件
当前模块包含 {len(target_files)} 个已知目标文件，必须优先覆盖高价值入口点和关键代码上下文：
"""
            for file_path in target_files[:20]:
                initial_message += f"- {file_path}\n"
            if len(target_files) > 20:
                initial_message += f"- ... 还有 {len(target_files) - 20} 个文件\n"
            initial_message += "\n"

        initial_message += self._build_module_context_lines(
            module=module,
            project_model=project_model,
            task_context="",
        )

        initial_message += f"""

## 可用工具
{self.get_tools_description()}

## 完成标准
- 至少完成：最高层目录扫描、多轮 search_code、关键代码上下文读取、已确认风险点入队/说明未推送原因。
- Final Answer 仅总结当前模块结果，不输出项目总览。
- 如果已经确认风险点但还没入队，不能结束。

## 🎯 开始模块侦查！

请立即进入当前模块的侦查工作。不要只输出 Thought，必须紧接着输出 Action。
"""
        return initial_message

    def _collect_action_stats(self) -> Dict[str, Any]:
        list_dirs: List[str] = []
        search_dirs: List[str] = []
        search_count = 0
        context_count = 0
        push_count = 0
        for step in self._steps:
            action = str(step.action or "").strip()
            action_input = step.action_input or {}
            if action == "list_files":
                directory = self._normalize_path(action_input.get("directory") or ".")
                if directory not in list_dirs:
                    list_dirs.append(directory)
            elif action == "search_code":
                search_count += 1
                directory = self._normalize_path(action_input.get("directory") or ".")
                if directory not in search_dirs:
                    search_dirs.append(directory)
            elif action in self._CODE_CONTEXT_ACTIONS:
                context_count += 1
            elif action in {"push_risk_point_to_queue", "push_risk_points_to_queue"}:
                push_count += 1
        return {
            "list_dirs": list_dirs,
            "search_dirs": search_dirs,
            "search_count": search_count,
            "context_count": context_count,
            "push_count": push_count,
        }

    @staticmethod
    def _required_file_reads(target_file_count: int) -> int:
        if target_file_count >= 120:
            return 5
        if target_file_count >= 40:
            return 4
        if target_file_count >= 12:
            return 3
        if target_file_count >= 4:
            return 2
        return 1

    @staticmethod
    def _required_search_rounds(target_file_count: int, risk_focus_count: int) -> int:
        if target_file_count >= 80 or risk_focus_count >= 4:
            return 3
        if target_file_count >= 10 or risk_focus_count >= 2:
            return 2
        return 1

    def _has_recon_queue_tools(self) -> bool:
        return "push_risk_point_to_queue" in self.tools or "push_risk_points_to_queue" in self.tools

    def _validate_completion_gate(
        self,
        *,
        module: Dict[str, Any] | None,
        final_result: Dict[str, Any],
    ) -> Tuple[bool, List[str]]:
        if not isinstance(module, dict):
            return True, []

        stats = self._collect_action_stats()
        target_files = module.get("target_files") or []
        if not isinstance(target_files, list):
            target_files = []
        risk_focus = module.get("risk_focus") or []
        if not isinstance(risk_focus, list):
            risk_focus = [risk_focus] if str(risk_focus or "").strip() else []
        module_roots = module.get("module_root_paths") or module.get("paths") or []
        if not isinstance(module_roots, list) or not module_roots:
            module_roots = ["."]
        module_roots = [self._normalize_path(item) for item in module_roots if str(item or "").strip()] or ["."]
        entrypoints = module.get("entrypoints") or []
        if not isinstance(entrypoints, list):
            entrypoints = []
        entrypoints = [self._normalize_path(item) for item in entrypoints if str(item or "").strip()]

        files_read = {
            self._normalize_path(item)
            for item in self._coverage_files_read
            if str(item or "").strip()
        }
        risk_points = final_result.get("risk_points") or []
        if not isinstance(risk_points, list):
            risk_points = []

        missing: List[str] = []
        listed_roots = set(stats["list_dirs"])
        for root in module_roots:
            if root not in listed_roots:
                missing.append(f"尚未对模块最高层目录 `{root}` 执行 list_files 建立完整地图")

        required_search_rounds = self._required_search_rounds(len(target_files), len(risk_focus))
        if stats["search_count"] < required_search_rounds:
            missing.append(f"search_code 轮次不足，至少还需完成 {required_search_rounds} 轮不同线索搜索")

        required_reads = self._required_file_reads(len(target_files))
        if len(files_read) < required_reads:
            missing.append(f"关键代码上下文读取不足，至少还需确认 {required_reads} 个文件的代码证据")

        if stats["context_count"] < required_reads:
            missing.append("上下文确认不足，需要继续使用 get_code_window/get_file_outline/get_symbol_body 等工具确认关键路径")

        if entrypoints and not any(entrypoint in files_read for entrypoint in entrypoints):
            missing.append("至少需要确认 1 个模块入口点或关键入口文件的代码上下文")

        if risk_points and self._has_recon_queue_tools() and len(self._risk_points_pushed) < 1:
            missing.append("已确认风险点，但尚未执行 Recon 风险点入队")

        if not risk_points and stats["search_count"] < max(2, required_search_rounds):
            missing.append("当前仍缺少足够的无风险结论证据，需要再扩展至少一轮不同方向的搜索")

        return len(missing) == 0, missing

    def _build_continue_prompt(self, missing_items: List[str], module: Dict[str, Any] | None) -> str:
        module_roots = []
        if isinstance(module, dict):
            roots = module.get("module_root_paths") or module.get("paths") or []
            if isinstance(roots, list):
                module_roots = [self._normalize_path(item) for item in roots if str(item or "").strip()]
        checklist = "\n".join(f"- {item}" for item in missing_items[:8])
        return (
            "当前模块侦查尚未完成，暂不接受 Final Answer。\n"
            f"模块最高层目录: {', '.join(module_roots[:20]) if module_roots else 'unknown'}\n"
            "仍缺少以下覆盖：\n"
            f"{checklist}\n\n"
            "请继续在当前模块范围内执行 Action，不要结束。优先顺序：\n"
            "1. 对未完成覆盖的最高层目录执行 list_files；\n"
            "2. 使用 search_code 扩展不同风险族群或不同入口点；\n"
            "3. 用 get_code_window/get_file_outline/get_symbol_body/locate_enclosing_function 确认更多关键路径；\n"
            "4. 若确认新的风险点，先调用 push_risk_point_to_queue 或 push_risk_points_to_queue；\n"
            "5. 覆盖缺口补齐后，才能再次输出 Final Answer。"
        )

    def _build_summary_prompt(self) -> str:
        return """当前模块侦查阶段即将结束。请立即输出 Final Answer，总结你已经确认的模块结果。

请按以下 JSON 格式输出：
```json
{
  "risk_points": [{"file_path": "...", "line_start": 1, "description": "...", "vulnerability_type": "..."}],
  "risk_points_pushed": 0,
  "input_surfaces": ["..."],
  "trust_boundaries": ["..."],
  "target_files": ["..."],
  "high_risk_areas": ["..."],
  "coverage_summary": {"files_read_count": 0, "directories_scanned_count": 0},
  "summary": "模块侦查总结"
}
```

Final Answer:"""

    async def run(self, input_data: Dict[str, Any]):
        import copy

        start_time = time.time()
        input_data, module, project_model = self._prepare_module_scope(input_data)
        config = input_data.get("config", {}) if isinstance(input_data.get("config"), dict) else {}
        project_info = input_data.get("project_info", {}) if isinstance(input_data.get("project_info"), dict) else {}
        task = input_data.get("task", "")
        task_context = str(input_data.get("task_context") or "").strip()
        task_context = self._build_module_context_lines(
            module=module,
            project_model=project_model,
            task_context=task_context,
        )
        input_data = dict(input_data)
        input_data["task_context"] = task_context

        target_files = []
        if isinstance(module, dict):
            raw_target_files = module.get("target_files") or []
            if isinstance(raw_target_files, list):
                target_files = [str(item) for item in raw_target_files if str(item or "").strip()]
        self._empty_retry_count = 0
        targeted_empty_recovery_used = False
        self._risk_points_pushed = []
        self._risk_point_identities = set()
        self._observed_input_surfaces = []
        self._observed_trust_boundaries = []
        self._observed_target_files = []
        self._coverage_directories = []
        self._coverage_files_discovered = []
        self._coverage_files_read = []
        self._latest_tool_module_results = []
        self._latest_tool_project_model = {}
        self._failed_tool_calls = {}

        for target_file in target_files:
            self._remember_target_file(target_file)
            self._remember_discovered_file(target_file)

        if isinstance(module, dict):
            module_paths = module.get("module_root_paths") or module.get("paths") or []
            if isinstance(module_paths, list):
                for item in module_paths[:20]:
                    self._remember_search_directory(item)
            for item in target_files[:80]:
                self._remember_reason_path(item)
            entrypoints = module.get("entrypoints") or []
            if isinstance(entrypoints, list):
                for item in entrypoints[:20]:
                    self._remember_reason_path(item)

        seeded_context = str(task_context or "").strip()
        if seeded_context:
            self._recent_thought_texts.append(seeded_context)

        initial_message = self._build_initial_message(
            project_info=project_info,
            config=config,
            task=task,
            task_context=task_context,
            module=module,
            project_model=project_model,
        )

        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        self._steps = []
        final_result = None
        error_message = None
        last_action_signature = None
        repeated_action_streak = 0
        llm_timeout_streak = 0
        no_action_streak = 0

        await self.emit_thinking("ReconSubAgent 启动，开始对当前模块进行完整侦查...")

        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break

                self._iteration = iteration + 1
                if self.is_cancelled:
                    await self.emit_thinking("🛑 任务已取消，停止执行")
                    break

                try:
                    llm_output, tokens_this_round = await self.stream_llm_call(
                        self._conversation_history,
                    )
                except asyncio.CancelledError:
                    logger.info("[%s] LLM call cancelled", self.name)
                    break

                self._total_tokens += tokens_this_round
                timeout_like_output = str(llm_output or "").strip().startswith("[超时错误:")
                if timeout_like_output:
                    llm_timeout_streak += 1
                else:
                    llm_timeout_streak = 0

                if llm_timeout_streak >= 3:
                    await self.emit_event(
                        "warning",
                        "LLM 连续超时，进入降级收敛并输出当前已收集结果",
                        metadata={"timeout_streak": llm_timeout_streak},
                    )
                    final_result = self._summarize_from_steps()
                    break

                if not llm_output or not llm_output.strip():
                    empty_retry_count = getattr(self, "_empty_retry_count", 0) + 1
                    self._empty_retry_count = empty_retry_count
                    stream_meta = getattr(self, "_last_llm_stream_meta", {}) or {}
                    empty_reason = str(stream_meta.get("empty_reason") or "").strip()
                    finish_reason = stream_meta.get("finish_reason")
                    chunk_count = int(stream_meta.get("chunk_count") or 0)
                    empty_from_stream = empty_reason in {"empty_response", "empty_stream", "empty_done"}
                    conversation_tokens_estimate = self._estimate_conversation_tokens(self._conversation_history)

                    logger.warning(
                        "[%s] Empty LLM response in iteration %s (retry %s/3, tokens_this_round=%s, finish_reason=%s, empty_reason=%s, chunk_count=%s)",
                        self.name,
                        self._iteration,
                        empty_retry_count,
                        tokens_this_round,
                        finish_reason,
                        empty_reason,
                        chunk_count,
                    )

                    if empty_from_stream and targeted_empty_recovery_used:
                        error_message = "连续收到空响应，使用回退结果"
                        await self.emit_event(
                            "warning",
                            error_message,
                            metadata={
                                "empty_retry_count": empty_retry_count,
                                "last_finish_reason": finish_reason,
                                "chunk_count": chunk_count,
                                "empty_reason": empty_reason,
                                "conversation_tokens_estimate": conversation_tokens_estimate,
                            },
                        )
                        break

                    if empty_retry_count >= 3:
                        logger.error("[%s] Too many empty responses, generating fallback result", self.name)
                        error_message = "连续收到空响应，使用回退结果"
                        await self.emit_event(
                            "warning",
                            error_message,
                            metadata={
                                "empty_retry_count": empty_retry_count,
                                "last_finish_reason": finish_reason,
                                "chunk_count": chunk_count,
                                "empty_reason": empty_reason,
                                "conversation_tokens_estimate": conversation_tokens_estimate,
                            },
                        )
                        break

                    if empty_from_stream:
                        targeted_empty_recovery_used = True
                        retry_prompt = (
                            "上一轮模型返回了空响应（无有效文本）。请不要空输出，必须二选一立即返回：\n"
                            "1) 输出可执行 Action（含 Action Input）继续推进；\n"
                            "2) 若当前模块证据已充分，直接输出 Final Answer（JSON）。\n"
                            "禁止仅输出空白或无结构文本。"
                        )
                    else:
                        retry_prompt = f"""收到空响应。请根据以下格式继续推进当前模块侦查：

必须优先围绕当前模块继续输出结构化结果：
Thought: [你对当前模块覆盖情况的分析]
Action: [工具名称]
Action Input: {{}}

可用工具: {', '.join(self.tools.keys())}

只有当模块覆盖充分时，才能输出：
Thought: [总结模块侦查结果]
Final Answer: [JSON格式的结果]"""

                    self._conversation_history.append({
                        "role": "user",
                        "content": retry_prompt,
                    })
                    continue

                self._empty_retry_count = 0
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)

                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)

                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })

                if step.is_final:
                    no_action_streak = 0
                    proposed_result = step.final_answer if isinstance(step.final_answer, dict) else self._summarize_from_steps()
                    proposed_result = self._apply_subagent_runtime_payload(copy.deepcopy(proposed_result))
                    proposed_result = self._apply_runtime_recon_state(proposed_result)
                    proposed_result = self._ensure_project_profile(proposed_result)
                    ready, missing_items = self._validate_completion_gate(
                        module=module,
                        final_result=proposed_result,
                    )
                    if ready:
                        await self.emit_llm_decision("完成信息收集", "ReconSubAgent 判断当前模块已完成足够覆盖")
                        await self.emit_llm_complete(
                            f"信息收集完成，共 {self._iteration} 轮思考",
                            self._total_tokens,
                        )
                        final_result = proposed_result
                        break

                    await self.emit_llm_decision("继续侦查", "当前模块覆盖尚未完成，需要继续深入")
                    self._conversation_history.append({
                        "role": "user",
                        "content": self._build_continue_prompt(missing_items, module),
                    })
                    continue

                if step.action:
                    no_action_streak = 0
                    await self.emit_llm_action(step.action, step.action_input or {})

                    action_signature = (
                        f"{step.action}:{dump_json_safe(step.action_input or {}, ensure_ascii=False, sort_keys=True)}"
                    )
                    if action_signature == last_action_signature:
                        repeated_action_streak += 1
                    else:
                        repeated_action_streak = 1
                        last_action_signature = action_signature

                    if repeated_action_streak >= 3:
                        observation = (
                            "检测到连续重复工具调用，已自动跳过本次执行以避免无效消耗。"
                            "请更换参数、切换工具或继续扩大当前模块覆盖。"
                        )
                        step.observation = observation
                        await self.emit_llm_observation(observation)
                        self._conversation_history.append({
                            "role": "user",
                            "content": f"Observation:\n{self._prepare_observation_for_history(observation)}",
                        })
                        continue

                    tool_call_key = f"{step.action}:{dump_json_safe(step.action_input or {}, sort_keys=True)}"
                    observation = await self.execute_tool(
                        step.action,
                        step.action_input or {},
                    )

                    is_tool_error = (
                        "失败" in observation
                        or "错误" in observation
                        or "不存在" in observation
                        or "文件过大" in observation
                        or "Error" in observation
                    )
                    if is_tool_error:
                        self._failed_tool_calls[tool_call_key] = self._failed_tool_calls.get(tool_call_key, 0) + 1
                        fail_count = self._failed_tool_calls[tool_call_key]
                        if fail_count >= 3:
                            logger.warning("[%s] Tool call failed %s times: %s", self.name, fail_count, tool_call_key)
                            observation += "\n\n**系统提示**: 此工具调用已连续失败 3 次。请更换参数、改用其他定位工具，或先覆盖当前模块中的其他关键路径。"
                            self._failed_tool_calls[tool_call_key] = 0
                    else:
                        if tool_call_key in self._failed_tool_calls:
                            del self._failed_tool_calls[tool_call_key]
                        await self._update_coverage_from_last_tool(step.action, step.action_input or {})
                        self._track_live_push_action(step.action, step.action_input or {}, observation)

                    if self.is_cancelled:
                        logger.info("[%s] Cancelled after tool execution", self.name)
                        break

                    step.observation = observation
                    await self.emit_llm_observation(observation)
                    history_observation = self._prepare_observation_for_history(observation)
                    self._conversation_history.append({
                        "role": "user",
                        "content": f"Observation:\n{history_observation}",
                    })
                else:
                    no_action_streak += 1
                    repeated_action_streak = 0
                    last_action_signature = None
                    await self.emit_llm_decision("继续思考", "ReconSubAgent 需要更多模块证据")
                    if no_action_streak >= 5:
                        await self.emit_event(
                            "warning",
                            "连续多轮未给出有效 Action，进入降级收敛并输出当前结果",
                            metadata={"no_action_streak": no_action_streak},
                        )
                        final_result = self._summarize_from_steps()
                        break
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续围绕当前模块执行侦查。你输出了 Thought 但没有输出 Action。请立即选择一个工具执行，只有在模块覆盖充分后才能输出 Final Answer。",
                    })

            if not final_result and not self.is_cancelled and not error_message:
                await self.emit_thinking("当前模块侦查阶段结束，正在生成模块总结...")
                self._conversation_history.append({
                    "role": "user",
                    "content": self._build_summary_prompt(),
                })
                try:
                    summary_output, _ = await self.stream_llm_call(
                        self._conversation_history,
                    )
                    if summary_output and summary_output.strip():
                        summary_text = summary_output.strip()
                        summary_text = re.sub(r"```json\s*", "", summary_text)
                        summary_text = re.sub(r"```\s*", "", summary_text)
                        final_result = AgentJsonParser.parse(
                            summary_text,
                            default=self._summarize_from_steps(),
                        )
                except Exception as exc:
                    logger.warning("[%s] Failed to generate module summary: %s", self.name, exc)

            duration_ms = int((time.time() - start_time) * 1000)
            if self.is_cancelled:
                await self.emit_event(
                    "info",
                    f"🛑 ReconSubAgent 已取消: {self._iteration} 轮迭代",
                )
                return AgentResult(
                    success=False,
                    error="任务已取消",
                    data=self._summarize_from_steps(),
                    iterations=self._iteration,
                    tool_calls=self._tool_calls,
                    tokens_used=self._total_tokens,
                    duration_ms=duration_ms,
                )

            if error_message:
                await self.emit_event(
                    "error",
                    f"ReconSubAgent 失败: {error_message}",
                )
                return AgentResult(
                    success=False,
                    error=error_message,
                    data=self._summarize_from_steps(),
                    iterations=self._iteration,
                    tool_calls=self._tool_calls,
                    tokens_used=self._total_tokens,
                    duration_ms=duration_ms,
                )

            if not final_result:
                final_result = self._summarize_from_steps()
            if isinstance(final_result, dict):
                final_result = self._apply_subagent_runtime_payload(final_result)
                final_result = self._apply_runtime_recon_state(final_result)
                final_result = self._ensure_project_profile(final_result)
                await self._sync_or_capture_recon_queue(
                    final_result,
                    in_module_worker_mode=True,
                )
                if isinstance(module, dict):
                    final_result.setdefault("module_id", module.get("module_id"))
                    final_result.setdefault("module_name", module.get("name"))
                    final_result.setdefault("module_type", module.get("module_type"))
                    final_result.setdefault("module_root_paths", module.get("module_root_paths") or module.get("paths") or [])

            coverage_summary = final_result.get("coverage_summary") if isinstance(final_result, dict) else {}
            if not isinstance(coverage_summary, dict):
                coverage_summary = {}
            self.record_work(f"完成模块侦查，当前读取文件 {len(coverage_summary.get('files_read', []))} 个")
            if final_result.get("high_risk_areas"):
                self.add_insight(f"当前模块发现 {len(final_result['high_risk_areas'])} 个高风险区域")
            if final_result.get("risk_points"):
                self.add_insight(f"当前模块确认 {len(final_result['risk_points'])} 个风险点")

            await self.emit_event(
                "info",
                f"ReconSubAgent 完成: {self._iteration} 轮迭代, {self._tool_calls} 次工具调用",
            )
            handoff = self._create_recon_handoff(final_result)
            return AgentResult(
                success=True,
                data=final_result,
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
                handoff=handoff,
            )
        except Exception as exc:
            logger.error("ReconSubAgent failed: %s", exc, exc_info=True)
            return AgentResult(success=False, error=str(exc))
