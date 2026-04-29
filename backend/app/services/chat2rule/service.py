from __future__ import annotations

import json
import re
import uuid
import zipfile
from typing import Any, AsyncGenerator, Optional, Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.v1.endpoints.projects_shared import (
    _validate_zip_file_path,
    load_project_zip,
)
from app.db.static_finding_paths import collect_zip_relative_paths, resolve_zip_member_path
from app.models.gitleaks import GitleaksRule
from app.models.opengrep import OpengrepRule
from app.models.pmd import PmdRuleConfig
from app.models.yasa import YasaRuleConfig
from app.services.chat2rule.context import (
    Chat2RuleSelection,
    normalize_chat2rule_selections,
)
from app.services.chat2rule.engines import get_chat2rule_prompt_engine
from app.services.chat2rule.types import Chat2RuleSnippet
from app.services.llm.service import LLMService
from app.services.pmd_rulesets import parse_pmd_ruleset_xml
from app.services.rule import validate_generic_rule
from app.services.yasa_rules_snapshot import load_yasa_checker_catalog

_MAX_SELECTION_LINES = 160
_MAX_SELECTION_COUNT = 8
_ALLOWED_ENGINES = {"opengrep", "gitleaks", "bandit", "phpstan", "pmd", "yasa"}
_SAVE_SUPPORTED_ENGINES = {"opengrep", "gitleaks", "pmd", "yasa"}
_YASA_SUPPORTED_LANGUAGES = {"java", "golang", "typescript", "python"}
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
        normalized_engine_type = str(engine_type or "").strip().lower() or "opengrep"
        if normalized_engine_type not in _ALLOWED_ENGINES:
            raise ValueError(f"不支持的 Chat2Rule 引擎: {engine_type}")

        self._engine_type = normalized_engine_type
        self._llm_service = LLMService(user_config=user_config)
        self._prompt_engine = get_chat2rule_prompt_engine(normalized_engine_type)

    @property
    def engine_type(self) -> str:
        return self._engine_type

    @property
    def save_supported(self) -> bool:
        return self._engine_type in _SAVE_SUPPORTED_ENGINES

    async def generate_draft(
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

    async def stream_draft(
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

        yield {
            "type": "started",
            "engine_type": self.engine_type,
            "save_supported": self.save_supported,
        }

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
                    yield {
                        "type": "draft",
                        "engine_type": self.engine_type,
                        "save_supported": self.save_supported,
                        **partial,
                    }
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

    async def save_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        if not self.save_supported:
            raise ValueError(f"当前引擎 {self.engine_type} 不支持直接保存自定义规则")

        if self.engine_type == "opengrep":
            payload = await self._save_opengrep_rule(
                db=db,
                rule_text=rule_text,
                title=title,
                description=description,
            )
        elif self.engine_type == "gitleaks":
            payload = await self._save_gitleaks_rule(
                db=db,
                rule_text=rule_text,
                title=title,
                description=description,
            )
        elif self.engine_type == "pmd":
            payload = await self._save_pmd_rule(
                db=db,
                rule_text=rule_text,
                title=title,
                description=description,
            )
        elif self.engine_type == "yasa":
            payload = await self._save_yasa_rule(
                db=db,
                rule_text=rule_text,
                title=title,
                description=description,
            )
        else:
            raise ValueError(f"当前引擎 {self.engine_type} 不支持直接保存自定义规则")

        return {
            **payload,
            "engine_type": self.engine_type,
            "save_supported": self.save_supported,
        }

    # compatibility wrappers
    async def generate_opengrep_draft(
        self,
        *,
        project_id: str,
        messages: Sequence[dict[str, str]],
        selections: Sequence[dict[str, Any]],
        draft_rule_text: Optional[str] = None,
    ) -> dict[str, Any]:
        return await self.generate_draft(
            project_id=project_id,
            messages=messages,
            selections=selections,
            draft_rule_text=draft_rule_text,
        )

    async def stream_opengrep_draft(
        self,
        *,
        project_id: str,
        messages: Sequence[dict[str, str]],
        selections: Sequence[dict[str, Any]],
        draft_rule_text: Optional[str] = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        async for event in self.stream_draft(
            project_id=project_id,
            messages=messages,
            selections=selections,
            draft_rule_text=draft_rule_text,
        ):
            yield event

    async def save_opengrep_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        return await self._save_opengrep_rule(
            db=db,
            rule_text=rule_text,
            title=title,
            description=description,
        )

    async def _save_opengrep_rule(
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
        unique_name = await self._get_unique_opengrep_rule_name(db, rule_name)

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

    async def _save_gitleaks_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        parsed = self._parse_json_rule_text(rule_text)
        validation_message, normalized = self._validate_gitleaks_rule(parsed)
        if validation_message:
            raise ValueError(validation_message)

        rule_name = str(title or normalized.get("name") or "").strip() or "chat2rule-gitleaks-rule"
        rule_id = str(normalized.get("rule_id") or "").strip() or f"chat2rule-{uuid.uuid4().hex[:10]}"

        new_rule = GitleaksRule(
            name=rule_name,
            description=str(description or normalized.get("description") or "").strip() or None,
            rule_id=rule_id,
            secret_group=int(normalized.get("secret_group") or 0),
            regex=str(normalized.get("regex") or "").strip(),
            keywords=self._normalize_string_list(normalized.get("keywords")),
            path=str(normalized.get("path") or "").strip() or None,
            tags=self._normalize_string_list(normalized.get("tags")),
            entropy=self._to_optional_float(normalized.get("entropy")),
            is_active=True,
            source="custom",
        )
        db.add(new_rule)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ValueError("规则名称或规则ID已存在") from exc
        await db.refresh(new_rule)

        return {
            "rule_id": new_rule.id,
            "name": new_rule.name,
            "language": "generic",
            "severity": "N/A",
            "message": "规则已保存到 GitleaksRule",
        }

    async def _save_pmd_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        try:
            parsed_payload = parse_pmd_ruleset_xml(rule_text)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

        normalized_name = (
            str(title or parsed_payload.get("ruleset_name") or "").strip()
            or "chat2rule-pmd-ruleset"
        )
        filename = f"chat2rule-pmd-{uuid.uuid4().hex[:8]}.xml"

        row = PmdRuleConfig(
            name=normalized_name,
            description=str(description or parsed_payload.get("description") or "").strip() or None,
            filename=filename,
            xml_content=rule_text.strip(),
            is_active=True,
            created_by=None,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        languages = parsed_payload.get("languages") if isinstance(parsed_payload, dict) else []
        language = "generic"
        if isinstance(languages, list) and languages:
            language = str(languages[0] or "").strip() or "generic"

        return {
            "rule_id": row.id,
            "name": row.name,
            "language": language,
            "severity": "N/A",
            "message": "规则已保存到 PMD Rule Config",
        }

    async def _save_yasa_rule(
        self,
        *,
        db: AsyncSession,
        rule_text: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        payload = self._parse_json_rule_text(rule_text)
        checker_ids = self._parse_yasa_checker_ids(payload)
        if not checker_ids:
            raise ValueError("rule-config 缺少 checkerIds（必须为非空数组）")

        catalog = load_yasa_checker_catalog()
        unknown_checker_ids = [
            checker_id for checker_id in checker_ids if checker_id not in catalog["checker_ids"]
        ]
        if unknown_checker_ids:
            raise ValueError("未知 checkerIds: " + ",".join(unknown_checker_ids))

        checker_pack_ids = self._normalize_string_list(payload.get("checkerPackIds"))
        unknown_checker_pack_ids = [
            checker_pack_id
            for checker_pack_id in checker_pack_ids
            if checker_pack_id not in catalog["checker_pack_ids"]
        ]
        if unknown_checker_pack_ids:
            raise ValueError("未知 checkerPackIds: " + ",".join(unknown_checker_pack_ids))

        normalized_name = str(title or payload.get("name") or "").strip() or "chat2rule-yasa-config"
        normalized_language = str(payload.get("language") or "").strip().lower() or "python"
        if normalized_language not in _YASA_SUPPORTED_LANGUAGES:
            raise ValueError("language 无效，YASA 仅支持 java/golang/typescript/python")

        row = YasaRuleConfig(
            name=normalized_name,
            description=str(description or payload.get("description") or "").strip() or None,
            language=normalized_language,
            checker_pack_ids=",".join(checker_pack_ids) if checker_pack_ids else None,
            checker_ids=",".join(checker_ids),
            rule_config_json=json.dumps(payload, ensure_ascii=False),
            is_active=True,
            source="custom",
            created_by=None,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        return {
            "rule_id": row.id,
            "name": row.name,
            "language": row.language,
            "severity": "N/A",
            "message": "规则已保存到 YASA Rule Config",
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

        validation_result = await self._build_validation_result(raw_rule_text)
        rule_text = validation_result.get("normalized_rule_text") or raw_rule_text
        metadata = validation_result.get("metadata") or {}
        rule_title = (
            str(payload.get("rule_title") or payload.get("title") or "").strip()
            or str(metadata.get("id") or "").strip()
            or f"Chat2Rule {self.engine_type.capitalize()} Draft"
        )

        assistant_message = str(payload.get("assistant_message") or "").strip()
        if not assistant_message:
            assistant_message = f"我根据当前代码片段生成了一版 {self.engine_type} 规则草案。"

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
            "engine_type": self.engine_type,
            "save_supported": self.save_supported,
        }

    async def _build_validation_result(self, raw_rule_text: str) -> dict[str, Any]:
        if self.engine_type == "opengrep":
            validation = await validate_generic_rule(raw_rule_text)
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

        if self.engine_type == "gitleaks":
            try:
                parsed = self._parse_json_rule_text(raw_rule_text)
                error_message, normalized = self._validate_gitleaks_rule(parsed)
            except ValueError as exc:
                error_message, normalized = str(exc), {}
            is_valid = not error_message
            normalized_text = (
                json.dumps(normalized, ensure_ascii=False, indent=2)
                if is_valid
                else raw_rule_text
            )
            metadata = {
                "id": normalized.get("rule_id"),
                "severity": "N/A",
                "languages": None,
                "message": normalized.get("description") or normalized.get("name"),
            }
            return {
                "valid": is_valid,
                "errors": [] if is_valid else [error_message or "规则校验失败"],
                "normalized_rule_text": normalized_text,
                "metadata": metadata,
            }

        if self.engine_type == "pmd":
            try:
                parsed = parse_pmd_ruleset_xml(raw_rule_text)
                is_valid = True
                error_message = ""
            except ValueError as exc:
                parsed = {}
                is_valid = False
                error_message = str(exc)
            metadata = {
                "id": parsed.get("ruleset_name") if isinstance(parsed, dict) else None,
                "severity": "N/A",
                "languages": parsed.get("languages") if isinstance(parsed, dict) else None,
                "message": parsed.get("description") if isinstance(parsed, dict) else None,
            }
            return {
                "valid": is_valid,
                "errors": [] if is_valid else [error_message or "规则校验失败"],
                "normalized_rule_text": raw_rule_text.strip(),
                "metadata": metadata,
            }

        if self.engine_type == "yasa":
            try:
                parsed = self._parse_json_rule_text(raw_rule_text)
                checker_ids = self._parse_yasa_checker_ids(parsed)
                if not checker_ids:
                    raise ValueError("rule-config 缺少 checkerIds（必须为非空数组）")
                is_valid = True
                error_message = ""
            except ValueError as exc:
                parsed = {}
                is_valid = False
                error_message = str(exc)
            metadata = {
                "id": parsed.get("name") if isinstance(parsed, dict) else None,
                "severity": "N/A",
                "languages": [parsed.get("language")]
                if isinstance(parsed, dict) and parsed.get("language")
                else None,
                "message": parsed.get("description") if isinstance(parsed, dict) else None,
            }
            normalized_text = (
                json.dumps(parsed, ensure_ascii=False, indent=2)
                if is_valid
                else raw_rule_text
            )
            return {
                "valid": is_valid,
                "errors": [] if is_valid else [error_message or "规则校验失败"],
                "normalized_rule_text": normalized_text,
                "metadata": metadata,
            }

        # bandit/phpstan: generation-only draft validation
        return {
            "valid": True,
            "errors": [],
            "normalized_rule_text": raw_rule_text,
            "metadata": {
                "id": None,
                "severity": "N/A",
                "languages": None,
                "message": f"{self.engine_type} 草案",
            },
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

    async def _get_unique_opengrep_rule_name(self, db: AsyncSession, base_name: str) -> str:
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

    def _parse_json_rule_text(self, rule_text: str) -> dict[str, Any]:
        text = str(rule_text or "").strip()
        if not text:
            raise ValueError("规则文本不能为空")

        candidates = [text]
        fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text)
        if fenced:
            candidates.append(fenced.group(1))

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed

        raise ValueError("规则文本必须是合法 JSON 对象")

    def _validate_gitleaks_rule(self, payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        normalized = dict(payload or {})
        required_fields = ["name", "rule_id", "regex"]
        missing = [
            field
            for field in required_fields
            if not str(normalized.get(field) or "").strip()
        ]
        if missing:
            return ("缺少必填字段: " + ", ".join(missing), normalized)

        regex_text = str(normalized.get("regex") or "").strip()
        try:
            re.compile(regex_text)
        except re.error as exc:
            return (f"regex 校验失败: {exc}", normalized)

        if "secret_group" in normalized:
            try:
                normalized["secret_group"] = int(normalized.get("secret_group") or 0)
            except (TypeError, ValueError):
                return ("secret_group 必须是整数", normalized)

        if "keywords" in normalized:
            normalized["keywords"] = self._normalize_string_list(normalized.get("keywords"))
        if "tags" in normalized:
            normalized["tags"] = self._normalize_string_list(normalized.get("tags"))

        entropy = self._to_optional_float(normalized.get("entropy"))
        if entropy is not None:
            normalized["entropy"] = entropy

        return ("", normalized)

    def _parse_yasa_checker_ids(self, payload: dict[str, Any]) -> list[str]:
        checker_ids = payload.get("checkerIds")
        if isinstance(checker_ids, list):
            return self._normalize_string_list(checker_ids)

        if isinstance(checker_ids, str) and checker_ids.strip():
            return self._normalize_string_list(checker_ids.split(","))

        return []

    def _normalize_string_list(self, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            raw_items = [item.strip() for item in value.split(",")]
        elif isinstance(value, list):
            raw_items = [str(item).strip() for item in value]
        else:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for item in raw_items:
            if not item or item in seen:
                continue
            seen.add(item)
            normalized.append(item)
        return normalized

    def _to_optional_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        try:
            return float(text)
        except (TypeError, ValueError):
            return None
