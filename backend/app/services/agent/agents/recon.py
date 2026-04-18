"""
Recon Agent (信息收集层) - LLM 驱动版

LLM 是真正的大脑！
- LLM 决定收集什么信息
- LLM 决定使用哪个工具
- LLM 决定何时信息足够
- LLM 动态调整收集策略

类型: ReAct (真正的!)
"""

import asyncio
import ast
import json
import logging
import re
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass

from app.services.json_safe import dump_json_safe

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern, TaskHandoff
from .react_parser import parse_react_response
from ..json_parser import AgentJsonParser
from ..workflow.recon_models import (
    ProjectReconModel,
    ReconModuleResult,
    build_project_recon_model,
    merge_recon_module_results,
)

logger = logging.getLogger(__name__)

WEB_FRAMEWORK_HINTS = {
    "react", "vue", "angular", "express", "koa", "fastify", "hapi",
    "django", "flask", "fastapi", "spring", "laravel", "rails",
    "next", "next.js", "nestjs", "nest", "nuxt", "sveltekit",
    "remix", "hono", "adonisjs",
}
WEB_SIGNAL_HINTS = {
    "http", "https", "route", "router", "controller", "request",
    "response", "middleware", "template", "csrf", "session", "cookie",
    "rest", "graphql", "api", "webhook", "callback", "consumer",
    "subscriber", "queue", "job", "rpc", "grpc", "resolver",
    "guard", "interceptor", "req", "res", "ctx",
}
FRAMEWORK_OBSERVATION_HINTS = {
    "React": ("react",),
    "Next.js": ("next.config", "\"next\"", "'next'", "next/server", "nextrequest", "nextresponse", "pages/api/"),
    "NestJS": ("@nestjs", "nest-cli.json", "app.controller.ts", "app.module.ts"),
    "Vue": ("vue",),
    "Nuxt": ("nuxt", "nuxt.config"),
    "Angular": ("angular", "@angular/"),
    "Express": ("express",),
    "Koa": ("koa", "koa-router"),
    "Fastify": ("fastify",),
    "Hapi": ("@hapi", " hapi"),
    "Hono": ("hono",),
    "SvelteKit": ("@sveltejs/kit", "+server.ts", "+page.server.ts"),
    "Remix": ("@remix-run",),
    "Django": ("django",),
    "Flask": ("flask",),
    "FastAPI": ("fastapi",),
    "Spring": ("spring",),
    "Streamlit": ("streamlit",),
}
DATABASE_OBSERVATION_HINTS = {
    "MySQL": ("mysql", "mysql2", "pymysql"),
    "PostgreSQL": ("postgres", "postgresql", "asyncpg", '"pg"', "'pg'"),
    "MongoDB": ("mongodb", "mongoose", "pymongo"),
    "Redis": ("redis",),
    "SQLite": ("sqlite",),
}
SOURCE_FILE_PATTERN = re.compile(
    r'[\w./@\-\[\]+]+\.(?:py|js|jsx|mjs|cjs|ts|tsx|mts|cts|java|php|go|rb)\b'
)
WEB_VULNERABILITY_FOCUS_DEFAULT = [
    "sql_injection",
    "xss",
    "command_injection",
    "path_traversal",
    "ssrf",
    "csrf",
    "open_redirect",
    "ssti",
    "xxe",
    "deserialization",
]

RECON_SYSTEM_PROMPT = """你是 VulHunter 的 Recon Host Agent。

在当前结构化 workflow 中，你的身份首先是**功能模块规划者 / 目录级调度者**，不是文档阅读器，也不是全项目逐文件深挖执行者。

你的主职责不是亲自地毯式审每个模块，而是：
1. 建立项目地图
2. 识别**功能模块**边界与优先级
3. 为 Recon SubAgent 准备清晰、可执行、**目录级**的模块上下文
4. 汇总模块侦查结果，形成后续 Analysis 可消费的结构化产物

只有在没有可用的 Recon SubAgent / 模块化执行通道时，你才回退为亲自侦查并直接推送风险点。

常规 Recon 重点关注代码安全风险；IDOR、状态机绕过、金额篡改、权限提升等业务逻辑问题默认由 BusinessLogicReconAgent 负责，除非白名单中不存在对应业务逻辑工具/队列。

═══════════════════════════════════════════════════════════════

## Host 模式下你的首要职责

| 职责 | 说明 |
|------|------|
| **项目建模** | 先看根目录、关键目录、关键配置文件，建立语言/框架/入口/目录布局认知 |
| **模块拆分** | 把项目拆成适合并发侦查的**功能模块**，明确每个模块的 `directories` 和一段简短 `description` |
| **调度导向** | 你的输出要服务于 SubAgent 实干，而不是自己陷入长时间的模块内逐文件深挖 |
| **结果归并** | 汇总所有模块的 `risk_points`、`input_surfaces`、`trust_boundaries`、`target_files`、`coverage_summary` |
| **兜底侦查** | 如果没有模块化执行能力，才回退为亲自搜索、确认、入队风险点 |

═══════════════════════════════════════════════════════════════

## Host 模式下的硬约束

1. **先建模，再拆分，再下发** —— 第一优先级是项目地图和模块规划，不要一上来陷入某个模块的细节代码窗口。
2. **模块边界必须可执行** —— 每个模块至少要能回答：扫哪里，以及为什么扫。
3. **不要把自己当成唯一执行者** —— 在有 SubAgent 的前提下，避免自己承担所有模块的深度侦查。
4. **保留少量关键确认动作** —— Host 可以对项目根目录、关键配置、关键入口做必要确认，但不要把所有模块都亲自扫完。
5. **输出必须结构化** —— 最终必须显式记录 `input_surfaces`、`trust_boundaries`、`target_files`，并为下游 Analysis 保留约束范围。
6. **无子任务执行通道时允许回退** —— 若当前运行时没有 SubAgent 可用，你必须回退为直接侦查，并确保风险点可入队。
7. **只识别功能模块，不把噪音目录当模块** —— `docs/`、`examples/`、`demo/`、`samples/`、`fixtures/`、`mocks/`、`coverage/`、`dist/`、`build/`、`node_modules/`、纯测试数据目录默认不是功能模块，不要为它们单独规划 Recon SubAgent。
8. **SubAgent 必须拿到具体目录** —— `directories` 应优先是可执行的功能目录，例如 `src/auth`、`app/api`、`services/order`、`worker/jobs`，不要把整个项目根目录、`docs/`、或一堆零散说明文件直接交给 SubAgent。
9. **优先使用 `run_recon_subagent` 工具** —— Host 在完成项目建模后，应通过该工具进行模块执行（先 `action=plan` 再按需 `action=run`），不要仅停留在规划文本。

## Host 完成条件
## 侦查完成条件（关键）

1. 已建立可用项目地图
2. 已识别一组合理的**功能模块**边界和优先级
3. 已为每个模块给出明确的侦查焦点与**具体目录**
4. 已汇总模块结果，或在回退模式下直接产出风险点
5. 最终结果对 Analysis 可直接消费

## Host 的推荐工作顺序

1. `list_files` 看根目录
2. `list_files` 看关键目录
3. 读取技术栈/配置文件，建立项目画像
4. 优先标记真实运行时相关的功能模块：入口模块、业务高风险模块、跨切面模块、共享基础设施模块
5. 明确剔除文档、示例、测试样例、构建产物等无关目录，除非它们直接决定运行时入口
6. 为 `run_recon_subagent` 准备 `modules=[{directories, description}]`，其中 `directories` 优先给**具体目录**
7. 汇总模块结果；只有在缺少 SubAgent runtime 时，才亲自继续做 `search_code` + `get_code_window` 级侦查

## `run_recon_subagent` 调用格式

- `plan` 阶段只传：
  - `action`
  - `modules`，其中每项只包含 `directories` 和 `description`
- `run` 阶段只传：
  - `action`
  - 可选 `module_ids` / `max_modules` / `max_workers` / `force_rerun`
- 不要额外传 `priority`、`entrypoints`、`risk_focus`、`notes` 之外的自定义字段
- 推荐示例：
```json
{"action":"plan","modules":[{"directories":["src/auth"],"description":"Inspect authentication flows in src/auth"}]}
```
```json
{"action":"run","module_ids":["src_auth"],"max_workers":2}
```

## 回退模式要求

如果当前没有可用的模块化执行通道，你需要切换为传统 Recon：
- 使用 `list_files` -> `search_code` -> `get_code_window` / `get_file_outline`
- 基于真实代码确认风险点
- 直接调用 `push_risk_point_to_queue` / `push_risk_points_to_queue`
- 输出结构化 `risk_points`

## Host 禁止事项

- 不要把 `docs/`、纯 Markdown/RST 文档、设计说明、发布说明当作功能模块主线
- 不要为了“看起来覆盖全面”而给 SubAgent 派发 `docs`、`examples`、`tests` 这类非运行时目录
- 不要把整个仓库根目录直接当一个大模块下发，除非项目极小且没有可分解的功能目录
- 不要把“技术栈说明文档”误当成“运行时代码入口”

## 风险点原则

- 风险点是“值得下游深挖的可疑位置”，不是已验证漏洞
- 必须基于真实代码，不得幻觉
- 宁可低置信度标记，也不要漏掉高价值候选

## 风险点入队最小要求

- 风险点必须来自真实运行时代码，不来自纯文档说明
- 至少能关联到具体 `file_path`，优先关联到明确功能目录
- `confidence` 允许保守，但不能凭空捏造
- 若 Recon 队列仍为空，先检查是否把时间浪费在文档/示例目录，而不是功能模块

## 高风险区域与 TS 项目补充

- 高风险区域优先从真实入口、控制器、路由、worker、consumer、middleware、auth、payment、upload、callback 目录中识别
- TypeScript / Node 项目优先关注 `tsconfig.json`、`pages/api`、`app/api/**/route.ts`、`*.controller.ts`、`*.resolver.ts`
"""


