from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.services.agent.skills.registry import get_skill_registry_service

from .base import AgentTool, ToolResult


class SkillLookupInput(BaseModel):
    query: Optional[str] = Field(
        default="",
        description="关键词检索（支持 skill_id/name/summary/alias）。",
    )
    skill_id: Optional[str] = Field(
        default=None,
        description="精确 skill_id 查询（如 using-superpowers@agents）。",
    )
    namespace: Optional[str] = Field(
        default=None,
        description="按命名空间过滤：agents/codex/superpowers/codex_home 等。",
    )
    limit: int = Field(default=8, ge=1, le=50, description="返回条数上限。")
    offset: int = Field(default=0, ge=0, description="分页偏移。")
    include_workflow: bool = Field(
        default=False,
        description="当指定 skill_id 时，是否返回 SKILL.md 工作流片段。",
    )


class SkillLookupTool(AgentTool):
    @property
    def name(self) -> str:
        return "skill_lookup"

    @property
    def description(self) -> str:
        return (
            "检索统一 Skill 仓库。可按关键词搜索技能，也可按 skill_id 获取详情。"
            "支持按 namespace 过滤，并在 include_workflow=true 时返回 SKILL.md 工作流片段。"
        )

    @property
    def args_schema(self):
        return SkillLookupInput

    async def _execute(
        self,
        query: str = "",
        skill_id: Optional[str] = None,
        namespace: Optional[str] = None,
        limit: int = 8,
        offset: int = 0,
        include_workflow: bool = False,
        **kwargs,
    ) -> ToolResult:
        _ = kwargs
        registry = get_skill_registry_service()
        if not registry.enabled:
            return ToolResult(
                success=True,
                data={
                    "mode": "disabled",
                    "enabled": False,
                    "message": "skill registry is disabled",
                    "items": [],
                    "total": 0,
                },
            )

        skill_id_text = str(skill_id or "").strip()
        if skill_id_text:
            detail = registry.get_detail(skill_id=skill_id_text, include_workflow=include_workflow)
            if detail is None:
                return ToolResult(
                    success=False,
                    error=f"skill_not_found:{skill_id_text}",
                    data={
                        "mode": "detail",
                        "skill_id": skill_id_text,
                        "message": "skill not found",
                    },
                )

            payload = dict(detail)
            if include_workflow:
                workflow_text = str(payload.get("workflow_content") or "")
                preview_max_chars = 8_000
                payload["workflow_preview"] = workflow_text[:preview_max_chars]
                payload["workflow_preview_truncated"] = (
                    len(workflow_text) > preview_max_chars
                    or bool(payload.get("workflow_truncated"))
                )
                payload.pop("workflow_content", None)

            return ToolResult(
                success=True,
                data={
                    "mode": "detail",
                    "skill": payload,
                },
            )

        result = registry.search(
            query=str(query or ""),
            namespace=namespace,
            limit=limit,
            offset=offset,
        )
        result["mode"] = "catalog"
        return ToolResult(success=True, data=result)


__all__ = ["SkillLookupTool"]

