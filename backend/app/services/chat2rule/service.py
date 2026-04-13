from __future__ import annotations

import json
import re
import zipfile
from typing import Any, AsyncGenerator, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.v1.endpoints.projects_shared import (
    _validate_zip_file_path,
    load_project_zip,
)
from app.db.static_finding_paths import collect_zip_relative_paths, resolve_zip_member_path
from app.models.opengrep import OpengrepRule
from app.services.chat2rule.context import (
    Chat2RuleSelection,
    normalize_chat2rule_selections,
)
from app.services.chat2rule.engines import get_chat2rule_prompt_engine
from app.services.chat2rule.types import Chat2RuleSnippet
from app.services.llm.service import LLMService
from app.services.rule import validate_generic_rule

_MAX_SELECTION_LINES = 160
_MAX_SELECTION_COUNT = 8
_LANGUAGE_BY_EXTENSION = {
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".php": "php",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".scala": "scala",
    ".swift": "swift",
    ".ts": "typescript",
    ".tsx": "typescript",
}

class Chat2RuleService:
    def __init__(
        self,
        *,
        user_config: Optional[dict[str, Any]] = None,
        engine_type: str = "opengrep",
    ):
        self._llm_service = LLMService(user_config=user_config)
        self._prompt_engine = get_chat2rule_prompt_engine(engine_type)

    async def generate_opengrep_draft(
        self,
        *,
        project_id: str,
        messages: Sequence[dict[str, str]],
        selections: Sequence[dict[str, Any]],
        draft_rule_text: Optional[str] = None,
    ) -> dict[str, Any]:
        llm_messages = await self._prepare_generation_context(
            project_id=project_id,
            messages=messages,
            selections=selections,
            draft_rule_text=draft_rule_text,
        )
        llm_response = await self._llm_service.chat_completion_raw(
            llm_messages,
            temperature=0.1,
        )
        payload = self._parse_model_payload(llm_response.get("content") or "")
        return await self._build_final_response(
            payload,
            usage=self._normalize_usage(llm_response.get("usage")),
        )

    async def stream_opengrep_draft(
        self,
        *,
        project_id: str,
        messages: Sequence[dict[str, str]],
        selections: Sequence[dict[str, Any]],
        draft_rule_text: Optional[str] = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        llm_messages = await self._prepare_generation_context(
            project_id=project_id,
            messages=messages,
            selections=selections,
            draft_rule_text=draft_rule_text,
        )

        yield {"type": "started"}

        accumulated = ""
        latest_partial = {
            "assistant_message": "",
            "rule_title": "",
            "explanation": "",
            "rule_text": "",
        }

        async for chunk in self._llm_service.chat_completion_stream(
            llm_messages,
            temperature=0.1,
        ):
            chunk_type = str(chunk.get("type") or "").strip().lower()

            if chunk_type == "token":
                token_text = str(chunk.get("content") or "")
                accumulated = str(chunk.get("accumulated") or (accumulated + token_text))
                partial = self._extract_partial_payload(accumulated)
                if partial != latest_partial:
                    latest_partial = partial
                    yield {"type": "draft", **partial}
                continue

            if chunk_type == "done":
                final_content = str(chunk.get("content") or accumulated).strip()
                if not final_content:
                    raise ValueError("模型返回了空响应")
                payload = self._parse_model_payload(final_content)
                result = await self._build_final_response(
                    payload,
                    usage=self._normalize_usage(chunk.get("usage")),
                )
                yield {"type": "result", **result}
                return

            if chunk_type == "error":
                error_message = (
                    str(chunk.get("message") or chunk.get("error") or "").strip()
                    or "流式生成失败"
                )
                raise ValueError(error_message)

        if not accumulated.strip():
            raise ValueError("流式生成未返回任何内容")

        payload = self._parse_model_payload(accumulated)
        result = await self._build_final_response(payload, usage={})
        yield {"type": "result", **result}

    async def save_opengrep_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        validation = await validate_generic_rule(rule_text)
        validation_status = validation.get("validation") or {}
        if not validation_status.get("is_valid"):
            raise ValueError(str(validation_status.get("message") or "规则校验失败"))

        normalized_rule_text = str(validation.get("rule_yaml") or rule_text).strip()
        parsed_rule = validation.get("rule") or {}
        if not isinstance(parsed_rule, dict):
            raise ValueError("无法解析规则内容")

        existing_rule = await db.execute(
            select(OpengrepRule).where(OpengrepRule.pattern_yaml == normalized_rule_text)
        )
        if existing_rule.scalar_one_or_none():
            raise ValueError("相同内容的 Opengrep 规则已存在")

        rule_name = (title or parsed_rule.get("id") or parsed_rule.get("message") or "").strip()
        if not rule_name:
            rule_name = "chat2rule-opengrep-rule"
        unique_name = await self._get_unique_rule_name(db, rule_name)

        languages = parsed_rule.get("languages")
        if isinstance(languages, list) and languages:
            language = str(languages[0]).strip() or "generic"
        else:
            language = "generic"

        severity = str(parsed_rule.get("severity") or "WARNING").strip().upper() or "WARNING"
        if severity not in {"ERROR", "WARNING", "INFO"}:
            severity = "WARNING"

        new_rule = OpengrepRule(
            name=unique_name,
            pattern_yaml=normalized_rule_text,
            language=language,
            severity=severity,
            confidence=None,
            description=(description or parsed_rule.get("message") or unique_name),
            cwe=self._extract_cwe(parsed_rule),
            source="json",
            patch=None,
            correct=True,
            is_active=True,
        )
        db.add(new_rule)
        await db.commit()
        await db.refresh(new_rule)

        return {
            "rule_id": new_rule.id,
            "name": new_rule.name,
            "language": new_rule.language,
            "severity": new_rule.severity,
            "message": "规则已保存到 OpengrepRule",
        }

    async def _prepare_generation_context(
        self,
        *,
        project_id: str,
        messages: Sequence[dict[str, str]],
        selections: Sequence[dict[str, Any]],
        draft_rule_text: Optional[str],
    ) -> list[dict[str, str]]:
        normalized_messages = self._normalize_messages(messages)
        if not normalized_messages:
            raise ValueError("至少需要一条用户消息")

        normalized_selections = normalize_chat2rule_selections(selections)
        if not normalized_selections:
            raise ValueError("至少需要一个代码片段")

        snippets = await self._load_selection_snippets(project_id, normalized_selections)
        return self._prompt_engine.build_llm_messages(
            snippets=snippets,
            messages=normalized_messages,
            draft_rule_text=draft_rule_text,
        )

    async def _build_final_response(
        self,
        payload: dict[str, Any],
        *,
        usage: dict[str, int],
    ) -> dict[str, Any]:
        raw_rule_text = str(payload.get("rule_text") or "").strip()
        if not raw_rule_text:
            raise ValueError("模型没有返回可用的规则草案")

        validation = await validate_generic_rule(raw_rule_text)
        validation_result = self._build_validation_result(validation)
        rule_text = validation_result.get("normalized_rule_text") or raw_rule_text
        metadata = validation_result.get("metadata") or {}
        rule_title = (
            str(payload.get("rule_title") or payload.get("title") or "").strip()
            or str(metadata.get("id") or "").strip()
            or "Chat2Rule Opengrep Draft"
        )

        assistant_message = str(payload.get("assistant_message") or "").strip()
        if not assistant_message:
            assistant_message = "我根据当前代码片段生成了一版 Opengrep 规则草案。"

        explanation = str(payload.get("explanation") or "").strip()
        if not explanation:
            explanation = "这版规则基于当前对话和代码片段自动生成。"

        return {
            "assistant_message": assistant_message,
            "rule_title": rule_title,
            "rule_text": rule_text,
            "explanation": explanation,
            "validation_result": validation_result,
            "usage": usage,
        }

    async def _load_selection_snippets(
        self,
        project_id: str,
        selections: Sequence[Chat2RuleSelection],
    ) -> list[Chat2RuleSnippet]:
        zip_path = await load_project_zip(project_id)
        if not zip_path:
            raise ValueError("项目 ZIP 文件不存在")

        with zipfile.ZipFile(zip_path, "r") as archive:
            known_relative_paths = collect_zip_relative_paths(str(zip_path))
            snippets: list[Chat2RuleSnippet] = []
            for selection in selections[:_MAX_SELECTION_COUNT]:
                snippet = self._read_selection_from_zip(
                    archive=archive,
                    known_relative_paths=known_relative_paths,
                    selection=selection,
                )
                snippets.append(snippet)
            return snippets

    def _read_selection_from_zip(
        self,
        *,
        archive: zipfile.ZipFile,
        known_relative_paths: set[str],
        selection: Chat2RuleSelection,
    ) -> Chat2RuleSnippet:
        validated_path = _validate_zip_file_path(selection.file_path)
        resolved_zip_path = resolve_zip_member_path(validated_path, known_relative_paths)
        if not resolved_zip_path:
            raise ValueError(f"代码片段对应文件不存在: {validated_path}")

        raw_bytes = archive.read(resolved_zip_path)
        content = self._decode_text(raw_bytes)
        all_lines = content.splitlines()
        if not all_lines:
            raise ValueError(f"文件内容为空: {resolved_zip_path}")

        start_line = min(max(1, selection.start_line), len(all_lines))
        end_line = min(max(start_line, selection.end_line), len(all_lines))
        truncated = False
        if end_line - start_line + 1 > _MAX_SELECTION_LINES:
            end_line = start_line + _MAX_SELECTION_LINES - 1
            truncated = True

        selected_lines = all_lines[start_line - 1 : end_line]
        numbered_code = "\n".join(
            f"{line_number:>4} | {line}"
            for line_number, line in enumerate(selected_lines, start=start_line)
        )

        return Chat2RuleSnippet(
            file_path=resolved_zip_path,
            start_line=start_line,
            end_line=end_line,
            language=self._infer_language(resolved_zip_path),
            code=numbered_code,
            truncated=truncated,
        )

    def _normalize_messages(self, messages: Sequence[dict[str, str]]) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        for message in messages:
            role = str(message.get("role") or "").strip().lower()
            content = str(message.get("content") or "").strip()
            if role not in {"user", "assistant"} or not content:
                continue
            normalized.append({"role": role, "content": content})
        return normalized

    def _parse_model_payload(self, content: str) -> dict[str, Any]:
        payload_text = content.strip()
        if not payload_text:
            raise ValueError("模型返回了空响应")

        candidates = [payload_text]
        fenced_match = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", payload_text)
        if fenced_match:
            candidates.append(fenced_match.group(1))

        object_match = re.search(r"(\{[\s\S]*\})", payload_text)
        if object_match:
            candidates.append(object_match.group(1))

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed

        raise ValueError("无法解析模型返回的 JSON 结构")

    def _extract_partial_payload(self, text: str) -> dict[str, str]:
        title = self._extract_partial_json_string_value(text, "title")
        if not title:
            title = self._extract_partial_json_string_value(text, "rule_title")
        return {
            "assistant_message": self._extract_partial_json_string_value(text, "assistant_message"),
            "rule_title": title,
            "explanation": self._extract_partial_json_string_value(text, "explanation"),
            "rule_text": self._extract_partial_json_string_value(text, "rule_text"),
        }

    def _extract_partial_json_string_value(self, text: str, key: str) -> str:
        marker = f'"{key}"'
        start = text.find(marker)
        if start == -1:
            return ""

        colon = text.find(":", start + len(marker))
        if colon == -1:
            return ""

        index = colon + 1
        while index < len(text) and text[index] in " \t\r\n":
            index += 1
        if index >= len(text) or text[index] != '"':
            return ""
        index += 1

        chars: list[str] = []
        escape_next = False
        while index < len(text):
            char = text[index]
            if escape_next:
                if char == "n":
                    chars.append("\n")
                elif char == "r":
                    chars.append("\r")
                elif char == "t":
                    chars.append("\t")
                elif char == "u" and index + 4 < len(text):
                    codepoint = text[index + 1 : index + 5]
                    if re.fullmatch(r"[0-9a-fA-F]{4}", codepoint):
                        chars.append(chr(int(codepoint, 16)))
                        index += 4
                    else:
                        chars.append(char)
                else:
                    chars.append(char)
                escape_next = False
                index += 1
                continue

            if char == "\\":
                escape_next = True
                index += 1
                continue
            if char == '"':
                return "".join(chars)
            chars.append(char)
            index += 1

        return "".join(chars)

    def _build_validation_result(self, validation: dict[str, Any]) -> dict[str, Any]:
        validation_status = validation.get("validation") or {}
        is_valid = bool(validation_status.get("is_valid"))
        message = str(validation_status.get("message") or "").strip()
        parsed_rule = validation.get("rule") if isinstance(validation.get("rule"), dict) else None
        metadata = None
        if parsed_rule:
            metadata = {
                "id": parsed_rule.get("id"),
                "severity": parsed_rule.get("severity"),
                "languages": parsed_rule.get("languages"),
                "message": parsed_rule.get("message"),
            }

        return {
            "valid": is_valid,
            "errors": [] if is_valid else ([message] if message else ["规则校验失败"]),
            "normalized_rule_text": validation.get("rule_yaml"),
            "metadata": metadata,
        }

    def _normalize_usage(self, usage: Any) -> dict[str, int]:
        if not isinstance(usage, dict):
            return {}
        normalized: dict[str, int] = {}
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            value = usage.get(key)
            if isinstance(value, int):
                normalized[key] = value
        return normalized

    def _decode_text(self, payload: bytes) -> str:
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                return payload.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("文件不是可读取的文本内容")

    def _infer_language(self, file_path: str) -> str:
        suffix = ""
        if "." in file_path:
            suffix = file_path[file_path.rfind(".") :].lower()
        return _LANGUAGE_BY_EXTENSION.get(suffix, "generic")

    def _extract_cwe(self, rule: dict[str, Any]) -> Optional[list[str]]:
        metadata = rule.get("metadata")
        if not isinstance(metadata, dict):
            return None

        raw_cwe = metadata.get("cwe")
        if isinstance(raw_cwe, list):
            values = [str(item).strip() for item in raw_cwe if str(item).strip()]
            return values or None
        if isinstance(raw_cwe, str) and raw_cwe.strip():
            return [raw_cwe.strip()]
        return None

    async def _get_unique_rule_name(self, db: AsyncSession, base_name: str) -> str:
        candidate = base_name.strip() or "chat2rule-opengrep-rule"
        result = await db.execute(select(OpengrepRule).where(OpengrepRule.name == candidate))
        if not result.scalar_one_or_none():
            return candidate

        counter = 1
        while True:
            next_candidate = f"{candidate}_{counter}"
            result = await db.execute(
                select(OpengrepRule).where(OpengrepRule.name == next_candidate)
            )
            if not result.scalar_one_or_none():
                return next_candidate
            counter += 1
