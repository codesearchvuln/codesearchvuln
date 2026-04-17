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
    merge_recon_module_results,
)


class RunReconSubAgentInput(BaseModel):
    action: Literal["plan", "run"] = Field(
        default="run",
        description="plan: 仅返回模块规划；run: 执行 ReconSubAgent 并返回归并结果",
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

    @property
    def name(self) -> str:
        return "run_recon_subagent"

    @property
    def description(self) -> str:
        return (
            "让 ReconHost 按需执行模块级 ReconSubAgent。"
            "支持先 plan 查看模块，再 run 按模块并发侦查并返回结构化归并结果。"
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

    async def _execute(
        self,
        action: Literal["plan", "run"] = "run",
        module_ids: Optional[List[str]] = None,
        max_modules: Optional[int] = None,
        max_workers: Optional[int] = None,
        force_rerun: bool = False,
        **kwargs,
    ) -> ToolResult:
        _ = kwargs
        orchestrator = self._resolve_orchestrator()
        if orchestrator is None:
            return ToolResult(success=False, error="ReconSubAgent runtime unavailable: orchestrator not ready")

        sub_agents = getattr(orchestrator, "sub_agents", {}) or {}
        if sub_agents.get("recon_subagent") is None:
            return ToolResult(success=False, error="ReconSubAgent runtime unavailable: recon_subagent not registered")

        host_input = self._build_host_input(orchestrator)
        project_model = self._resolve_project_model(orchestrator, host_input)
        all_modules = list(project_model.module_descriptors or [])

        if action == "plan":
            payload = {
                "action": "plan",
                "module_count": len(all_modules),
                "project_model": project_model.to_dict(),
            }
            return ToolResult(success=True, data=payload, metadata=payload)

        selected = self._select_modules(
            model=project_model,
            module_ids=module_ids,
            max_modules=max_modules,
            force_rerun=bool(force_rerun),
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
        for descriptor in selected:
            self._executed_module_ids.add(str(descriptor.module_id))

        payload = {
            "action": "run",
            "module_count": len(all_modules),
            "selected_module_count": len(selected),
            "selected_module_ids": [str(item.module_id) for item in selected],
            "effective_workers": effective_workers,
            "project_model": project_model.to_dict(),
            "module_results": [item.to_dict() for item in module_results],
            "risk_points": list(merged.get("risk_points") or []),
            "input_surfaces": list(merged.get("input_surfaces") or []),
            "trust_boundaries": list(merged.get("trust_boundaries") or []),
            "target_files": list(merged.get("target_files") or []),
            "coverage_summary": dict(merged.get("coverage_summary") or {}),
            "summary": str(merged.get("summary") or ""),
            "modules_processed": int(state.recon_modules_processed),
            "modules_failed": int(state.recon_modules_failed),
        }
        return ToolResult(success=True, data=payload, metadata=payload)
