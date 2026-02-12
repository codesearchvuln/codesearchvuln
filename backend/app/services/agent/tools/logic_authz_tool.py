from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.agent.logic.authz_rules import AuthzRuleEngine
from .base import AgentTool, ToolResult


class LogicAuthzAnalysisInput(BaseModel):
    file_path: Optional[str] = Field(default=None, description="目标文件路径")
    line_start: Optional[int] = Field(default=None, description="目标行号")
    vulnerability_type: Optional[str] = Field(default=None, description="漏洞类型")


class LogicAuthzAnalysisTool(AgentTool):
    """Graph-rule authz/idor analysis without compile dependency."""

    def __init__(self, project_root: str, target_files: Optional[List[str]] = None):
        super().__init__()
        self.engine = AuthzRuleEngine(project_root=project_root, target_files=target_files)

    @property
    def name(self) -> str:
        return "logic_authz_analysis"

    @property
    def description(self) -> str:
        return (
            "逻辑漏洞图规则分析：检查 route/handler 到资源访问路径上的认证、授权、"
            "对象级权限(IDOR)与作用域一致性。"
        )

    @property
    def args_schema(self):
        return LogicAuthzAnalysisInput

    async def _execute(
        self,
        file_path: Optional[str] = None,
        line_start: Optional[int] = None,
        vulnerability_type: Optional[str] = None,
        **kwargs,
    ) -> ToolResult:
        if file_path and line_start:
            result = self.engine.analyze_finding(
                {
                    "file_path": file_path,
                    "line_start": line_start,
                    "vulnerability_type": vulnerability_type,
                }
            )
        else:
            result = self.engine.analyze_project()

        return ToolResult(
            success=True,
            data=result,
            metadata={"engine": "logic_graph"},
        )


__all__ = ["LogicAuthzAnalysisTool"]
