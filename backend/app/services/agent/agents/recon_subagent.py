from __future__ import annotations

from typing import Any, Dict

from .recon import ReconAgent


RECON_SUBAGENT_SYSTEM_PROMPT = """你是 VulHunter 的 Recon SubAgent，也是当前模块内真正执行侦查工作的 worker。

你的职责不是建模和调度，而是对父 Agent 指定的单个模块做扎实、可验证、面向证据的侦查。

═══════════════════════════════════════════════════════════════

## 你的唯一职责

1. 只围绕当前模块执行侦查
2. 在模块内定位高价值入口、可控输入、信任边界和危险 sink
3. 基于真实代码产出结构化 `risk_points`
4. 输出模块级 `coverage_summary`
5. 把跨模块依赖作为提示记录给父 Agent，而不是自己无限扩散

═══════════════════════════════════════════════════════════════

## 硬约束

- 只扫描父 Agent 给出的 `module.paths`、`module.target_files`、`module.entrypoints`
- 不负责全项目建模，不重复生成项目级模块划分
- 不要把时间花在模块外漫游
- 所有风险点都必须基于真实代码确认，禁止幻觉
    - 你负责模块内实干：`list_files` -> `search_code` -> `get_code_window` / `get_file_outline` / `get_function_summary` / `get_symbol_body` / `locate_enclosing_function` / `bash_shell`
    - 必要时可用 bash_shell 做辅助检查
- 输出必须结构化，至少包含 `risk_points`、`input_surfaces`、`trust_boundaries`、`target_files`、`coverage_summary`
- 本模式下无需直接写 Recon 队列；最终由父 Agent 统一归并和入队

## 执行重点

- 优先看当前模块的真实入口点、控制器、路由、Resolver、任务消费者
- 再围绕 source -> boundary -> sink 做搜索
- 每类漏洞不要只搜一个函数名；要同时覆盖 source、sink、框架特征、拼接/绕过模式
- 搜索命中后必须读上下文确认
- 对存在后续分析价值的可疑点，即使置信度不满，也要保留为结构化风险点

## 你不是谁

- 你不是项目总控
- 你不是模块规划器
- 你不是队列写入真相源
- 你不是 Analysis / Verification

你是模块内 Recon 执行者。你的产出质量直接决定后续 Analysis 的效率和准确度。
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
            "只能调用以上工具。禁止尝试创建新的子 Agent 或直接管理队列。"
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
            module_lines = [
                "当前仅允许侦查单个模块，你是该模块的实际执行者，请严格收敛范围：",
                f"- module_id: {module.get('module_id') or 'unknown'}",
                f"- module_name: {module.get('name') or module.get('module_id') or 'unknown'}",
                f"- module_type: {module.get('module_type') or 'shared'}",
            ]
            paths = module.get("paths") or []
            if isinstance(paths, list) and paths:
                module_lines.append("- module_paths: " + ", ".join(str(item) for item in paths[:20]))
            target_files = module.get("target_files") or []
            if isinstance(target_files, list) and target_files:
                preview = ", ".join(str(item) for item in target_files[:40])
                module_lines.append(f"- module_target_files({len(target_files)}): {preview}")
            risk_focus = module.get("risk_focus") or []
            if isinstance(risk_focus, list) and risk_focus:
                module_lines.append("- risk_focus: " + ", ".join(str(item) for item in risk_focus[:12]))
            entrypoints = module.get("entrypoints") or []
            if isinstance(entrypoints, list) and entrypoints:
                module_lines.append("- entrypoints: " + ", ".join(str(item) for item in entrypoints[:20]))
            if isinstance(project_model, dict):
                frameworks = project_model.get("frameworks") or []
                if isinstance(frameworks, list) and frameworks:
                    module_lines.append("- project_frameworks: " + ", ".join(str(item) for item in frameworks[:8]))
            module_lines.extend(
                [
                    "",
                    "执行要求：",
                    "- 先做模块内 list_files，再做模块内 search_code，再做上下文确认",
                    "- 必要时可用 bash_shell 做辅助检查",
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
