from __future__ import annotations

import copy
from typing import Any, Callable, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .base import AgentTool, ToolResult
from ..workflow.models import WorkflowState
from ..workflow.recon_executor import ReconModuleExecutor
from ..workflow.recon_models import (
    ProjectReconModel,
    ReconModuleDescriptor,
    build_project_recon_model,
    derive_module_root_directories,
    merge_recon_module_results,
)


class RunReconSubAgentInput(BaseModel):
    action: Literal["plan", "run"] = Field(
        default="run",
        description="plan: 仅返回模块规划；run: 执行 ReconSubAgent 并返回归并结果",
    )
    modules: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description=(
            "可选的 Host 模块规划。每项只需要 directories 和 description；"
            "兼容旧格式 paths/name/risk_focus，工具会自动归一化。"
        ),
    )
    notes: Optional[str] = Field(
        default=None,
        description="兼容旧调用的备注字段；当前会被忽略。",
    )
    module_ids: Optional[List[str]] = Field(
        default=None,
        description="仅运行指定模块ID；为空时按优先级自动选择",
    )
    max_modules: Optional[int] = Field(
        default=None,
        ge=1,
        le=256,
        description="本次最多执行模块数（按 priority 排序后截断）",
    )
    max_workers: Optional[int] = Field(
        default=None,
        ge=1,
        le=32,
        description="覆盖默认并发；为空时使用 workflow 的 recon_count",
    )
    force_rerun: bool = Field(
        default=False,
        description="是否忽略已执行模块缓存并强制重跑",
    )


