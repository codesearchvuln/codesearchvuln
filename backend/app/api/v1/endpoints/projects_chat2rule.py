from __future__ import annotations

import json
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.v1.endpoints.projects_shared import _raise_if_project_hidden
from app.api.v1.endpoints.static_tasks_shared import (
    _get_user_config,
    _normalize_llm_config_error_message,
    _validate_user_llm_config,
    get_db,
)
from app.models.project import Project
from app.models.user import User
from app.schemas.chat2rule import (
    Chat2RuleChatRequest,
    Chat2RuleChatResponse,
    Chat2RuleSaveRequest,
    Chat2RuleSaveResponse,
)
from app.services.chat2rule.service import Chat2RuleService
from app.services.llm.service import LLMConfigError

router = APIRouter()


def _sse(payload: dict[str, Any]) -> str:
    return (
        f"event: {payload.get('type', 'message')}\n"
        f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    )


async def _load_zip_project(db: AsyncSession, project_id: str) -> Project:
    project = await db.get(Project, project_id)
    _raise_if_project_hidden(project)
    if project is None or project.source_type != "zip":
        raise HTTPException(status_code=400, detail="Chat2Rule 目前仅支持 ZIP 类型项目")
    return project


def _build_chat2rule_service(*, user_config: dict[str, Any] | None = None, engine_type: str) -> Chat2RuleService:
    try:
        return Chat2RuleService(user_config=user_config, engine_type=engine_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{project_id}/chat2rule/{engine_type}/chat",
    response_model=Chat2RuleChatResponse,
)
async def chat2rule_chat(
    project_id: str,
    engine_type: str,
    request: Chat2RuleChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Chat2RuleChatResponse:
    await _load_zip_project(db, project_id)

    user_config = await _get_user_config(db, current_user.id)
    try:
        _validate_user_llm_config(user_config)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=_normalize_llm_config_error_message(exc)) from exc

    service = _build_chat2rule_service(user_config=user_config, engine_type=engine_type)
    try:
        result = await service.generate_draft(
            project_id=project_id,
            messages=[message.model_dump() for message in request.messages],
            selections=[selection.model_dump() for selection in request.selections],
            draft_rule_text=request.draft_rule_text,
        )
        return Chat2RuleChatResponse(**result)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=_normalize_llm_config_error_message(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"生成规则草案失败: {exc}") from exc


@router.post("/{project_id}/chat2rule/{engine_type}/stream")
async def chat2rule_stream(
    project_id: str,
    engine_type: str,
    request: Chat2RuleChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> StreamingResponse:
    await _load_zip_project(db, project_id)

    user_config = await _get_user_config(db, current_user.id)
    try:
        _validate_user_llm_config(user_config)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=_normalize_llm_config_error_message(exc)) from exc

    service = _build_chat2rule_service(user_config=user_config, engine_type=engine_type)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for event in service.stream_draft(
                project_id=project_id,
                messages=[message.model_dump() for message in request.messages],
                selections=[selection.model_dump() for selection in request.selections],
                draft_rule_text=request.draft_rule_text,
            ):
                yield _sse(event)
        except LLMConfigError as exc:
            yield _sse(
                {
                    "type": "error",
                    "message": _normalize_llm_config_error_message(exc),
                }
            )
        except ValueError as exc:
            yield _sse({"type": "error", "message": str(exc)})
        except Exception as exc:
            yield _sse({"type": "error", "message": f"流式生成规则失败: {exc}"})
        finally:
            yield _sse(
                {
                    "type": "done",
                    "engine_type": service.engine_type,
                    "save_supported": service.save_supported,
                }
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/{project_id}/chat2rule/{engine_type}/save",
    response_model=Chat2RuleSaveResponse,
)
async def chat2rule_save(
    project_id: str,
    engine_type: str,
    request: Chat2RuleSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Chat2RuleSaveResponse:
    del current_user
    await _load_zip_project(db, project_id)

    service = _build_chat2rule_service(engine_type=engine_type)
    try:
        result = await service.save_rule(
            db=db,
            rule_text=request.rule_text,
            title=request.title,
            description=request.description,
        )
        return Chat2RuleSaveResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"保存规则失败: {exc}") from exc


# compatibility aliases
chat2rule_opengrep_chat = chat2rule_chat
chat2rule_opengrep_save = chat2rule_save
