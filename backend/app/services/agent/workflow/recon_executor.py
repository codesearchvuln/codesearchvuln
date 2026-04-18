from __future__ import annotations

import asyncio
import copy
import logging
import time
from typing import TYPE_CHECKING, Any, Dict, List

from .models import WorkflowPhase, WorkflowState, WorkflowStepRecord
from .recon_models import ProjectReconModel, ReconModuleDescriptor, ReconModuleResult

if TYPE_CHECKING:
    from ..agents.base import BaseAgent
    from ..agents.orchestrator import OrchestratorAgent

logger = logging.getLogger(__name__)

_RECON_SUBAGENT_BLOCKED_TOOLS = {
    "run_recon_subagent",
    "push_risk_point_to_queue",
    "push_risk_points_to_queue",
    "get_recon_risk_queue_status",
    "dequeue_recon_risk_point",
    "peek_recon_risk_queue",
    "clear_recon_risk_queue",
    "is_recon_risk_point_in_queue",
}


class ReconModuleExecutor:
    """Fan-out/fan-in executor for module-scoped Recon workers."""

    def __init__(
        self,
        orchestrator: "OrchestratorAgent",
        max_workers: int,
        enable_parallel: bool = True,
    ) -> None:
        self.orchestrator = orchestrator
        self.max_workers = max(1, int(max_workers or 1))
        self.enable_parallel = enable_parallel
        self.semaphore = asyncio.Semaphore(self.max_workers)
        self.lock = asyncio.Lock()

    def _clone_single_tool_for_worker(
        self,
        tool_name: str,
        tool_obj: Any,
        module_files: List[str],
    ) -> Any:
        clone_method = getattr(tool_obj, "clone_for_worker", None)
        if callable(clone_method):
            try:
                cloned = clone_method()
            except Exception:
                cloned = copy.copy(tool_obj)
        else:
            try:
                cloned = copy.copy(tool_obj)
            except Exception:
                cloned = tool_obj

        if hasattr(cloned, "target_files"):
            current_value = getattr(cloned, "target_files", None)
            normalized = [str(path or "").replace("\\", "/").lstrip("./") for path in module_files]
            if isinstance(current_value, list):
                cloned.target_files = list(normalized)
            else:
                cloned.target_files = set(normalized)
        if hasattr(cloned, "_project_scope_index"):
            cloned._project_scope_index = None
        return cloned

    def _build_worker_tools(self, base_tools: Any, module_files: List[str]) -> Any:
        if not isinstance(base_tools, dict):
            return base_tools
        return {
            name: self._clone_single_tool_for_worker(name, tool, module_files)
            for name, tool in base_tools.items()
            if str(name or "").strip().lower() not in _RECON_SUBAGENT_BLOCKED_TOOLS
        }

    def _create_worker_agent(
        self,
        *,
        worker_id: int,
        descriptor: ReconModuleDescriptor,
    ) -> "BaseAgent":
        base_agent = self.orchestrator.sub_agents.get("recon_subagent")
        if base_agent is None:
            raise RuntimeError("Recon sub-agent is not registered")

        worker_tools = self._build_worker_tools(base_agent.tools, descriptor.target_files)
        worker_agent = base_agent.__class__(
            llm_service=base_agent.llm_service,
            tools=worker_tools,
            event_emitter=base_agent.event_emitter,
        )
        worker_agent.config = copy.deepcopy(base_agent.config)
        module_label = str(descriptor.name or descriptor.module_id or worker_id).strip() or str(worker_id)
        worker_name = f"{base_agent.name}[{module_label}]"
        if isinstance(worker_agent.config, dict):
            worker_agent.config["name"] = worker_name
        else:
            worker_agent.config.name = worker_name
        worker_agent.name = worker_name

        if hasattr(worker_agent, "configure_trace_logger"):
            try:
                worker_agent.configure_trace_logger(
                    worker_agent.name,
                    getattr(self.orchestrator, "_runtime_context", {}).get("task_id"),
                )
            except Exception:
                pass
        if hasattr(worker_agent, "set_tool_runtime"):
            worker_agent.set_tool_runtime(getattr(base_agent, "_tool_runtime", None))
        if hasattr(worker_agent, "set_write_scope_guard"):
            worker_agent.set_write_scope_guard(getattr(base_agent, "_write_scope_guard", None))
        cancel_callback = getattr(base_agent, "_cancel_callback", None)
        if cancel_callback is not None and hasattr(worker_agent, "set_cancel_callback"):
            worker_agent.set_cancel_callback(cancel_callback)
        return worker_agent

    async def _emit_agent_status(
        self,
        agent: Any,
        *,
        descriptor: ReconModuleDescriptor,
        lifecycle: str,
        message: str,
    ) -> None:
        emit = getattr(agent, "emit_event", None)
        if not callable(emit):
            return
        try:
            await emit(
                "info",
                message,
                metadata={
                    "agent_name": getattr(agent, "name", "ReconSubAgent"),
                    "agent_role": "recon_subagent",
                    "parent_agent_name": "Recon",
                    "module_id": descriptor.module_id,
                    "module_name": descriptor.name,
                    "module_paths": list(descriptor.paths or []),
                    "subagent_lifecycle": lifecycle,
                },
            )
        except Exception:
            logger.debug("[ReconExecutor] failed to emit worker lifecycle event", exc_info=True)

    async def _emit_host_status(
        self,
        *,
        lifecycle: str,
        message: str,
        project_model: ProjectReconModel,
    ) -> None:
        recon_host = getattr(self.orchestrator, "sub_agents", {}).get("recon")
        emit = getattr(recon_host, "emit_event", None)
        if not callable(emit):
            return
        try:
            await emit(
                "info",
                message,
                metadata={
                    "agent_name": getattr(recon_host, "name", "Recon"),
                    "agent_role": "recon_host",
                    "recon_host_lifecycle": lifecycle,
                    "recon_subagent_count": len(project_model.module_descriptors or []),
                    "module_ids": [str(item.module_id) for item in (project_model.module_descriptors or [])],
                },
            )
        except Exception:
            logger.debug("[ReconExecutor] failed to emit host lifecycle event", exc_info=True)

    def _build_worker_input(
        self,
        *,
        task_id: str,
        project_model: ProjectReconModel,
        descriptor: ReconModuleDescriptor,
    ) -> Dict[str, Any]:
        runtime_context = getattr(self.orchestrator, "_runtime_context", {}) or {}
        project_info = (
            dict(runtime_context.get("project_info", {}))
            if isinstance(runtime_context.get("project_info"), dict)
            else {}
        )
        config = (
            dict(runtime_context.get("config", {}))
            if isinstance(runtime_context.get("config"), dict)
            else {}
        )
        config["recon_module"] = descriptor.to_dict()
        config["project_recon_model"] = project_model.to_dict()
        module_paths = ", ".join(descriptor.paths or [])
        module_description = str(descriptor.description or "").strip()
        return {
            "task": (
                f"针对目录 {module_paths or descriptor.name} 进行安全 Recon，"
                "识别该范围内的高风险代码区域"
            ),
            "task_context": (
                f"directories={module_paths}\n"
                f"description={module_description or ('Inspect ' + (descriptor.name or 'module'))}"
            ),
            "project_info": project_info,
            "config": config,
            "project_root": runtime_context.get("project_root", project_model.project_root),
            "task_id": task_id,
        }

    @staticmethod
    def _normalize_result(
        *,
        descriptor: ReconModuleDescriptor,
        result: Any,
        error: str | None = None,
    ) -> ReconModuleResult:
        payload = result.data if getattr(result, "success", False) and isinstance(result.data, dict) else {}
        coverage = payload.get("coverage_summary") if isinstance(payload.get("coverage_summary"), dict) else {}
        return ReconModuleResult(
            module_id=descriptor.module_id,
            module_name=descriptor.name,
            module_type=descriptor.module_type,
            success=bool(getattr(result, "success", False)) and not error,
            risk_points=list(payload.get("risk_points") or []),
            files_read=list(coverage.get("files_read") or []),
            files_discovered=list(coverage.get("files_discovered") or []),
            directories_scanned=list(coverage.get("directories_scanned") or []),
            input_surfaces=[
                str(item)
                for item in (payload.get("input_surfaces") or [])
                if str(item).strip()
            ],
            trust_boundaries=[
                str(item)
                for item in (payload.get("trust_boundaries") or [])
                if str(item).strip()
            ],
            target_files=[
                str(item)
                for item in (payload.get("target_files") or descriptor.target_files)
                if str(item).strip()
            ],
            summary=str(payload.get("summary") or ""),
            error=error or getattr(result, "error", None),
        )

    async def _run_single_module(
        self,
        *,
        index: int,
        state: WorkflowState,
        task_id: str,
        project_model: ProjectReconModel,
        descriptor: ReconModuleDescriptor,
    ) -> ReconModuleResult:
        worker_agent = self._create_worker_agent(worker_id=index, descriptor=descriptor)
        await self._emit_agent_status(
            worker_agent,
            descriptor=descriptor,
            lifecycle="queued",
            message=f"模块 {descriptor.name} 已加入 ReconSubAgent 队列，等待可用 worker",
        )
        if self.orchestrator.is_cancelled:
            await self._emit_agent_status(
                worker_agent,
                descriptor=descriptor,
                lifecycle="cancelled",
                message=f"模块 {descriptor.name} 在执行前被取消",
            )
            return ReconModuleResult(
                module_id=descriptor.module_id,
                module_name=descriptor.name,
                module_type=descriptor.module_type,
                success=False,
                target_files=list(descriptor.target_files),
                error="cancelled",
            )

        async with self.semaphore:
            if self.orchestrator.is_cancelled:
                await self._emit_agent_status(
                    worker_agent,
                    descriptor=descriptor,
                    lifecycle="cancelled",
                    message=f"模块 {descriptor.name} 在获取 worker 后被取消",
                )
                return ReconModuleResult(
                    module_id=descriptor.module_id,
                    module_name=descriptor.name,
                    module_type=descriptor.module_type,
                    success=False,
                    target_files=list(descriptor.target_files),
                    error="cancelled",
                )

            await self._emit_agent_status(
                worker_agent,
                descriptor=descriptor,
                lifecycle="running",
                message=f"开始侦查模块 {descriptor.name}",
            )
            started = time.time()
            result = None
            error: str | None = None
            try:
                result = await worker_agent.run(
                    self._build_worker_input(
                        task_id=task_id,
                        project_model=project_model,
                        descriptor=descriptor,
                    )
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error(
                    "[ReconExecutor] Module %s failed: %s",
                    descriptor.name,
                    exc,
                    exc_info=True,
                )
                error = str(exc)
            finally:
                worker_agent.reset_session_memory()

            normalized = self._normalize_result(
                descriptor=descriptor,
                result=result,
                error=error,
            )
            if normalized.success:
                await self._emit_agent_status(
                    worker_agent,
                    descriptor=descriptor,
                    lifecycle="completed",
                    message=f"模块 {descriptor.name} 侦查完成，等待 ReconAgent 汇总结果",
                )
            else:
                await self._emit_agent_status(
                    worker_agent,
                    descriptor=descriptor,
                    lifecycle="failed",
                    message=f"模块 {descriptor.name} 侦查失败：{normalized.error or 'unknown'}",
                )
            duration_ms = int((time.time() - started) * 1000)

            async with self.lock:
                state.recon_modules_processed += 1
                if not normalized.success:
                    state.recon_modules_failed += 1
                state.total_iterations += int(getattr(result, "iterations", 0) or 0)
                state.total_tokens += int(getattr(result, "tokens_used", 0) or 0)
                state.tool_calls += int(getattr(result, "tool_calls", 0) or 0)
                self.orchestrator._total_tokens = int(getattr(self.orchestrator, "_total_tokens", 0) or 0) + int(getattr(result, "tokens_used", 0) or 0)
                self.orchestrator._tool_calls = int(getattr(self.orchestrator, "_tool_calls", 0) or 0) + int(getattr(result, "tool_calls", 0) or 0)
                self.orchestrator._iteration = int(getattr(self.orchestrator, "_iteration", 0) or 0) + int(getattr(result, "iterations", 0) or 0)
                state.step_records.append(
                    WorkflowStepRecord(
                        phase=WorkflowPhase.RECON,
                        agent=f"recon_worker_{index}",
                        injected_context={
                            "module_id": descriptor.module_id,
                            "module_name": descriptor.name,
                            "module_type": descriptor.module_type,
                            "module_paths": descriptor.paths[:20],
                        },
                        success=normalized.success,
                        error=normalized.error,
                        findings_count=len(normalized.risk_points),
                        duration_ms=duration_ms,
                    )
                )
            return normalized

    async def run_parallel_recon(
        self,
        *,
        state: WorkflowState,
        task_id: str,
        project_model: ProjectReconModel,
    ) -> List[ReconModuleResult]:
        modules = list(project_model.module_descriptors)
        state.recon_modules_total = len(modules)
        if not modules:
            return []
        await self._emit_host_status(
            lifecycle="dispatching",
            message=(
                f"ReconAgent 已完成项目结构侦查，派发 {len(modules)} 个 ReconSubAgent 并等待统一回收结果"
            ),
            project_model=project_model,
        )

        if not self.enable_parallel or self.max_workers <= 1:
            results: List[ReconModuleResult] = []
            for index, descriptor in enumerate(modules):
                results.append(
                    await self._run_single_module(
                        index=index,
                        state=state,
                        task_id=task_id,
                        project_model=project_model,
                        descriptor=descriptor,
                    )
                )
            await self._emit_host_status(
                lifecycle="fan_in",
                message=f"ReconAgent 已收到全部 {len(results)} 个 ReconSubAgent 结果，开始统一汇总",
                project_model=project_model,
            )
            return results

        tasks = [
            asyncio.create_task(
                self._run_single_module(
                    index=index,
                    state=state,
                    task_id=task_id,
                    project_model=project_model,
                    descriptor=descriptor,
                ),
                name=f"recon_module_{descriptor.module_id}",
            )
            for index, descriptor in enumerate(modules)
        ]
        try:
            results = await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            for task in tasks:
                task.cancel()
            try:
                await asyncio.shield(asyncio.gather(*tasks, return_exceptions=True))
            except asyncio.CancelledError:
                pass
            raise
        normalized_results = [result for result in results if isinstance(result, ReconModuleResult)]
        await self._emit_host_status(
            lifecycle="fan_in",
            message=f"ReconAgent 已收到全部 {len(normalized_results)} 个 ReconSubAgent 结果，开始统一汇总",
            project_model=project_model,
        )
        return normalized_results
