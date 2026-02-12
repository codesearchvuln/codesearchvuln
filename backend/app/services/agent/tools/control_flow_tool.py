from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.services.agent.flow.pipeline import FlowEvidencePipeline
from .base import AgentTool, ToolResult


class ControlFlowAnalysisLightInput(BaseModel):
    file_path: str = Field(description="目标文件路径")
    line_start: int = Field(default=1, description="目标起始行")
    line_end: Optional[int] = Field(default=None, description="目标结束行")
    severity: Optional[str] = Field(default=None, description="漏洞严重度")
    confidence: Optional[float] = Field(default=None, description="漏洞置信度 0-1")
    entry_points: Optional[List[str]] = Field(default=None, description="候选入口函数")


class ControlFlowAnalysisLightTool(AgentTool):
    """Lightweight control/data-flow analysis based on tree-sitter + code2flow."""

    def __init__(self, project_root: str, target_files: Optional[List[str]] = None):
        super().__init__()
        self.project_root = project_root
        self.target_files = target_files or []
        self.pipeline = FlowEvidencePipeline(
            project_root=project_root,
            target_files=target_files,
        )

    @property
    def name(self) -> str:
        return "controlflow_analysis_light"

    @property
    def description(self) -> str:
        return (
            "轻量控制流/数据流分析：基于 tree-sitter 和 code2flow 推断从入口到漏洞位置的调用链、"
            "控制条件和可达性分值。适用于不完整代码和不可编译项目。"
        )

    @property
    def args_schema(self):
        return ControlFlowAnalysisLightInput

    async def _execute(
        self,
        file_path: str,
        line_start: int = 1,
        line_end: Optional[int] = None,
        severity: Optional[str] = None,
        confidence: Optional[float] = None,
        entry_points: Optional[List[str]] = None,
        **kwargs,
    ) -> ToolResult:
        finding: Dict[str, Any] = {
            "file_path": file_path,
            "line_start": line_start,
            "line_end": line_end or line_start,
            "severity": severity,
            "confidence": confidence,
            "entry_points": entry_points or [],
        }

        evidence = await self.pipeline.analyze_finding(finding)
        return ToolResult(
            success=True,
            data=evidence,
            metadata={
                "engine": "ts_code2flow",
                "file_path": file_path,
            },
        )


__all__ = ["ControlFlowAnalysisLightTool"]