@dataclass
class ReconStep:
    """信息收集步骤"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    is_final: bool = False
    final_answer: Optional[Dict] = None


class ReconAgent(BaseAgent):
    """
    信息收集 Agent - LLM 驱动版
    
    LLM 全程参与，自主决定：
    1. 收集什么信息
    2. 使用什么工具
    3. 何时足够
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        # 仅注入运行时白名单，避免提示词指导调用不存在工具
        tool_whitelist = ", ".join(sorted(tools.keys())) if tools else "无"
        full_system_prompt = (
            f"{RECON_SYSTEM_PROMPT}\n\n"
            f"## 当前工具白名单\n{tool_whitelist}\n"
            "只能调用以上工具，禁止调用未在白名单中的工具。\n\n"
            "## 最小调用规范\n"
            "每轮必须输出：Thought + Action + Action Input。\n"
            "Action 必须是白名单中的工具名，Action Input 必须是 JSON 对象。\n"
            "禁止使用 `## Action`/`## Action Input` 标题样式。"
        )
        
        config = AgentConfig(
            name="Recon",
            agent_type=AgentType.RECON,
            pattern=AgentPattern.REACT,
            max_iterations=1000,  #  增加迭代次数以支持全面侦查
            system_prompt=full_system_prompt,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[ReconStep] = []
        self._recon_queue_snapshot: Dict[str, Any] = {}
        self._risk_points_pushed: List[Dict[str, Any]] = []
        self._risk_point_identities: Set[Tuple[str, int, str, str, str, str, str, str, str]] = set()
        self._observed_input_surfaces: List[str] = []
        self._observed_trust_boundaries: List[str] = []
        self._observed_target_files: List[str] = []
        self._coverage_directories: List[str] = []
        self._coverage_files_discovered: List[str] = []
        self._coverage_files_read: List[str] = []
        self._latest_tool_module_results: List[Dict[str, Any]] = []
        self._latest_tool_project_model: Dict[str, Any] = {}
    
    def _parse_llm_response(self, response: str) -> ReconStep:
        """解析 LLM 响应（共享 ReAct 解析器）"""
        parsed = parse_react_response(
            response,
            final_default={"raw_answer": (response or "").strip()},
            action_input_raw_key="raw_input",
        )
        step = ReconStep(
            thought=parsed.thought or "",
            action=parsed.action,
            action_input=parsed.action_input or {},
            is_final=bool(parsed.is_final),
            final_answer=parsed.final_answer if isinstance(parsed.final_answer, dict) else None,
        )

        if step.is_final and isinstance(step.final_answer, dict) and "initial_findings" in step.final_answer:
            step.final_answer["initial_findings"] = [
                f for f in step.final_answer["initial_findings"]
                if isinstance(f, dict)
            ]
        return step

    @staticmethod
    def _normalize_string_list(value: Any, *, limit: int = 12) -> List[str]:
        if value in (None, "", [], {}):
            return []
        candidates = value if isinstance(value, list) else [value]
        normalized: List[str] = []
        for item in candidates:
            text = str(item or "").strip()
            if not text or text in normalized:
                continue
            normalized.append(text[:300])
            if len(normalized) >= limit:
                break
        return normalized

    @staticmethod
    def _safe_positive_int(value: Any) -> Optional[int]:
        try:
            parsed = int(value)
        except Exception:
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _normalize_risk_point_text(value: Any) -> str:
        return " ".join(str(value or "").strip().lower().split())

    def _risk_point_identity(self, point: Dict[str, Any]) -> Tuple[str, int, str, str, str, str, str, str, str]:
        return (
            str(point.get("file_path") or "").strip().lower(),
            int(point.get("line_start") or 1),
            str(point.get("vulnerability_type") or "potential_issue").strip().lower(),
            str(point.get("entry_function") or "").strip().lower(),
            str(point.get("source") or "").strip().lower(),
            str(point.get("sink") or "").strip().lower(),
            str(point.get("input_surface") or "").strip().lower(),
            str(point.get("trust_boundary") or "").strip().lower(),
            self._normalize_risk_point_text(point.get("description")),
        )

    def _remember_input_surface(self, value: Any) -> None:
        for item in self._normalize_string_list(value, limit=8):
            self._append_unique(self._observed_input_surfaces, item)

    def _remember_trust_boundary(self, value: Any) -> None:
        for item in self._normalize_string_list(value, limit=8):
            self._append_unique(self._observed_trust_boundaries, item)

    def _remember_target_file(self, value: Any) -> None:
        for item in self._normalize_string_list(value, limit=32):
            self._append_unique(self._observed_target_files, item)

    def _remember_coverage_directory(self, value: Any) -> None:
        raw = str(value or "").strip()
        if not raw:
            return
        normalized = raw.replace("\\", "/").strip() or "."
        self._append_unique(self._coverage_directories, normalized)

    def _remember_discovered_file(self, value: Any) -> None:
        raw = str(value or "").strip()
        if not raw:
            return
        normalized = raw.replace("\\", "/").strip()
        self._append_unique(self._coverage_files_discovered, normalized)
        self._remember_target_file(normalized)

    def _remember_read_file(self, value: Any) -> None:
        raw = str(value or "").strip()
        if not raw:
            return
        normalized = raw.replace("\\", "/").strip()
        self._append_unique(self._coverage_files_read, normalized)
        self._remember_target_file(normalized)

    def _normalize_risk_point(self, candidate: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(candidate, dict):
            return None
        file_path = str(candidate.get("file_path") or "").strip()
        if not file_path:
            return None
        line_start = self._safe_positive_int(candidate.get("line_start"))
        if line_start is None:
            line_start = self._safe_positive_int(candidate.get("line"))
        if line_start is None:
            line_start = 1
        line_end = self._safe_positive_int(candidate.get("line_end"))
        if line_end is not None and line_end < line_start:
            line_end = line_start
        description = str(candidate.get("description") or candidate.get("title") or "").strip()
        if not description:
            description = f"潜在风险点，来自 {file_path}:{line_start}"
        severity = str(candidate.get("severity") or "high").lower()
        if severity not in {"critical", "high", "medium", "low", "info"}:
            severity = "high"
        vuln_type = str(candidate.get("vulnerability_type") or candidate.get("type") or "potential_issue").lower()
        try:
            confidence = float(candidate.get("confidence") or 0.6)
        except Exception:
            confidence = 0.6
        normalized = {
            "file_path": file_path,
            "line_start": line_start,
            "description": description,
            "severity": severity,
            "vulnerability_type": vuln_type,
            "confidence": max(0.0, min(1.0, confidence)),
        }
        if line_end is not None:
            normalized["line_end"] = line_end

        for field in ("entry_function", "input_surface", "trust_boundary", "source", "sink", "context"):
            value = str(candidate.get(field) or "").strip()
            if value:
                normalized[field] = value[:500]

        related_symbols = self._normalize_string_list(candidate.get("related_symbols"), limit=12)
        if related_symbols:
            normalized["related_symbols"] = related_symbols

        evidence_refs = self._normalize_string_list(candidate.get("evidence_refs"), limit=12)
        if evidence_refs:
            normalized["evidence_refs"] = evidence_refs

        target_files = self._normalize_string_list(candidate.get("target_files"), limit=20)
        if target_files:
            normalized["target_files"] = target_files

        return normalized

    def _parse_risk_area(self, area: str) -> Optional[Dict[str, Any]]:
        text = str(area or "").strip()
        if not text:
            return None
        description = text
        file_path = ""
        line_start = 1
        if ":" in text:
            candidate, rest = text.split(":", 1)
            candidate = candidate.strip()
            if "." in candidate or "/" in candidate:
                file_path = candidate
                rest = rest.strip()
                parts = rest.split("-", 1)
                line_part = parts[0].strip().split()[0] if parts else ""
                if line_part.isdigit():
                    line_start = int(line_part)
                description = rest if rest else text
        if not file_path:
            return None
        vuln_type = self._infer_vulnerability_type(description)
        return {
            "file_path": file_path,
            "line_start": line_start,
            "description": description,
            "severity": "high",
            "vulnerability_type": vuln_type,
            "confidence": 0.6,
        }

    def _infer_vulnerability_type(self, text: str) -> str:
        lowered = text.lower()
        if any(keyword in lowered for keyword in ["sql", "query", "injection"]):
            return "sql_injection"
        if any(keyword in lowered for keyword in ["xss", "html", "innerhtml"]):
            return "xss"
        if any(keyword in lowered for keyword in ["command", "exec", "subprocess", "system"]):
            return "command_injection"
        if any(keyword in lowered for keyword in ["path", "traversal"]):
            return "path_traversal"
        if "ssrf" in lowered:
            return "ssrf"
        if "csrf" in lowered:
            return "csrf"
        if "redirect" in lowered:
            return "open_redirect"
        if any(keyword in lowered for keyword in ["template", "jinja", "ssti"]):
            return "ssti"
        if "xxe" in lowered or "xml" in lowered:
            return "xxe"
        if any(keyword in lowered for keyword in ["pickle", "deserialize", "yaml.load", "marshal"]):
            return "deserialization"
        if any(keyword in lowered for keyword in ["secret", "key", "token", "env"]):
            return "hardcoded_secret"
        return "potential_issue"

    def _extract_risk_points(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        points: List[Dict[str, Any]] = []
        seen: set[tuple[str, int, str]] = set()
        if isinstance(result.get("initial_findings"), list):
            for item in result.get("initial_findings", []):
                normalized = self._normalize_risk_point(item)
                if not normalized:
                    continue
                key = (normalized["file_path"], normalized["line_start"], normalized["description"])
                if key in seen:
                    continue
                seen.add(key)
                points.append(normalized)
        high_risk = result.get("high_risk_areas", [])
        if isinstance(high_risk, list):
            for area in high_risk:
                parsed = self._parse_risk_area(area)
                if not parsed:
                    continue
                key = (parsed["file_path"], parsed["line_start"], parsed["description"])
                if key in seen:
                    continue
                seen.add(key)
                points.append(parsed)
        return points

    def _ensure_risk_points(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        points = result.get("risk_points")
        if isinstance(points, list) and points:
            normalized_points: List[Dict[str, Any]] = []
            for item in points:
                normalized = self._normalize_risk_point(item)
                if normalized:
                    normalized_points.append(normalized)
            result["risk_points"] = normalized_points
            return normalized_points
        extracted = self._extract_risk_points(result)
        result["risk_points"] = extracted
        return extracted

    def _track_risk_point(self, candidate: Any) -> Optional[Dict[str, Any]]:
        normalized = self._normalize_risk_point(candidate)
        if not normalized:
            return None
        identity = self._risk_point_identity(normalized)
        if identity in self._risk_point_identities:
            return normalized
        self._risk_point_identities.add(identity)
        self._risk_points_pushed.append(normalized)
        self._remember_read_file(normalized.get("file_path"))
        self._remember_input_surface(normalized.get("input_surface"))
        self._remember_trust_boundary(normalized.get("trust_boundary"))
        for target_file in normalized.get("target_files", []) or []:
            self._remember_target_file(target_file)
        return normalized

    def _merge_risk_points(self, *sources: Any) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        seen: Set[Tuple[str, int, str, str, str, str, str, str, str]] = set()
        for source in sources:
            if not isinstance(source, list):
                continue
            for candidate in source:
                normalized = self._normalize_risk_point(candidate)
                if not normalized:
                    continue
                identity = self._risk_point_identity(normalized)
                if identity in seen:
                    continue
                seen.add(identity)
                merged.append(normalized)
        return merged

    def _build_coverage_summary(self) -> Dict[str, Any]:
        return {
            "directories_scanned": self._coverage_directories[:40],
            "files_discovered": self._coverage_files_discovered[:400],
            "files_read": self._coverage_files_read[:200],
            "directories_scanned_count": len(self._coverage_directories),
            "files_discovered_count": len(self._coverage_files_discovered),
            "files_read_count": len(self._coverage_files_read),
            "tracker_enabled": False,
            "tracker_built": False,
        }

    def _apply_runtime_recon_state(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(result, dict):
            return result

        extracted_points = self._ensure_risk_points(result)
        merged_points = self._merge_risk_points(self._risk_points_pushed, extracted_points)
        result["risk_points"] = merged_points
        result["risk_points_pushed"] = len(self._risk_points_pushed)
        high_risk_areas = self._normalize_string_list(result.get("high_risk_areas"), limit=64)
        for point in merged_points:
            file_path = str(point.get("file_path") or "").strip()
            if file_path and file_path not in high_risk_areas:
                high_risk_areas.append(file_path)
        result["high_risk_areas"] = high_risk_areas[:64]

        input_surfaces = self._normalize_string_list(result.get("input_surfaces"), limit=24)
        for item in self._observed_input_surfaces:
            if item not in input_surfaces:
                input_surfaces.append(item)
        for point in merged_points:
            self._remember_input_surface(point.get("input_surface"))
            value = str(point.get("input_surface") or "").strip()
            if value and value not in input_surfaces:
                input_surfaces.append(value)
        result["input_surfaces"] = input_surfaces[:24]

        trust_boundaries = self._normalize_string_list(result.get("trust_boundaries"), limit=24)
        for item in self._observed_trust_boundaries:
            if item not in trust_boundaries:
                trust_boundaries.append(item)
        for point in merged_points:
            self._remember_trust_boundary(point.get("trust_boundary"))
            value = str(point.get("trust_boundary") or "").strip()
            if value and value not in trust_boundaries:
                trust_boundaries.append(value)
        result["trust_boundaries"] = trust_boundaries[:24]

        target_files = self._normalize_string_list(result.get("target_files"), limit=64)
        for item in self._observed_target_files:
            if item not in target_files:
                target_files.append(item)
        for point in merged_points:
            for file_path in point.get("target_files", []) or []:
                if file_path not in target_files:
                    target_files.append(file_path)
        result["target_files"] = target_files[:64]
        result["coverage_summary"] = self._build_coverage_summary()
        return result

    async def _update_coverage_from_last_tool(self, action_name: str, action_input: Dict[str, Any]) -> None:
        context = getattr(self, "_last_successful_tool_context", None) or {}
        if str(context.get("tool_name") or "") != str(action_name or ""):
            return
        metadata = context.get("tool_metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        if action_name == "run_recon_subagent":
            module_results = metadata.get("module_results")
            if isinstance(module_results, list):
                self._latest_tool_module_results = [
                    item for item in module_results if isinstance(item, dict)
                ]
            project_model = metadata.get("project_model")
            if isinstance(project_model, dict):
                self._latest_tool_project_model = dict(project_model)

            for file_path in metadata.get("target_files", []) or []:
                self._remember_target_file(file_path)
                self._remember_read_file(file_path)
            for item in metadata.get("input_surfaces", []) or []:
                self._remember_input_surface(item)
            for item in metadata.get("trust_boundaries", []) or []:
                self._remember_trust_boundary(item)
            coverage = metadata.get("coverage_summary") or {}
            if isinstance(coverage, dict):
                for directory in coverage.get("directories_scanned", []) or []:
                    self._remember_coverage_directory(directory)
                for file_path in coverage.get("files_discovered", []) or []:
                    self._remember_discovered_file(file_path)
                for file_path in coverage.get("files_read", []) or []:
                    self._remember_read_file(file_path)
            return

        if action_name == "list_files":
            directory = metadata.get("directory") or action_input.get("directory") or "."
            self._remember_coverage_directory(directory)
            for file_path in metadata.get("files", []) or []:
                self._remember_discovered_file(file_path)
            return

        if action_name == "search_code":
            for directory in (
                metadata.get("effective_directory"),
                metadata.get("original_directory"),
                action_input.get("directory"),
            ):
                self._remember_coverage_directory(directory)
            return

        if action_name in {
            "get_code_window",
            "get_file_outline",
            "get_function_summary",
            "get_symbol_body",
            "locate_enclosing_function",
        }:
            file_path = metadata.get("file_path") or action_input.get("file_path") or action_input.get("path")
            self._remember_read_file(file_path)
            if file_path:
                if file_path not in self._coverage_files_discovered:
                    self._remember_discovered_file(file_path)

    def _track_live_push_action(self, action_name: str, action_input: Dict[str, Any], observation: Any) -> None:
        payload = self._parse_tool_output(observation)
        if action_name == "push_risk_point_to_queue":
            if isinstance(payload, dict) and payload.get("enqueue_status") in {"enqueued", "duplicate_skipped"}:
                self._track_risk_point(action_input)
            return
        if action_name == "push_risk_points_to_queue":
            if not isinstance(payload, dict):
                return
            candidates = action_input.get("risk_points") or []
            if not isinstance(candidates, list) or not candidates:
                return
            try:
                enqueued = max(0, int(payload.get("enqueued") or 0))
            except Exception:
                enqueued = 0
            try:
                duplicate_skipped = max(0, int(payload.get("duplicate_skipped") or 0))
            except Exception:
                duplicate_skipped = 0
            if enqueued + duplicate_skipped < len(candidates):
                return
            for candidate in candidates:
                self._track_risk_point(candidate)

    async def _push_risk_points_to_queue(self, risk_points: List[Dict[str, Any]]):
        if not risk_points:
            return
        if "push_risk_point_to_queue" not in self.tools and "push_risk_points_to_queue" not in self.tools:
            return
        pending_points = [
            point
            for point in self._merge_risk_points(risk_points)
            if self._risk_point_identity(point) not in self._risk_point_identities
        ]
        if not pending_points:
            return

        if len(pending_points) > 1 and "push_risk_points_to_queue" in self.tools:
            try:
                batch_observation = await self.execute_tool(
                    "push_risk_points_to_queue",
                    {"risk_points": pending_points},
                )
                payload = self._parse_tool_output(batch_observation)
                if isinstance(payload, dict):
                    try:
                        enqueued = max(0, int(payload.get("enqueued") or 0))
                    except Exception:
                        enqueued = 0
                    try:
                        duplicate_skipped = max(0, int(payload.get("duplicate_skipped") or 0))
                    except Exception:
                        duplicate_skipped = 0
                else:
                    enqueued = 0
                    duplicate_skipped = 0
                if enqueued + duplicate_skipped >= len(pending_points):
                    for point in pending_points:
                        self._track_risk_point(point)
                    return
            except Exception as exc:
                logger.warning("[Recon] Batch risk queue push failed, falling back to single push: %s", exc)

        for point in pending_points:
            tool_input = dict(point)
            try:
                observation = await self.execute_tool("push_risk_point_to_queue", tool_input)
                payload = self._parse_tool_output(observation)
                if isinstance(payload, dict) and payload.get("enqueue_status") in {"enqueued", "duplicate_skipped"}:
                    self._track_risk_point(point)
            except Exception as exc:
                logger.warning("[Recon] Risk queue push failed: %s", exc)

    async def _refresh_recon_queue_status(self):
        if "get_recon_risk_queue_status" not in self.tools:
            self._recon_queue_snapshot = {}
            return
        observation = await self.execute_tool("get_recon_risk_queue_status", {})
        parsed = self._parse_tool_output(observation)
        if isinstance(parsed, dict):
            self._recon_queue_snapshot = parsed
        else:
            self._recon_queue_snapshot = {"raw": observation}

    async def _sync_recon_queue(self, result: Dict[str, Any]):
        if not isinstance(result, dict):
            return
        result = self._apply_runtime_recon_state(result)
        risk_points = self._ensure_risk_points(result)
        await self._push_risk_points_to_queue(risk_points)
        await self._refresh_recon_queue_status()
        result["risk_points_pushed"] = len(self._risk_points_pushed)
        result["recon_queue_status"] = self._recon_queue_snapshot
    
    def _parse_tool_output(self, raw_output: Any) -> Any:
        if isinstance(raw_output, dict) or isinstance(raw_output, list):
            return raw_output
        if not isinstance(raw_output, str):
            return raw_output or {}
        trimmed = raw_output.strip()
        if not trimmed:
            return {}
        try:
            return json.loads(trimmed)
        except Exception:
            try:
                return ast.literal_eval(trimmed)
            except Exception:
                return {}

    @staticmethod
    def _normalize_module_results_payload(value: Any) -> List[Dict[str, Any]]:
        if not isinstance(value, list):
            return []
        normalized: List[Dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(dict(item))
                continue
            to_dict = getattr(item, "to_dict", None)
            if callable(to_dict):
                try:
                    payload = to_dict()
                except Exception:
                    payload = None
                if isinstance(payload, dict):
                    normalized.append(payload)
        return normalized

    def _merge_module_results_payload(self, *sources: Any) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        for source in sources:
            for item in self._normalize_module_results_payload(source):
                module_id = str(item.get("module_id") or item.get("module", "")).strip() or "__unknown__"
                if module_id in seen:
                    continue
                seen.add(module_id)
                merged.append(item)
        return merged

    def _apply_subagent_runtime_payload(self, final_result: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(final_result, dict):
            return final_result
        module_results = self._merge_module_results_payload(
            final_result.get("module_results"),
            self._latest_tool_module_results,
        )
        if module_results:
            final_result["module_results"] = module_results
            final_result["module_count"] = max(
                int(final_result.get("module_count") or 0),
                len(module_results),
            )
        if not isinstance(final_result.get("project_model"), dict) and self._latest_tool_project_model:
            final_result["project_model"] = dict(self._latest_tool_project_model)
        return final_result


    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行信息收集 - LLM 全程参与！
        """
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        task = input_data.get("task", "")
        task_context = input_data.get("task_context", "")
        
        #  获取目标文件列表
        target_files = config.get("target_files", [])
        exclude_patterns = config.get("exclude_patterns", [])
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
        for target_file in target_files if isinstance(target_files, list) else []:
            self._remember_target_file(target_file)
            self._remember_discovered_file(target_file)
        
        # 构建初始消息
        initial_message = f"""请开始收集项目信息。

## 项目基本信息
- 名称: {project_info.get('name', 'unknown')}
- 根目录: {project_info.get('root', '.')}
- 文件数量: {project_info.get('file_count', 'unknown')}

"""

        #  项目级 Markdown 长期记忆（无需 RAG/Embedding）
        markdown_memory = config.get("markdown_memory") if isinstance(config, dict) else None
        if isinstance(markdown_memory, dict):
            shared_mem = str(markdown_memory.get("shared") or "").strip()
            agent_mem = str(markdown_memory.get("recon") or "").strip()
            skills_mem = str(markdown_memory.get("skills") or "").strip()
            if shared_mem or agent_mem or skills_mem:
                initial_message += f"""## 项目长期记忆（Markdown，无 RAG）
### shared.md（节选）
{shared_mem or "(空)"}

### recon.md（节选）
{agent_mem or "(空)"}

### skills.md（规范摘要）
{skills_mem or "(空)"}

"""

        initial_message += "## 审计范围\n"
        #  如果指定了目标文件，明确告知 Agent
        if target_files:
            initial_message += f"""**部分文件审计模式**: 用户指定了 {len(target_files)} 个目标文件进行审计：
"""
            for tf in target_files[:10]:
                initial_message += f"- {tf}\n"
            if len(target_files) > 10:
                initial_message += f"- ... 还有 {len(target_files) - 10} 个文件\n"
            initial_message += """
虽然用户指定了目标文件，但你仍需要：
1. 查看项目整体结构（使用 list_files 查看根目录和主要目录）
2. 读取配置文件和包管理文件，识别技术栈
3. 重点分析指定的目标文件
4. 发现并标记所有高风险区域（不限于目标文件）
"""
        
        if exclude_patterns:
            initial_message += f"\n排除模式: {', '.join(exclude_patterns[:5])}\n"

        use_prompt_skills = bool(config.get("use_prompt_skills", False))
        prompt_skills = config.get("prompt_skills") if isinstance(config, dict) else {}
        recon_prompt_skill = ""
        if use_prompt_skills and isinstance(prompt_skills, dict):
            recon_prompt_skill = str(prompt_skills.get("recon") or "").strip()
        if recon_prompt_skill:
            initial_message += f"""

## Prompt Skill（recon）
{recon_prompt_skill}
"""
        
        module_scope = config.get("recon_module") if isinstance(config, dict) else None
        in_module_worker_mode = isinstance(module_scope, dict)
        if in_module_worker_mode:
            initial_message += f"""
## 任务上下文
{task_context or task or '围绕单个模块执行深度 Recon，找出值得后续 Analysis 深挖的风险点。'}

## 当前模式：Recon SubAgent / 模块侦查 Worker
- 你是模块内实干执行者，不负责全项目建模
- 你只对当前模块范围负责：父 Agent 提供的 `directories` 和 `description`
- 你的首要目标是产出高质量结构化 `risk_points`、`input_surfaces`、`trust_boundaries`、`target_files`、`coverage_summary`
- 父 Agent 传给你的 `directories` 应视为**具体目录边界**；你的任务是深挖这些目录，不要再自行扩展到 `docs/`、`examples/`、`tests/` 等噪音目录
- 你的首要目标是产出高质量结构化 `risk_points`、`input_surfaces`、`trust_boundaries`、`target_files`、`coverage_summary`
- 本模式下由父 Agent 统一归并结果；你应专注于模块内搜索、确认、提炼证据

## 本轮侦查硬性目标
- 第一个 Action 必须优先围绕当前模块做 `list_files`
- 根据模块的语言/框架/入口/风险焦点，设计成组的 `search_code` 查询
- `search_code` 命中过多时先用 `group_by_file=true` 或 `count_only=true` 看分布，再收敛
- 命中候选后，必须用 `get_code_window` / `get_file_outline` / `get_function_summary` / `get_symbol_body` / `locate_enclosing_function` 确认
- 先识别真实入口点，再沿着 input_surfaces -> trust_boundaries -> sink 的方向展开
- 重点产出高价值候选点；不要把时间浪费在全项目目录漫游
- 对存在后续分析价值但证据尚不完整的点，也应用较低 confidence 保留
- 不要把 Markdown/RST 文档、使用说明、样例目录当成当前模块的主侦查对象，除非它们就是该模块唯一的真实运行时代码线索

## 模块内最低覆盖清单
- 当前模块的路由/控制器/Resolver/API 入口
- 当前模块的认证、授权、会话、管理员路径
- 当前模块的文件上传/下载、模板渲染、动态执行、反序列化
- 当前模块的 SQL/ORM/raw query、Webhook/Callback/OAuth、异步任务/消费者

## 结束前自检
- 是否已经基于真实代码产出 `risk_points`
- 是否已经补齐 `input_surfaces`、`trust_boundaries`、`target_files`
- 是否覆盖了当前模块的关键入口与敏感 sink
- Final Answer 必须以模块结果为中心，而不是项目总览

## 可用工具
{self.get_tools_description()}

## 🎯 开始模块侦查！

请立即进入当前模块的侦查工作。不要只输出 Thought，必须紧接着输出 Action。"""
        else:
            initial_message += f"""
## 任务上下文
{task_context or task or '进行项目建模、模块识别和 Recon 调度准备，为后续模块侦查提供清晰边界。'}

## 当前模式：Recon Host / 调度与建模
- 你的主职责是建模、拆分**功能模块**、定义优先级，而不是亲自扫完整个项目的每个模块
- 先建立项目地图，再明确哪些模块应该由 Recon SubAgent 去做深度侦查
- 你可以做少量关键确认，但不要陷入所有模块的逐文件深挖
- 建模完成后，应调用 `run_recon_subagent`（先 `action=plan`，再 `action=run`）推进模块侦查
- 若没有可用的模块化执行通道，再回退为亲自执行传统 Recon
- 你要把模块规划成**可直接派发给 SubAgent 的具体目录**，而不是抽象主题或文档目录

## 本轮侦查硬性目标
- 第一个 Action 必须是 `list_files`，先对根目录和关键目录建模
- 优先识别：语言、框架、入口目录、配置文件、任务/消费者、共享中间件、认证/支付/上传/回调等高风险模块
- 为每个模块准备明确边界：`directories` 和简短 `description`；其中 `directories` 应优先给出具体功能目录
- 调 `run_recon_subagent` 时，优先使用最小 payload：`{{"action":"plan","modules":[{{"directories":[...],"description":"..."}}]}}`
- 只对关键根目录/关键配置/关键入口做必要确认，不要一上来把所有模块都自己扫完
- 如果运行时缺少 SubAgent 通道，才切换为传统 Recon：`search_code` + 上下文确认 + 风险点入队
- 业务逻辑问题（如 IDOR/支付/状态机/权限提升）默认由 BusinessLogicReconAgent 负责；常规 Recon 优先产出代码安全风险点
- 默认忽略 `docs/`、`examples/`、`demo/`、`fixtures/`、`mocks/`、`coverage/`、`dist/`、`build/`、纯测试样例目录，不要把它们规划成主模块；除非用户明确指定目标文件或它们直接决定运行时行为

## Host 最低覆盖清单
- 根目录、关键目录、关键配置文件
- 路由/控制器/Resolver/API 入口
- 认证、授权、管理员、支付、上传、回调、下载、消费者、定时任务
- 中间件、守卫、拦截器、共享安全基础设施
- 只记录文档/样例目录是否存在，不要把它们当成功能模块主线

## 结束前自检
- 是否已经建立清晰的项目地图与模块划分
- 是否已经识别 `input_surfaces`、`trust_boundaries`、`target_files`
- 是否已明确哪些**具体目录模块**应优先被 SubAgent 深挖
- 若没有 SubAgent 通道，是否已正确回退为直接 Recon 并产出风险点
- Final Answer 必须体现：项目画像、模块划分、高风险模块、必要的风险点或模块结果摘要

## TypeScript 项目补充要求
- 若发现 `tsconfig.json`、`next.config.*`、`nest-cli.json`、`package.json`、`.ts`、`.tsx`，应按 TypeScript 项目处理，不要只按“泛 Node.js”略过
- 优先枚举 `pages/api/`、`app/api/**/route.ts`、`src/main.ts`、`src/app.controller.ts`、`*.controller.ts`、`*.resolver.ts`、`middleware.ts`、`server.ts`、`worker.ts`

## 可用工具
{self.get_tools_description()}

## 🎯 开始建模与调度准备！

请先建立项目地图与模块规划。不要只输出 Thought，必须紧接着输出 Action。"""

        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        final_result = None
        error_message = None  #  跟踪错误信息
        last_action_signature: Optional[str] = None
        repeated_action_streak = 0
        llm_timeout_streak = 0
        no_action_streak = 0
        
        await self.emit_thinking("Recon Agent 启动，LLM 开始自主收集信息...")
        
        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break
                
                self._iteration = iteration + 1
                
                #  再次检查取消标志（在LLM调用之前）
                if self.is_cancelled:
                    await self.emit_thinking("🛑 任务已取消，停止执行")
                    break

                # 调用 LLM 进行思考和决策（使用与 AnalysisAgent 相同的共享压缩路径）
                try:
                    llm_output, tokens_this_round = await self.stream_llm_call(
                        self._conversation_history,
                        #  不传递 temperature 和 max_tokens，使用用户配置
                    )
                except asyncio.CancelledError:
                    logger.info(f"[{self.name}] LLM call cancelled")
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
                
                #  Enhanced: Handle empty LLM response with better diagnostics
                if not llm_output or not llm_output.strip():
                    empty_retry_count = getattr(self, '_empty_retry_count', 0) + 1
                    self._empty_retry_count = empty_retry_count
                    stream_meta = getattr(self, "_last_llm_stream_meta", {}) or {}
                    empty_reason = str(stream_meta.get("empty_reason") or "").strip()
                    finish_reason = stream_meta.get("finish_reason")
                    chunk_count = int(stream_meta.get("chunk_count") or 0)
                    empty_from_stream = empty_reason in {"empty_response", "empty_stream", "empty_done"}
                    conversation_tokens_estimate = self._estimate_conversation_tokens(self._conversation_history)
                    
                    #  记录更详细的诊断信息
                    logger.warning(
                        f"[{self.name}] Empty LLM response in iteration {self._iteration} "
                        f"(retry {empty_retry_count}/3, tokens_this_round={tokens_this_round}, "
                        f"finish_reason={finish_reason}, empty_reason={empty_reason}, chunk_count={chunk_count})"
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
                        logger.error(f"[{self.name}] Too many empty responses, generating fallback result")
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
                        #  不是直接 break，而是尝试生成一个回退结果
                        break
                    
                    if empty_from_stream:
                        targeted_empty_recovery_used = True
                        retry_prompt = (
                            "上一轮模型返回了空响应（无有效文本）。请不要空输出，必须二选一立即返回：\n"
                            "1) 输出可执行 Action（含 Action Input）继续推进；\n"
                            "2) 若证据已充分，直接输出 Final Answer（JSON）。\n"
                            "禁止仅输出空白或无结构文本。"
                        )
                    else:
                        #  更有针对性的重试提示
                        retry_prompt = f"""收到空响应。请根据以下格式输出你的思考和行动：

如果你还没有完成项目建模，第一个 Action 必须优先使用 `list_files` 查看根目录；完成建模后，优先使用 `search_code` 搜索可疑区域，再用 `get_code_window` / `get_file_outline` 确认。

Thought: [你对当前情况的分析]
Action: [工具名称，如 list_files, get_code_window, get_file_outline, search_code]
Action Input: {{}}

可用工具: {', '.join(self.tools.keys())}

如果你认为信息收集已经完成，请输出：
Thought: [总结收集到的信息]
Final Answer: [JSON格式的结果]"""
                    
                    self._conversation_history.append({
                        "role": "user",
                        "content": retry_prompt,
                    })
                    continue
                
                # 重置空响应计数器
                self._empty_retry_count = 0

                # 解析 LLM 响应
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)
                
                #  发射 LLM 思考内容事件 - 展示 LLM 在想什么
                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 检查是否完成
                if step.is_final:
                    no_action_streak = 0
                    await self.emit_llm_decision("完成信息收集", "LLM 判断已收集足够信息")
                    await self.emit_llm_complete(
                        f"信息收集完成，共 {self._iteration} 轮思考",
                        self._total_tokens
                    )
                    final_result = step.final_answer
                    break
                
                # 执行工具
                if step.action:
                    no_action_streak = 0
                    #  发射 LLM 动作决策事件
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
                            "请更换参数、切换工具或直接输出 Final Answer。"
                        )
                        step.observation = observation
                        await self.emit_llm_observation(observation)
                        self._conversation_history.append(
                            {
                                "role": "user",
                                "content": f"Observation:\n{self._prepare_observation_for_history(observation)}",
                            }
                        )
                        continue
                    
                    #  循环检测：追踪工具调用失败历史
                    tool_call_key = f"{step.action}:{dump_json_safe(step.action_input or {}, sort_keys=True)}"
                    if not hasattr(self, '_failed_tool_calls'):
                        self._failed_tool_calls = {}
                    
                    observation = await self.execute_tool(
                        step.action,
                        step.action_input or {}
                    )
                    
                    #  检测工具调用失败并追踪
                    is_tool_error = (
                        "失败" in observation or 
                        "错误" in observation or 
                        "不存在" in observation or
                        "文件过大" in observation or
                        "Error" in observation
                    )
                    
                    if is_tool_error:
                        self._failed_tool_calls[tool_call_key] = self._failed_tool_calls.get(tool_call_key, 0) + 1
                        fail_count = self._failed_tool_calls[tool_call_key]
                        
                        #  如果同一调用连续失败3次，添加强制跳过提示
                        if fail_count >= 3:
                            logger.warning(f"[{self.name}] Tool call failed {fail_count} times: {tool_call_key}")
                            observation += f"\n\n**系统提示**: 此工具调用已连续失败 {fail_count} 次。请：\n"
                            observation += "1. 尝试使用不同的参数（如指定较小的行范围）\n"
                            observation += "2. 使用 search_code 工具定位关键代码片段\n"
                            observation += "3. 跳过此文件，继续分析其他文件\n"
                            observation += "4. 如果已有足够信息，直接输出 Final Answer"
                            
                            # 重置计数器但保留记录
                            self._failed_tool_calls[tool_call_key] = 0
                    else:
                        # 成功调用，重置失败计数
                        if tool_call_key in self._failed_tool_calls:
                            del self._failed_tool_calls[tool_call_key]
                        await self._update_coverage_from_last_tool(step.action, step.action_input or {})
                        self._track_live_push_action(step.action, step.action_input or {}, observation)
                    
                    #  工具执行后检查取消状态
                    if self.is_cancelled:
                        logger.info(f"[{self.name}] Cancelled after tool execution")
                        break
                    
                    step.observation = observation
                    
                    #  发射 LLM 观察事件
                    await self.emit_llm_observation(observation)
                    
                    # 添加观察结果到历史
                    history_observation = self._prepare_observation_for_history(observation)
                    self._conversation_history.append({
                        "role": "user",
                        "content": f"Observation:\n{history_observation}",
                    })
                else:
                    no_action_streak += 1
                    repeated_action_streak = 0
                    last_action_signature = None
                    # LLM 没有选择工具，提示它继续
                    await self.emit_llm_decision("继续思考", "LLM 需要更多信息")
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
                        "content": "请继续。你输出了 Thought 但没有输出 Action。请**立即**选择一个工具执行（Action: ...），或者如果信息收集完成，输出 Final Answer。",
                    })
            
            #  如果循环结束但没有 final_result，强制 LLM 总结
            if not final_result and not self.is_cancelled and not error_message:
                await self.emit_thinking("信息收集阶段结束，正在生成总结...")
                
                # 添加强制总结的提示
                self._conversation_history.append({
                    "role": "user",
                    "content": """信息收集阶段已结束。请立即输出 Final Answer，总结你收集到的所有信息。

请按以下 JSON 格式输出：
```json
{
    "project_structure": {"directories": [...], "key_files": [...]},
    "tech_stack": {"languages": [...], "frameworks": [...], "databases": [...]},
    "project_profile": {
        "is_web_project": false,
        "web_project_confidence": 0.0,
        "signals": [],
        "web_vulnerability_focus": []
    },
    "entry_points": [{"type": "...", "file": "...", "description": "..."}],
    "high_risk_areas": ["file1.py", "file2.js"],
    "initial_findings": [{"title": "...", "description": "...", "file_path": "..."}],
    "risk_points": [{"file_path": "...", "line_start": 1, "description": "...", "vulnerability_type": "..."}],
    "input_surfaces": ["request.body.email"],
    "trust_boundaries": ["HTTP request -> controller -> SQL"],
    "target_files": ["src/auth/login.py"],
    "coverage_summary": {"files_read_count": 0, "directories_scanned_count": 0},
    "summary": "项目总结描述"
}
```

Final Answer:""",
                })
                
                try:
                    summary_output, _ = await self.stream_llm_call(
                        self._conversation_history,
                        #  不传递 temperature 和 max_tokens，使用用户配置
                    )
                    
                    if summary_output and summary_output.strip():
                        # 解析总结输出
                        summary_text = summary_output.strip()
                        summary_text = re.sub(r'```json\s*', '', summary_text)
                        summary_text = re.sub(r'```\s*', '', summary_text)
                        final_result = AgentJsonParser.parse(
                            summary_text,
                            default=self._summarize_from_steps()
                        )
                except Exception as e:
                    logger.warning(f"[{self.name}] Failed to generate summary: {e}")
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            #  如果被取消，返回取消结果
            if self.is_cancelled:
                await self.emit_event(
                    "info",
                    f"🛑 Recon Agent 已取消: {self._iteration} 轮迭代"
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
            
            #  如果有错误，返回失败结果
            if error_message:
                await self.emit_event(
                    "error",
                    f"Recon Agent 失败: {error_message}"
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
            
            # 如果没有最终结果，从历史中汇总
            if not final_result:
                final_result = self._summarize_from_steps()
            if isinstance(final_result, dict):
                final_result = self._apply_subagent_runtime_payload(final_result)
                final_result = self._apply_runtime_recon_state(final_result)
                final_result = self._ensure_project_profile(final_result)
                await self._sync_recon_queue(final_result)
            
            #  记录工作和洞察
            self.record_work(f"完成项目信息收集，发现 {len(final_result.get('entry_points', []))} 个入口点")
            self.record_work(f"识别技术栈: {final_result.get('tech_stack', {})}")

            if final_result.get("high_risk_areas"):
                self.add_insight(f"发现 {len(final_result['high_risk_areas'])} 个高风险区域需要重点分析")
            if final_result.get("initial_findings"):
                self.add_insight(f"初步发现 {len(final_result['initial_findings'])} 个潜在问题")

            await self.emit_event(
                "info",
                f"Recon Agent 完成: {self._iteration} 轮迭代, {self._tool_calls} 次工具调用"
            )

            #  创建 TaskHandoff - 传递给下游 Agent
            handoff = self._create_recon_handoff(final_result)

            return AgentResult(
                success=True,
                data=final_result,
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
                handoff=handoff,  #  添加 handoff
            )
            
        except Exception as e:
            logger.error(f"Recon Agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    def _ensure_project_profile(self, final_result: Dict[str, Any]) -> Dict[str, Any]:
        tech_stack = final_result.get("tech_stack", {})
        frameworks = tech_stack.get("frameworks", []) if isinstance(tech_stack, dict) else []
        framework_lowers = {str(item).strip().lower() for item in frameworks if str(item).strip()}

        profile = final_result.get("project_profile")
        if not isinstance(profile, dict):
            profile = {}

        signals = {
            str(item).strip()
            for item in profile.get("signals", [])
            if isinstance(item, str) and str(item).strip()
        }
        for framework in framework_lowers:
            if framework in WEB_FRAMEWORK_HINTS:
                signals.add(f"framework:{framework}")
        for step in self._steps:
            observation = str(step.observation or "").lower()
            if not observation:
                continue
            for keyword in WEB_SIGNAL_HINTS:
                if keyword in observation:
                    signals.add(f"signal:{keyword}")

        is_web_raw = profile.get("is_web_project")
        if isinstance(is_web_raw, bool):
            is_web_project = is_web_raw
        else:
            is_web_project = bool(signals)

        confidence_raw = profile.get("web_project_confidence")
        try:
            confidence = float(confidence_raw)
        except Exception:
            confidence = min(1.0, len(signals) * 0.1)
            if is_web_project and confidence < 0.4:
                confidence = 0.4
        confidence = max(0.0, min(1.0, confidence))
        if not is_web_project:
            confidence = 0.0

        raw_focus = profile.get("web_vulnerability_focus", [])
        focus = [
            str(item).strip()
            for item in raw_focus
            if isinstance(item, str) and str(item).strip()
        ]
        if is_web_project and not focus:
            focus = list(WEB_VULNERABILITY_FOCUS_DEFAULT)
        if not is_web_project:
            focus = []

        final_result["project_profile"] = {
            "is_web_project": is_web_project,
            "web_project_confidence": round(confidence, 2),
            "signals": sorted(signals)[:16],
            "web_vulnerability_focus": focus,
        }
        return final_result

    @staticmethod
    def _append_unique(values: List[str], value: str) -> None:
        if value and value not in values:
            values.append(value)

    def _extend_matches_from_hints(
        self,
        values: List[str],
        observation: str,
        hint_map: Dict[str, tuple[str, ...]],
    ) -> None:
        for label, hints in hint_map.items():
            if any(hint in observation for hint in hints):
                self._append_unique(values, label)

    def _summarize_from_steps(self) -> Dict[str, Any]:
        """从步骤中汇总结果 - 增强版，从 LLM 思考过程中提取更多信息"""
        # 默认结果结构
        result = {
            "project_structure": {},
            "tech_stack": {
                "languages": [],
                "frameworks": [],
                "databases": [],
            },
            "project_profile": {
                "is_web_project": None,
                "web_project_confidence": 0.0,
                "signals": [],
                "web_vulnerability_focus": [],
            },
            "entry_points": [],
            "high_risk_areas": [],
            "input_surfaces": [],
            "trust_boundaries": [],
            "target_files": [],
            "dependencies": {},
            "initial_findings": [],
            "coverage_summary": {},
            "summary": "",  #  新增：汇总 LLM 的思考
        }
        
        #  收集所有 LLM 的思考内容
        thoughts = []
        
        # 从步骤的观察结果和思考中提取信息
        for step in self._steps:
            # 收集思考内容
            if step.thought:
                thoughts.append(step.thought)
            
            if step.observation:
                # 尝试从观察中识别技术栈等信息
                obs_lower = step.observation.lower()
                
                # 识别语言
                has_typescript_signal = any(
                    token in obs_lower
                    for token in ("tsconfig.json", ".ts", ".tsx", ".mts", ".cts", "typescript")
                )
                has_javascript_signal = any(
                    token in obs_lower
                    for token in ("package.json", ".js", ".jsx", ".mjs", ".cjs", "javascript")
                )
                if has_typescript_signal:
                    self._append_unique(result["tech_stack"]["languages"], "TypeScript")
                if has_javascript_signal:
                    self._append_unique(result["tech_stack"]["languages"], "JavaScript")
                if not has_typescript_signal and "package.json" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "JavaScript/TypeScript")
                if "requirements.txt" in obs_lower or "setup.py" in obs_lower or ".py" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "Python")
                if "go.mod" in obs_lower or ".go" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "Go")
                if "pom.xml" in obs_lower or ".java" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "Java")
                if ".php" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "PHP")
                if ".rb" in obs_lower or "gemfile" in obs_lower:
                    self._append_unique(result["tech_stack"]["languages"], "Ruby")
                
                # 识别框架
                self._extend_matches_from_hints(
                    result["tech_stack"]["frameworks"],
                    obs_lower,
                    FRAMEWORK_OBSERVATION_HINTS,
                )
                
                # 识别数据库
                self._extend_matches_from_hints(
                    result["tech_stack"]["databases"],
                    obs_lower,
                    DATABASE_OBSERVATION_HINTS,
                )
                
                #  识别高风险区域（从观察中提取）
                risk_keywords = [
                    "api", "auth", "login", "password", "secret", "key", "token",
                    "admin", "upload", "download", "exec", "eval", "sql", "query",
                    "webhook", "callback", "route", "controller", "resolver",
                    "middleware", "guard", "payment",
                ]
                for keyword in risk_keywords:
                    if keyword in obs_lower:
                        # 尝试从观察中提取文件路径
                        file_matches = SOURCE_FILE_PATTERN.findall(step.observation)
                        for file_path in file_matches[:8]:  # 限制数量
                            self._append_unique(result["high_risk_areas"], file_path)
        
        # 去重
        result["tech_stack"]["languages"] = list(dict.fromkeys(result["tech_stack"]["languages"]))
        result["tech_stack"]["frameworks"] = list(dict.fromkeys(result["tech_stack"]["frameworks"]))
        result["tech_stack"]["databases"] = list(dict.fromkeys(result["tech_stack"]["databases"]))
        result["high_risk_areas"] = list(dict.fromkeys(result["high_risk_areas"]))[:20]  # 限制数量
        result["risk_points"] = self._merge_risk_points(self._risk_points_pushed, self._extract_risk_points(result))
        for point in result["risk_points"]:
            self._remember_read_file(point.get("file_path"))
            self._remember_input_surface(point.get("input_surface"))
            self._remember_trust_boundary(point.get("trust_boundary"))
            if point.get("file_path") not in result["high_risk_areas"]:
                result["high_risk_areas"].append(point.get("file_path"))
        result = self._apply_runtime_recon_state(result)
        result = self._ensure_project_profile(result)
        
        #  汇总 LLM 的思考作为 summary
        if thoughts:
            # 取最后几个思考作为总结
            result["summary"] = "\n".join(thoughts[-3:])
        
        return result

    def build_project_recon_model(self, input_data: Dict[str, Any]) -> ProjectReconModel:
        project_info = (
            dict(input_data.get("project_info", {}))
            if isinstance(input_data.get("project_info"), dict)
            else {}
        )
        config = (
            dict(input_data.get("config", {}))
            if isinstance(input_data.get("config"), dict)
            else {}
        )
        project_root = (
            project_info.get("root")
            or input_data.get("project_root")
            or "."
        )
        return build_project_recon_model(
            project_root=str(project_root),
            project_info=project_info,
            config=config,
        )

    def merge_module_results(
        self,
        *,
        project_model: ProjectReconModel,
        module_results: List[ReconModuleResult],
        project_info: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        merged = merge_recon_module_results(
            project_model=project_model,
            module_results=module_results,
            project_info=project_info,
        )
        return self._ensure_project_profile(merged)
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history

    def get_steps(self) -> List[ReconStep]:
        """获取执行步骤"""
        return self._steps

    def _create_recon_handoff(self, final_result: Dict[str, Any]) -> TaskHandoff:
        """
        创建 Recon Agent 的任务交接信息

        Args:
            final_result: Recon 收集的最终结果

        Returns:
            TaskHandoff 对象，供 Analysis Agent 使用
        """
        # 提取关键发现
        key_findings = []
        for f in final_result.get("risk_points", [])[:15]:
            if isinstance(f, dict):
                key_findings.append(f)
        for f in final_result.get("initial_findings", [])[:10]:
            if isinstance(f, dict) and f not in key_findings:
                key_findings.append(f)

        # 构建建议行动
        suggested_actions = []
        for area in final_result.get("risk_points", [])[:15]:
            if isinstance(area, dict):
                suggested_actions.append({
                    "action": "deep_analysis",
                    "target": f"{area.get('file_path', '')}:{area.get('line_start', 1)}",
                    "reason": area.get("description", "高风险区域需要深入分析")[:160],
                })

        # 提取入口点作为关注点
        attention_points = []
        for ep in final_result.get("entry_points", [])[:15]:
            if isinstance(ep, dict):
                attention_points.append(
                    f"[{ep.get('type', 'unknown')}] {ep.get('file', '')}:{ep.get('line', '')}"
                )

        # 构建上下文数据
        context_data = {
            "tech_stack": final_result.get("tech_stack", {}),
            "project_profile": final_result.get("project_profile", {}),
            "project_structure": final_result.get("project_structure", {}),
            "risk_points": final_result.get("risk_points", [])[:50],
            "input_surfaces": final_result.get("input_surfaces", [])[:24],
            "trust_boundaries": final_result.get("trust_boundaries", [])[:24],
            "target_files": final_result.get("target_files", [])[:64],
            "coverage_summary": final_result.get("coverage_summary", {}),
            "recon_queue_status": final_result.get("recon_queue_status", {}),
            # "recommended_tools": final_result.get("recommended_tools", {}),
            "recommended_tools": {},  #  目前不传递工具推荐
            "dependencies": final_result.get("dependencies", {}),
        }

        # 构建摘要
        tech_stack = final_result.get("tech_stack", {})
        languages = tech_stack.get("languages", [])
        frameworks = tech_stack.get("frameworks", [])

        summary = f"完成项目侦察: "
        if languages:
            summary += f"语言={', '.join(languages[:3])}; "
        if frameworks:
            summary += f"框架={', '.join(frameworks[:3])}; "
        profile = final_result.get("project_profile", {})
        if isinstance(profile, dict):
            if profile.get("is_web_project") is True:
                summary += "判定为Web项目; "
            elif profile.get("is_web_project") is False:
                summary += "判定为非Web项目; "
        summary += f"入口点={len(final_result.get('entry_points', []))}个; "
        summary += f"高风险区域={len(final_result.get('high_risk_areas', []))}个; "
        summary += f"风险点={len(final_result.get('risk_points', []))}个"

        return self.create_handoff(
            to_agent="analysis",
            summary=summary,
            key_findings=key_findings,
            suggested_actions=suggested_actions,
            attention_points=attention_points,
            priority_areas=final_result.get("high_risk_areas", [])[:15],
            context_data=context_data,
        )
