from __future__ import annotations

from typing import Any, Dict

from .recon import ReconAgent


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
Observation: {"message":"风险点已入队，当前队列大小 3","queue_size":3,"enqueue_status":"enqueued","duplicate_skipped":false}
Thought: 该风险点已成功入队，可以继续检查当前函数是否还有其他 sink，或在证据充分时输出包含 `risk_points_pushed` 的 Final Answer。
Final Answer: {"risk_points":[{"file_path":"src/auth/login.py","line_start":84,"description":"SQL injection candidate: user-controlled username is concatenated into a SQL query before execution.","severity":"high","vulnerability_type":"sql_injection","confidence":0.91,"entry_function":"login","input_surface":"request.form.username","trust_boundary":"HTTP request -> auth handler -> SQL query","source":"request.form.username","sink":"cursor.execute(sql)","target_files":["src/auth/login.py"]}],"risk_points_pushed":1,"input_surfaces":["request.form.username"],"trust_boundaries":["HTTP request -> auth handler -> SQL query"],"target_files":["src/auth/login.py"],"coverage_summary":{"files_read_count":1,"directories_scanned_count":1},"summary":"模块内已确认并推送 1 个 SQL 注入候选点。"}

## 角色边界
- 你不负责项目建模、模块划分和调度。
"""


class ReconSubAgent(ReconAgent):
    """Module-scoped Recon worker used by the workflow Recon fan-out runtime."""

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

    async def run(self, input_data: Dict[str, Any]):
        runtime_config = (
            dict(input_data.get("config", {}))
            if isinstance(input_data.get("config"), dict)
            else {}
        )
        module = runtime_config.get("recon_module")
        project_model = runtime_config.get("project_recon_model")

        if isinstance(module, dict):
            paths = module.get("paths") or []
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
                "- directories: " + ", ".join(str(item) for item in paths[:20]) if paths else "- directories: unknown",
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
                    "- 先做模块内 list_files，再做模块内 search_code，再做上下文确认",
                    "- 先判断当前模块更像 handler、worker、CLI、parser、plugin、native service 还是 shared library，再决定查询策略",
                    "- 不要假设当前模块一定是 Web/MVC；language/framework/module_type/risk_focus 只是收敛线索",
                    "- 按 source -> validation/normalization -> trust_boundary -> sink 组织搜索与确认",
                    "- 风险类型按适用项覆盖：injection、path/filesystem、deserialization/parser、authz、dynamic execution、network trust、secrets/config、memory safety",
                    "- 一旦确认单个风险点，立即调用 `push_risk_point_to_queue`；若同一轮确认多个风险点，优先调用 `push_risk_points_to_queue`",
                    "- 不要把入队推迟到 Final Answer；Final Answer 只负责汇总已推送结果和未推送原因",
                    "- 模块外路径只允许作为依赖线索记录，不允许无限扩散扫描",
                    "- 输出要偏结构化风险点和证据，不要写项目总览",
                ]
            )
            task_context = str(input_data.get("task_context") or "").strip()
            input_data = dict(input_data)
            input_data["task_context"] = "\n".join(
                line for line in ([task_context] + module_lines) if line
            )

            seeded_context = str(input_data.get("task_context") or "").strip()
            if seeded_context:
                self._recent_thought_texts.append(seeded_context)

            if isinstance(paths, list):
                for item in paths[:20]:
                    self._remember_search_directory(item)
            if isinstance(target_files, list):
                for item in target_files[:40]:
                    self._remember_reason_path(item)
            if isinstance(entrypoints, list):
                for item in entrypoints[:20]:
                    self._remember_reason_path(item)

        result = await super().run(input_data)
        if result.success and isinstance(result.data, dict) and isinstance(module, dict):
            result.data.setdefault("module_id", module.get("module_id"))
            result.data.setdefault("module_name", module.get("name"))
            result.data.setdefault("module_type", module.get("module_type"))
        return result