class RunReconSubAgentTool(AgentTool):
    """由 ReconHost 调用的模块侦查工具：按需并发执行 ReconSubAgent。"""

    def __init__(
        self,
        *,
        orchestrator_provider: Optional[Callable[[], Any]] = None,
        max_workers: int = 3,
    ):
        super().__init__()
        self._orchestrator_provider = orchestrator_provider
        self._orchestrator: Any = None
        self._max_workers = max(1, int(max_workers or 1))
        self._executed_module_ids: set[str] = set()
        self._planned_project_model: ProjectReconModel | None = None

    @property
    def name(self) -> str:
        return "run_recon_subagent"

    @property
    def description(self) -> str:
        return (
            "让 ReconHost 按需执行模块级 ReconSubAgent。"
            "支持先 plan 查看模块，再 run 按模块并发侦查并返回结构化归并结果。"
            "推荐最小 plan payload：modules=[{directories, description}]。"
        )

    @property
    def args_schema(self):
        return RunReconSubAgentInput

    def set_orchestrator(self, orchestrator: Any) -> None:
        self._orchestrator = orchestrator

    def set_max_workers(self, max_workers: int) -> None:
        self._max_workers = max(1, int(max_workers or 1))

    def reset_execution_cache(self) -> None:
        self._executed_module_ids = set()
        self._planned_project_model = None

    def _resolve_orchestrator(self) -> Any:
        if self._orchestrator is not None:
            return self._orchestrator
        if callable(self._orchestrator_provider):
            return self._orchestrator_provider()
        return None

    @staticmethod
    def _build_host_input(orchestrator: Any) -> Dict[str, Any]:
        runtime_context = getattr(orchestrator, "_runtime_context", {}) or {}
        return {
            "project_info": (
                dict(runtime_context.get("project_info", {}))
                if isinstance(runtime_context.get("project_info"), dict)
                else {}
            ),
            "config": (
                dict(runtime_context.get("config", {}))
                if isinstance(runtime_context.get("config"), dict)
                else {}
            ),
            "project_root": runtime_context.get("project_root", "."),
            "task_id": runtime_context.get("task_id"),
        }

    @staticmethod
    def _resolve_project_model(orchestrator: Any, host_input: Dict[str, Any]) -> ProjectReconModel:
        recon_agent = getattr(orchestrator, "sub_agents", {}).get("recon")
        if recon_agent is not None and hasattr(recon_agent, "build_project_recon_model"):
            return recon_agent.build_project_recon_model(host_input)
        return build_project_recon_model(
            project_root=str(host_input.get("project_root") or "."),
            project_info=dict(host_input.get("project_info") or {}),
            config=dict(host_input.get("config") or {}),
        )

    @staticmethod
    async def _emit_host_status(
        orchestrator: Any,
        *,
        lifecycle: str,
        message: str,
        selected: Optional[List[ReconModuleDescriptor]] = None,
    ) -> None:
        recon_agent = getattr(orchestrator, "sub_agents", {}).get("recon")
        emit = getattr(recon_agent, "emit_event", None)
        if not callable(emit):
            return
        try:
            await emit(
                "info",
                message,
                metadata={
                    "agent_name": getattr(recon_agent, "name", "Recon"),
                    "agent_role": "recon_host",
                    "recon_host_lifecycle": lifecycle,
                    "recon_subagent_count": len(selected or []),
                    "module_ids": [str(item.module_id) for item in (selected or [])],
                },
            )
        except Exception:
            pass

    @staticmethod
    def _normalize_directories(raw_module: Dict[str, Any]) -> List[str]:
        directories = raw_module.get("directories")
        if not isinstance(directories, list) or not directories:
            directories = raw_module.get("paths")
        normalized: List[str] = []
        for item in directories or []:
            text = str(item or "").replace("\\", "/").strip().lstrip("./")
            if text and text not in normalized:
                normalized.append(text)
        return normalized

    @staticmethod
    def _normalize_description(raw_module: Dict[str, Any], directories: List[str]) -> str:
        description = str(raw_module.get("description") or "").strip()
        if description:
            return description

        risk_focus = raw_module.get("risk_focus")
        if isinstance(risk_focus, list):
            joined = ", ".join(str(item or "").strip() for item in risk_focus if str(item or "").strip())
            if joined:
                return joined
        elif isinstance(risk_focus, str) and risk_focus.strip():
            return risk_focus.strip()

        name = str(raw_module.get("name") or "").strip()
        if name:
            return f"Inspect {name}"
        if directories:
            return f"Inspect {directories[0]}"
        return "Inspect module"

    @staticmethod
    def _path_matches_any_directory(path: str, directories: List[str]) -> bool:
        normalized_path = str(path or "").replace("\\", "/").strip().lstrip("./")
        if not normalized_path:
            return False
        for directory in directories:
            normalized_directory = str(directory or "").replace("\\", "/").strip().lstrip("./").rstrip("/")
            if not normalized_directory or normalized_directory == ".":
                return True
            if normalized_path == normalized_directory or normalized_path.startswith(normalized_directory + "/"):
                return True
        return False

    @staticmethod
    def _slugify(value: str) -> str:
        sanitized = [
            ch.lower() if ch.isalnum() else "_"
            for ch in str(value or "").strip()
        ]
        slug = "".join(sanitized).strip("_")
        while "__" in slug:
            slug = slug.replace("__", "_")
        return slug or "module"

    def _build_planned_project_model(
        self,
        *,
        base_model: ProjectReconModel,
        modules: List[Dict[str, Any]],
    ) -> ProjectReconModel:
        all_files = sorted(
            {
                str(path or "")
                for descriptor in (base_model.module_descriptors or [])
                for path in (descriptor.target_files or [])
                if str(path or "").strip()
            }
        )
        entry_points = [str(path or "") for path in (base_model.entry_points or []) if str(path or "").strip()]

        planned_descriptors: List[ReconModuleDescriptor] = []
        seen_module_ids: set[str] = set()
        for index, raw_module in enumerate(modules or []):
            if not isinstance(raw_module, dict):
                continue
            directories = self._normalize_directories(raw_module)
            if not directories:
                continue
            description = self._normalize_description(raw_module, directories)
            module_id_base = self._slugify("__".join(directories))
            module_id = module_id_base
            suffix = 2
            while module_id in seen_module_ids:
                module_id = f"{module_id_base}_{suffix}"
                suffix += 1
            seen_module_ids.add(module_id)

            target_files = [
                file_path
                for file_path in all_files
                if self._path_matches_any_directory(file_path, directories)
            ]
            module_root_directories = derive_module_root_directories(
                directories,
                target_files=target_files,
            )
            module_entrypoints = [
                file_path
                for file_path in entry_points
                if self._path_matches_any_directory(file_path, directories)
            ]
            planned_descriptors.append(
                ReconModuleDescriptor(
                    module_id=module_id,
                    name=module_root_directories[0] if module_root_directories else directories[0],
                    module_type="custom",
                    paths=list(module_root_directories or directories),
                    description=description,
                    entrypoints=module_entrypoints[:20],
                    language_hints=list(base_model.languages or []),
                    framework_hints=list(base_model.frameworks or []),
                    risk_focus=[description] if description else [],
                    priority=max(1, 1000 - index),
                    estimated_size=len(target_files),
                    target_files=target_files,
                )
            )

        target_files = sorted(
            {
                str(path or "")
                for descriptor in planned_descriptors
                for path in (descriptor.target_files or [])
                if str(path or "").strip()
            }
        )
        project_model = ProjectReconModel(
            project_root=base_model.project_root,
            languages=list(base_model.languages or []),
            frameworks=list(base_model.frameworks or []),
            entry_points=list(base_model.entry_points or []),
            key_directories=list(base_model.key_directories or []),
            module_descriptors=planned_descriptors,
            global_risk_themes=[],
            cross_cutting_paths=list(base_model.cross_cutting_paths or []),
            target_files=target_files,
            scope_limited=bool(base_model.scope_limited),
        )
        project_model.global_risk_themes = [
            descriptor.description
            for descriptor in planned_descriptors
            if str(descriptor.description or "").strip()
        ]
        return project_model

    @staticmethod
    def _select_default_focus_modules(
        model: ProjectReconModel,
        *,
        force_rerun: bool,
        executed_ids: set[str],
    ) -> List[ReconModuleDescriptor]:
        modules = list(model.module_descriptors or [])
        if not modules:
            return []

        if not force_rerun and executed_ids:
            modules = [item for item in modules if item.module_id not in executed_ids]
        if not modules:
            return []

        preferred_types = {
            "core_native",
            "backend_native",
            "fuzzing",
            "dependency_native",
            "auth",
            "admin",
            "payment",
            "upload",
            "webhook",
            "api",
            "worker",
            "storage",
            "cross_cutting",
        }
        fallback_types = {"shared", "deployment", "build"}

        preferred = [item for item in modules if str(item.module_type or "").strip().lower() in preferred_types]
        if preferred:
            return preferred[:8]

        fallback = [item for item in modules if str(item.module_type or "").strip().lower() in fallback_types]
        if fallback:
            return fallback[:6]

        return modules[:6]

    @staticmethod
    def _select_modules(
        *,
        model: ProjectReconModel,
        module_ids: List[str] | None,
        max_modules: int | None,
        force_rerun: bool,
        executed_ids: set[str],
    ) -> List[ReconModuleDescriptor]:
        modules = list(model.module_descriptors or [])
        if not modules:
            return []

        selected = modules
        normalized_ids = [str(item or "").strip() for item in (module_ids or []) if str(item or "").strip()]
        if normalized_ids:
            id_set = set(normalized_ids)
            selected = [item for item in modules if item.module_id in id_set]

        if not force_rerun and executed_ids:
            selected = [item for item in selected if item.module_id not in executed_ids]

        if max_modules and max_modules > 0:
            selected = selected[: int(max_modules)]
        return selected

    @staticmethod
    def _build_plan_project_model_summary(project_model: ProjectReconModel) -> Dict[str, Any]:
        return {
            "project_root": str(project_model.project_root or "."),
            "languages": list(project_model.languages or []),
            "frameworks": list(project_model.frameworks or []),
            "key_directories": list(project_model.key_directories or [])[:20],
            "entry_points": list(project_model.entry_points or [])[:20],
            "cross_cutting_paths": list(project_model.cross_cutting_paths or [])[:20],
            "global_risk_themes": list(project_model.global_risk_themes or [])[:20],
            "scope_limited": bool(project_model.scope_limited),
        }

    @staticmethod
    def _build_planned_modules_summary(
        modules: List[ReconModuleDescriptor],
    ) -> List[Dict[str, Any]]:
        return [
            {
                "module_id": str(module.module_id),
                "directories": list(module.paths or []),
                "description": str(module.description or ""),
                "module_type": str(module.module_type or ""),
                "estimated_size": int(module.estimated_size or 0),
                "entrypoint_count": len(module.entrypoints or []),
                "target_file_count": len(module.target_files or []),
            }
            for module in modules
        ]

    async def _execute(
        self,
        action: Literal["plan", "run"] = "run",
        modules: Optional[List[Dict[str, Any]]] = None,
        notes: Optional[str] = None,
        module_ids: Optional[List[str]] = None,
        max_modules: Optional[int] = None,
        max_workers: Optional[int] = None,
        force_rerun: bool = False,
        **kwargs,
    ) -> ToolResult:
        _ = (notes, kwargs)
        orchestrator = self._resolve_orchestrator()
        if orchestrator is None:
            return ToolResult(success=False, error="ReconSubAgent runtime unavailable: orchestrator not ready")

        sub_agents = getattr(orchestrator, "sub_agents", {}) or {}
        if sub_agents.get("recon_subagent") is None:
            return ToolResult(success=False, error="ReconSubAgent runtime unavailable: recon_subagent not registered")

        host_input = self._build_host_input(orchestrator)
        base_project_model = self._resolve_project_model(orchestrator, host_input)
        project_model = (
            self._build_planned_project_model(base_model=base_project_model, modules=modules)
            if modules
            else self._planned_project_model
            if self._planned_project_model is not None
            else base_project_model
        )
        if modules:
            self._planned_project_model = project_model
        all_modules = list(project_model.module_descriptors or [])

        if action == "plan":
            payload = {
                "action": "plan",
                "module_count": len(all_modules),
                "planned_modules": self._build_planned_modules_summary(all_modules),
                "project_model": self._build_plan_project_model_summary(project_model),
                "summary": (
                    f"已完成 {len(all_modules)} 个模块的规划，可继续调用 "
                    "`run_recon_subagent` with `action=run` 执行模块侦查。"
                ),
            }
            return ToolResult(success=True, data=payload, metadata=payload)

        force_rerun_flag = bool(force_rerun)
        explicit_selection_requested = bool(
            modules
            or self._planned_project_model is not None
            or module_ids
            or max_modules
        )
        if explicit_selection_requested:
            selected = self._select_modules(
                model=project_model,
                module_ids=module_ids,
                max_modules=max_modules,
                force_rerun=force_rerun_flag,
                executed_ids=self._executed_module_ids,
            )
        else:
            selected = self._select_default_focus_modules(
                project_model,
                force_rerun=force_rerun_flag,
                executed_ids=self._executed_module_ids,
            )
        if not selected:
            payload = {
                "action": "run",
                "module_count": len(all_modules),
                "selected_module_count": 0,
                "selected_module_ids": [],
                "project_model": project_model.to_dict(),
                "module_results": [],
                "risk_points": [],
                "summary": "无可执行模块（可能都已执行过）",
            }
            return ToolResult(success=True, data=payload, metadata=payload)

        effective_workers = max(1, int(max_workers or self._max_workers))
        effective_workers = min(effective_workers, len(selected))
        await self._emit_host_status(
            orchestrator,
            lifecycle="waiting_subagents",
            message=(
                f"ReconAgent 已完成项目结构侦查，正在等待 {len(selected)} 个 ReconSubAgent 并发执行完成"
            ),
            selected=selected,
        )
        model_for_run = copy.deepcopy(project_model)
        model_for_run.module_descriptors = list(selected)

        executor = ReconModuleExecutor(
            orchestrator=orchestrator,
            max_workers=effective_workers,
            enable_parallel=effective_workers > 1,
        )
        state = WorkflowState()
        task_id = str(host_input.get("task_id") or "")
        module_results = await executor.run_parallel_recon(
            state=state,
            task_id=task_id,
            project_model=model_for_run,
        )

        merged = merge_recon_module_results(
            project_model=model_for_run,
            module_results=module_results,
            project_info=dict(host_input.get("project_info") or {}),
        )
        await self._emit_host_status(
            orchestrator,
            lifecycle="collect_results",
            message=(
                f"ReconAgent 已收到 {len(selected)} 个 ReconSubAgent 结果，开始统一汇总子模块侦查结果"
            ),
            selected=selected,
        )
        for descriptor in selected:
            self._executed_module_ids.add(str(descriptor.module_id))

        risk_points_pushed = sum(
            max(0, int(getattr(item, "risk_points_pushed", 0) or 0))
            for item in module_results
        )

        payload = {
            "action": "run",
            "module_count": len(all_modules),
            "selected_module_count": len(selected),
            "selected_module_ids": [str(item.module_id) for item in selected],
            "effective_workers": effective_workers,
            "project_model": project_model.to_dict(),
            "module_results": [item.to_dict() for item in module_results],
            "risk_points": list(merged.get("risk_points") or []),
            "risk_points_pushed": risk_points_pushed,
            "input_surfaces": list(merged.get("input_surfaces") or []),
            "trust_boundaries": list(merged.get("trust_boundaries") or []),
            "target_files": list(merged.get("target_files") or []),
            "coverage_summary": dict(merged.get("coverage_summary") or {}),
            "summary": str(merged.get("summary") or ""),
            "modules_processed": int(state.recon_modules_processed),
            "modules_failed": int(state.recon_modules_failed),
        }
        return ToolResult(success=True, data=payload, metadata=payload)
