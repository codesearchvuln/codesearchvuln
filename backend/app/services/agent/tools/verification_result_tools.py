"""
Verification Agent 结果保存工具

供 Verification Agent 在验证完成后调用，将最终 findings
通过注入的持久化回调保存到数据库，避免依赖 Orchestrator
侧的批量写入而产生的延迟或遗漏。

设计原则：
- 工具构造时注入 save_callback（与队列工具注入 queue_service 的方式一致）
- 工具本身无 DB/ORM 依赖，持久化逻辑由调用方提供
- 支持多次调用（幂等保护由回调内部负责）
- 提供内存暂存缓冲，即使回调未注入也可缓存结果供 Orchestrator 读取
"""

import hashlib
import json
import logging
import re
from typing import Any, Callable, Coroutine, Dict, List, Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .base import AgentTool, ToolResult

logger = logging.getLogger(__name__)

_UPDATE_ALLOWED_TOP_LEVEL_FIELDS = {
    "file_path",
    "line_start",
    "line_end",
    "function_name",
    "title",
    "vulnerability_type",
    "severity",
    "description",
    "code_snippet",
    "source",
    "sink",
    "suggestion",
}
_UPDATE_ALLOWED_VERIFICATION_FIELDS = {
    "localization_status",
    "function_trigger_flow",
    "verification_evidence",
    "verification_details",
    "evidence",
    "verdict",
    "authenticity",
    "confidence",
    "reachability",
}
_UPDATE_FORBIDDEN_FIELDS = {
    "finding_identity",
    "verdict",
    "confidence",
    "reachability",
    "id",
    "task_id",
    "fingerprint",
}

_ALLOWED_VERDICTS = {"confirmed", "likely", "uncertain", "false_positive"}
_ALLOWED_REACHABILITY = {"reachable", "likely_reachable", "unknown", "unreachable"}
_SOURCE_SINK_GATE_METADATA_KEYS = {
    "sink_reachable",
    "upstream_call_chain",
    "sink_trigger_condition",
}


def _normalize_save_verdict(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in _ALLOWED_VERDICTS:
        return text
    return ""


def _normalize_save_status(value: Any, verdict: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    if text in {"verified", "true_positive", "exists", "vulnerable", "confirmed"}:
        return "verified"
    if text in {"likely", "uncertain", "unknown", "needs_review", "needs-review"}:
        return "likely"
    if text in {"false_positive", "false-positive", "not_vulnerable", "not_exists", "non_vuln"}:
        return "false_positive"

    normalized_verdict = _normalize_save_verdict(verdict)
    if normalized_verdict == "confirmed":
        return "verified"
    if normalized_verdict in {"likely", "uncertain"}:
        return "likely"
    if normalized_verdict == "false_positive":
        return "false_positive"
    return "likely"


def _has_meaningful_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def _pick_first_meaningful(*values: Any) -> Any:
    for value in values:
        if _has_meaningful_value(value):
            return value
    return None


def _normalize_text_list(value: Any) -> Optional[List[str]]:
    if value in (None, "", [], ()):
        return None
    if isinstance(value, list):
        normalized = [str(item).strip() for item in value if str(item).strip()]
        return normalized or None
    text = str(value).strip()
    return [text] if text else None


def _merge_optional_dicts(*values: Any) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for value in values:
        if not isinstance(value, dict):
            continue
        for key, item in value.items():
            if item is None:
                continue
            merged[str(key)] = item
    return merged


def build_finding_identity(task_id: str, finding: Dict[str, Any]) -> str:
    file_path = str(finding.get("file_path") or finding.get("file") or "").strip().lower()
    vuln_type = str(finding.get("vulnerability_type") or finding.get("type") or "").strip().lower()
    title = str(finding.get("title") or "").strip().lower()
    function_name = str(finding.get("function_name") or "").strip().lower()
    try:
        line_start = int(finding.get("line_start") or finding.get("line") or 0)
    except Exception:
        line_start = 0
    raw = "|".join(
        [
            str(task_id or "").strip(),
            file_path,
            str(line_start),
            vuln_type,
            title,
            function_name,
        ]
    )
    digest = hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()
    return f"fid:{digest}"


def ensure_finding_identity(task_id: str, finding: Dict[str, Any]) -> str:
    if not isinstance(finding, dict):
        return ""
    existing = str(
        finding.get("finding_identity")
        or ((finding.get("finding_metadata") or {}).get("finding_identity") if isinstance(finding.get("finding_metadata"), dict) else "")
        or ((finding.get("verification_result") or {}).get("finding_identity") if isinstance(finding.get("verification_result"), dict) else "")
        or ""
    ).strip()
    identity = existing or build_finding_identity(task_id, finding)
    finding["finding_identity"] = identity
    metadata = dict(finding.get("finding_metadata") or {})
    metadata["finding_identity"] = identity
    finding["finding_metadata"] = metadata
    verification_result = dict(finding.get("verification_result") or {})
    verification_result["finding_identity"] = identity
    finding["verification_result"] = verification_result
    return identity


def merge_finding_patch(base_finding: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base_finding or {})
    for key, value in (patch or {}).items():
        if key == "verification_result" and isinstance(value, dict):
            vr = dict(merged.get("verification_result") or {})
            for vr_key, vr_value in value.items():
                if vr_value is not None:
                    vr[vr_key] = vr_value
            merged["verification_result"] = vr
            continue
        if value is not None:
            merged[key] = value
    return merged


_DEDUP_PREFERRED_TEXT_FIELDS = {
    "title",
    "description",
    "code_snippet",
    "code_context",
    "source",
    "sink",
    "suggestion",
    "fix_code",
    "fix_description",
    "report",
    "vulnerability_report",
    "verification_evidence",
    "verification_details",
    "evidence",
    "verification_method",
    "poc_code",
    "poc_description",
    "final_conclusion",
}
_DEDUP_MERGE_LIST_FIELDS = {
    "dataflow_path",
    "taint_flow",
    "evidence_chain",
    "missing_checks",
    "poc_steps",
    "function_trigger_flow",
}
_DEDUP_PLACEHOLDER_TOKENS = (
    "auto_generated",
    "auto synthesized",
    "暂无",
    "unknown",
    "n/a",
)
_DEDUP_PLACEHOLDER_FUNCTION_NAMES = {
    "<function_not_localized>",
    "<unknown>",
    "unknown",
}


def _normalize_dedup_file_path(value: Any) -> str:
    file_path = str(value or "").strip().replace("\\", "/").lower()
    if file_path and ":" in file_path:
        prefix, suffix = file_path.split(":", 1)
        token = suffix.split()[0] if suffix.split() else ""
        if token.isdigit():
            file_path = prefix.strip()
    return file_path


def _normalize_dedup_line(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except Exception:
        return 0


def _normalize_dedup_function_name(value: Any) -> str:
    function_name = str(value or "").strip().lower()
    if not function_name:
        return ""
    if function_name in _DEDUP_PLACEHOLDER_FUNCTION_NAMES:
        return ""
    if function_name.startswith("<function_"):
        return ""
    return function_name


def _text_signal_score(value: Any) -> tuple[int, int]:
    text = str(value or "").strip()
    if not text:
        return (-1, -1)
    lowered = text.lower()
    placeholder_penalty = -500 if any(token in lowered for token in _DEDUP_PLACEHOLDER_TOKENS) else 0
    return (placeholder_penalty + len(text), len(text))


def _pick_more_informative_text(current: Any, incoming: Any) -> Any:
    current_text = str(current or "").strip()
    incoming_text = str(incoming or "").strip()
    if not incoming_text:
        return current
    if not current_text:
        return incoming
    if _text_signal_score(incoming_text) > _text_signal_score(current_text):
        return incoming
    return current


def _merge_text_list_values(current: Any, incoming: Any) -> Any:
    merged: List[str] = []
    for value in (current, incoming):
        if isinstance(value, list):
            candidates = value
        elif value in (None, "", [], ()):
            candidates = []
        else:
            candidates = [value]
        for item in candidates:
            normalized = str(item).strip()
            if normalized and normalized not in merged:
                merged.append(normalized)
    return merged or None


def _finding_richness_score(finding: Dict[str, Any]) -> int:
    if not isinstance(finding, dict):
        return -1

    verification_payload = (
        finding.get("verification_result")
        if isinstance(finding.get("verification_result"), dict)
        else {}
    )
    score = 0
    if str(finding.get("finding_identity") or "").strip():
        score += 40
    if str(
        finding.get("verification_fingerprint")
        or verification_payload.get("verification_fingerprint")
        or ""
    ).strip():
        score += 30
    if _normalize_dedup_file_path(finding.get("file_path") or finding.get("file")):
        score += 12
    if _normalize_dedup_line(finding.get("line_start") or finding.get("line")) > 0:
        score += 10
    if _normalize_dedup_function_name(finding.get("function_name")):
        score += 10

    status = _normalize_save_status(
        finding.get("status") or verification_payload.get("status"),
        finding.get("verdict") or verification_payload.get("verdict"),
    )
    if status == "verified":
        score += 12
    elif status == "likely":
        score += 8
    elif status == "false_positive":
        score += 6

    for key in (
        "description",
        "code_snippet",
        "suggestion",
        "poc_code",
        "report",
        "vulnerability_report",
    ):
        if str(finding.get(key) or "").strip():
            score += 4
    for key in ("verification_evidence", "verification_details", "evidence"):
        value = finding.get(key) or verification_payload.get(key)
        score += max(_text_signal_score(value)[0], 0) // 40
    if isinstance(finding.get("dataflow_path"), list) and finding.get("dataflow_path"):
        score += min(10, len(finding["dataflow_path"]))
    if isinstance(verification_payload, dict):
        score += len(
            [
                key
                for key in (
                    "verification_evidence",
                    "verification_details",
                    "reachability",
                    "function_trigger_flow",
                    "known_facts",
                    "inferences_to_verify",
                    "final_conclusion",
                )
                if verification_payload.get(key) not in (None, "", [], {})
            ]
        ) * 2
    return score


def _merge_duplicate_dict_fields(primary: Dict[str, Any], secondary: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(primary or {})
    for key, value in (secondary or {}).items():
        if key == "verification_result" and isinstance(value, dict):
            existing_payload = (
                merged.get("verification_result")
                if isinstance(merged.get("verification_result"), dict)
                else {}
            )
            merged["verification_result"] = _merge_duplicate_dict_fields(
                existing_payload,
                value,
            )
            continue
        if key in _DEDUP_MERGE_LIST_FIELDS:
            merged_list = _merge_text_list_values(merged.get(key), value)
            if merged_list:
                merged[key] = merged_list
            continue
        if key in _DEDUP_PREFERRED_TEXT_FIELDS:
            preferred = _pick_more_informative_text(merged.get(key), value)
            if preferred not in (None, ""):
                merged[key] = preferred
            continue
        if key == "finding_metadata" and isinstance(value, dict):
            existing_metadata = (
                merged.get("finding_metadata")
                if isinstance(merged.get("finding_metadata"), dict)
                else {}
            )
            metadata = dict(existing_metadata)
            metadata.update(value)
            if metadata:
                merged["finding_metadata"] = metadata
            continue
        if key == "report":
            report_value = _pick_more_informative_text(merged.get("report"), value)
            if report_value not in (None, ""):
                merged["report"] = report_value
            continue
        if key == "vulnerability_report":
            report_value = _pick_more_informative_text(
                merged.get("vulnerability_report"),
                value,
            )
            if report_value not in (None, ""):
                merged["vulnerability_report"] = report_value
            continue
        if merged.get(key) in (None, "", [], {}):
            merged[key] = value
    return merged


def build_verification_dedup_aliases(finding: Dict[str, Any]) -> List[str]:
    if not isinstance(finding, dict):
        return []

    verification_payload = (
        finding.get("verification_result")
        if isinstance(finding.get("verification_result"), dict)
        else {}
    )
    aliases: List[str] = []
    finding_identity = str(
        finding.get("finding_identity")
        or verification_payload.get("finding_identity")
        or ""
    ).strip()
    if finding_identity:
        aliases.append(f"identity:{finding_identity}")

    verification_fingerprint = str(
        finding.get("verification_fingerprint")
        or verification_payload.get("verification_fingerprint")
        or ""
    ).strip().lower()
    if verification_fingerprint:
        aliases.append(f"verification_fingerprint:{verification_fingerprint}")

    file_path = _normalize_dedup_file_path(finding.get("file_path") or finding.get("file"))
    vulnerability_type = str(
        finding.get("vulnerability_type") or finding.get("type") or ""
    ).strip().lower()
    line_start = _normalize_dedup_line(finding.get("line_start") or finding.get("line"))
    function_name = _normalize_dedup_function_name(finding.get("function_name"))
    title = str(finding.get("title") or "").strip().lower()

    if file_path and vulnerability_type and function_name:
        aliases.append(f"function:{file_path}|{vulnerability_type}|{function_name}")
    if file_path and vulnerability_type and line_start > 0:
        aliases.append(f"line:{file_path}|{vulnerability_type}|{line_start}")
    if file_path and vulnerability_type and title:
        aliases.append(f"title:{file_path}|{vulnerability_type}|{title}")
    if not aliases and vulnerability_type and title:
        aliases.append(f"fallback:{vulnerability_type}|{title}")
    return aliases


def merge_duplicate_findings(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    existing_copy = dict(existing or {})
    incoming_copy = dict(incoming or {})
    if _finding_richness_score(incoming_copy) > _finding_richness_score(existing_copy):
        primary, secondary = incoming_copy, existing_copy
    else:
        primary, secondary = existing_copy, incoming_copy

    merged = _merge_duplicate_dict_fields(primary, secondary)
    report_value = _pick_more_informative_text(
        merged.get("vulnerability_report") or merged.get("report"),
        secondary.get("vulnerability_report") or secondary.get("report"),
    )
    if report_value not in (None, ""):
        merged["report"] = report_value
        merged["vulnerability_report"] = report_value
    return merged


def deduplicate_verification_findings(
    findings: List[Dict[str, Any]],
    task_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    alias_to_index: Dict[str, int] = {}

    for raw_finding in findings or []:
        if not isinstance(raw_finding, dict):
            continue
        finding = dict(raw_finding)
        if task_id:
            ensure_finding_identity(task_id, finding)
        aliases = build_verification_dedup_aliases(finding)
        existing_index = next(
            (alias_to_index[alias] for alias in aliases if alias in alias_to_index),
            None,
        )

        if existing_index is None:
            deduped.append(finding)
            existing_index = len(deduped) - 1
        else:
            deduped[existing_index] = merge_duplicate_findings(
                deduped[existing_index],
                finding,
            )

        if task_id:
            ensure_finding_identity(task_id, deduped[existing_index])
        for alias in build_verification_dedup_aliases(deduped[existing_index]):
            alias_to_index[alias] = existing_index

    return deduped


def validate_finding_update_patch(fields_to_update: Dict[str, Any]) -> tuple[bool, Optional[str], Dict[str, Any], List[str]]:
    if not isinstance(fields_to_update, dict) or not fields_to_update:
        return False, "fields_to_update 不能为空", {}, []

    sanitized: Dict[str, Any] = {}
    updated_fields: List[str] = []
    verification_patch: Dict[str, Any] = {}

    for key, value in fields_to_update.items():
        key_text = str(key or "").strip()
        if not key_text:
            continue
        if key_text in _UPDATE_FORBIDDEN_FIELDS:
            return False, f"禁止更新字段: {key_text}", {}, []
        if key_text.startswith("verification_result."):
            nested_key = key_text.split(".", 1)[1]
            if nested_key not in _UPDATE_ALLOWED_VERIFICATION_FIELDS:
                return False, f"禁止更新字段: {key_text}", {}, []
            verification_patch[nested_key] = value
            updated_fields.append(key_text)
            continue
        if key_text == "verification_result":
            if not isinstance(value, dict) or not value:
                return False, "verification_result 必须是非空对象", {}, []
            for nested_key, nested_value in value.items():
                nested_text = str(nested_key or "").strip()
                if nested_text not in _UPDATE_ALLOWED_VERIFICATION_FIELDS:
                    return False, f"禁止更新字段: verification_result.{nested_text}", {}, []
                verification_patch[nested_text] = nested_value
                updated_fields.append(f"verification_result.{nested_text}")
            continue
        if key_text not in _UPDATE_ALLOWED_TOP_LEVEL_FIELDS:
            return False, f"禁止更新字段: {key_text}", {}, []
        sanitized[key_text] = value
        updated_fields.append(key_text)

    if verification_patch:
        sanitized["verification_result"] = verification_patch
    if not sanitized:
        return False, "fields_to_update 不包含可更新字段", {}, []
    return True, None, sanitized, updated_fields


class VerificationResultModel(BaseModel):
    """验证结果的标准化嵌套结构 - 每条 finding 的 verification_result 必须符合此模型"""

    verdict: Literal["confirmed", "likely", "uncertain", "false_positive"] = Field(
        ...,
        description=(
            "真实性判定。必须为以下之一：\n"
            "  - confirmed: 已通过多重验证确认，confidence >= 0.8\n"
            "  - likely: 初步验证表明漏洞很可能存在，0.7 <= confidence < 0.8\n"
            "  - uncertain: 信息不足，无法明确判定真假，0.3 <= confidence < 0.7\n"
            "  - false_positive: 经验证为误报或不存在，confidence < 0.3"
        ),
    )
    
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="置信度，必须是 [0.0, 1.0] 范围内的浮点数（不能为字符串）",
    )
    
    reachability: Literal["reachable", "likely_reachable", "unknown", "unreachable"] = Field(
        ...,
        description=(
            "代码路径可达性判定。必须为以下之一：\n"
            "  - reachable: 确认代码路径从外部输入可达\n"
            "  - likely_reachable: 很可能可达，但需进一步验证\n"
            "  - unknown: 无法确定可达性\n"
            "  - unreachable: 代码路径无法从外部触发"
        ),
    )
    
    verification_evidence: str = Field(
        ...,
        min_length=10,
        description=(
            "验证证据，必须包含：\n"
            "  1. 使用的验证方法（fuzzing/static_analysis/symbols/dynamic/other）\n"
            "  2. 关键代码片段或执行输出\n"
            "  3. 漏洞存在或不存在的理由\n"
            "最少 10 个字符。"
        ),
    )
    
    # 可选字段
    poc_plan: Optional[str] = Field(
        default=None,
        description="非武器化 PoC 思路或复现步骤说明（仅用于文档，不能是可直接运行的代码）",
    )
    
    code_snippet: Optional[str] = Field(
        default=None,
        description="相关的代码片段，用于上下文说明",
    )
    
    suggestion: Optional[str] = Field(
        default=None,
        description="修复建议或防御措施",
    )
    
    function_trigger_flow: Optional[List[str]] = Field(
        default=None,
        description="函数触发链或调用链，描述从入口点到漏洞的执行路径",
    )
    
    code_context: Optional[str] = Field(
        default=None,
        description="更广泛的代码上下文，帮助理解漏洞背景",
    )
    
    localization_status: Optional[str] = Field(
        default=None,
        description="代码定位状态：'success'（成功定位函数）、'failed'（定位失败）、'partial'（部分定位）",
    )

    @field_validator("verdict")
    @classmethod
    def validate_verdict(cls, v):
        """确保 verdict 是允许的值"""
        allowed = {"confirmed", "likely", "uncertain", "false_positive"}
        if v not in allowed:
            raise ValueError(f"verdict 必须为 {allowed} 之一，得到: {v}")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        """确保 confidence 是浮点数且在范围内"""
        if isinstance(v, str):
            raise ValueError(f"confidence 必须是 float 类型，不能是字符串: {v}")
        if not isinstance(v, (int, float)):
            raise ValueError(f"confidence 必须是数值类型，得到: {type(v).__name__}")
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"confidence 必须在 [0.0, 1.0] 范围内，得到: {v}")
        return float(v)

    @field_validator("reachability")
    @classmethod
    def validate_reachability(cls, v):
        """确保 reachability 是允许的值"""
        allowed = {"reachable", "likely_reachable", "unknown", "unreachable"}
        if v not in allowed:
            raise ValueError(f"reachability 必须为 {allowed} 之一，得到: {v}")
        return v

    @field_validator("verification_evidence")
    @classmethod
    def validate_evidence(cls, v):
        """确保 verification_evidence 非空且足够长"""
        if not v or len(v.strip()) < 10:
            raise ValueError("verification_evidence 必须至少 10 个字符，且不能为空")
        return v


class AgentFindingModel(BaseModel):
    """Agent 发现的漏洞的标准化结构 - 每条 finding 必须符合此模型"""

    finding_identity: Optional[str] = Field(
        default=None,
        description="漏洞稳定身份标识。若未提供，将在保存时按 task_id + 原始定位信息生成。",
    )

    file_path: str = Field(
        ...,
        min_length=1,
        description="完整文件路径（从项目根目录的相对路径或绝对路径）",
    )
    
    line_start: int = Field(
        ...,
        ge=1,
        description="代码起始行号（从 1 开始）",
    )
    
    line_end: Optional[int] = Field(
        default=None,
        ge=1,
        description="代码结束行号（可选，如果不提供则默认等于 line_start）",
    )
    
    title: str = Field(
        ...,
        min_length=5,
        max_length=200,
        description="漏洞标题（5-200 字符）",
    )
    
    vulnerability_type: str = Field(
        ...,
        min_length=1,
        description="漏洞类型（如 sql_injection、xss、command_injection 等）",
    )
    
    severity: Literal["critical", "high", "medium", "low", "info"] = Field(
        ...,
        description="严重程度：critical, high, medium, low, info",
    )
    
    cwe_id: Optional[str] = Field(
        default=None,
        description="CWE 编号，格式：CWE-123 或 CWE-123, CWE-456（可选）",
    )
    
    verification_result: VerificationResultModel = Field(
        ...,
        description="验证结果，必须包含 verdict、confidence、reachability、verification_evidence 等必填字段",
    )
    
    function_name: str = Field(
        ...,
        min_length=1,
        description="函数名称（必填）。无法精确定位时可使用语义化占位符（如 <function_at_line_120>）",
    )
    
    description: Optional[str] = Field(
        default=None,
        description="详细描述",
    )

    status: Optional[Literal["verified", "likely", "false_positive", "uncertain"]] = Field(
        default=None,
        description="展示状态。推荐使用 verified|likely|false_positive；传 uncertain 时会在保存时归一化为 likely。",
    )

    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="顶层置信度，若提供会与 verification_result.confidence 对齐。",
    )

    source: Optional[str] = Field(default=None, description="Source 描述")
    sink: Optional[str] = Field(default=None, description="Sink 描述")
    dataflow_path: Optional[List[str]] = Field(default=None, description="数据流路径")
    cvss_score: Optional[float] = Field(default=None, description="CVSS3.1 分数")
    cvss_vector: Optional[str] = Field(default=None, description="CVSS3.1 向量")
    poc_code: Optional[str] = Field(default=None, description="Fuzzing Harness / PoC 代码")
    suggestion: Optional[str] = Field(default=None, description="修复建议")
    code_snippet: Optional[str] = Field(default=None, description="漏洞代码片段")
    code_context: Optional[str] = Field(default=None, description="漏洞上下文代码")
    report: Optional[str] = Field(default=None, description="漏洞详情 Markdown 报告")
    
    @field_validator("line_end", mode="before")
    @classmethod
    def set_line_end_default(cls, v, info):
        """如果 line_end 未提供，默认设为 line_start"""
        if v is None and "line_start" in info.data:
            return info.data["line_start"]
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        """确保 severity 是允许的值"""
        allowed = {"critical", "high", "medium", "low", "info"}
        if v not in allowed:
            raise ValueError(f"severity 必须为 {allowed} 之一，得到: {v}")
        return v

    @field_validator("function_name", mode="before")
    @classmethod
    def validate_function_name(cls, v):
        """确保 function_name 非空字符串"""
        if v is None:
            raise ValueError("function_name 为必填字段，不能为空")
        text = str(v).strip()
        if not text:
            raise ValueError("function_name 不能为空字符串")
        return text

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status_if_present(cls, v):
        if v is None:
            return v
        normalized = _normalize_save_status(v, None)
        return normalized or None

    @field_validator("cwe_id", mode="before")
    @classmethod
    def validate_cwe_id_if_present(cls, v):
        """如果存在 cwe_id 字段，验证其格式"""
        if v is None:
            return v
        if not isinstance(v, str):
            raise ValueError(f"cwe_id 必须是字符串或 null，得到: {type(v).__name__}")
        # 允许格式：CWE-123、CWE-123, CWE-456 等
        pattern = r"^CWE-\d+(\s*,\s*CWE-\d+)*$|^$"
        if not re.match(pattern, v, re.IGNORECASE):
            raise ValueError(f"cwe_id 必须符合格式 CWE-123 或 CWE-123, CWE-456 等，得到: {v}")
        return v


class SaveVerificationResultsInput(BaseModel):
    """保存验证结果工具的输入参数 - 严密参数约束"""

    findings: List[AgentFindingModel] = Field(
        ...,
        min_length=1,
        description=(
            "已验证的 findings 列表（至少 1 条）。每条 finding 必须是有效的 AgentFindingModel，\n"
            "包含以下必填字段：\n"
            "  - file_path: 文件路径\n"
            "  - line_start: 起始行号（>= 1）\n"
            "  - function_name: 函数名称（必填，无法精确定位时使用语义化占位符）\n"
            "  - title: 发现标题（5-200 字符）\n"
            "  - vulnerability_type: 漏洞类型\n"
            "  - severity: 严重程度（critical|high|medium|low|info）\n"
            "  - verification_result: 嵌套的 VerificationResultModel 对象\n"
            "推荐额外提供以下展示字段：\n"
            "  - status: 展示状态（verified|likely|false_positive；legacy uncertain 会归一化为 likely）\n"
            "  - description/source/sink/dataflow_path: 用于漏洞详情展示\n"
            "  - poc_code/suggestion: 用于 PoC 与修复建议展示\n"
            "  - cvss_score/cvss_vector: 用于风险评分展示\n"
            "\n"
            "每条 finding 的 verification_result 必须包含：\n"
            "  - verdict: 真实性判定（confirmed|likely|uncertain|false_positive）\n"
            "  - confidence: 置信度 [0.0-1.0 浮点数]\n"
            "  - reachability: 可达性（reachable|likely_reachable|unknown|unreachable）\n"
            "  - verification_evidence: 验证证据（至少 10 字符）\n"
            "\n"
            "false_positive 会被标记为 false_positive；likely/uncertain 会统一落到 likely 状态，方便后续展示。"
        ),
    )
    
    summary: Optional[str] = Field(
        default=None,
        description="可选的摘要信息，记录本轮验证的整体结论（用于日志）。建议包含：总数、verdict分布等。",
    )
    
    strict_mode: Optional[bool] = Field(
        default=True,
        description=(
            "严格模式（默认 True）：任何单个 finding 的验证失败都会导致整个工具调用失败。\n"
            "非严格模式（False）：验证失败的 findings 会被过滤并记录在 validation_errors 中。"
        ),
    )

    @field_validator("findings", mode="before")
    @classmethod
    def coerce_findings_to_models(cls, v):
        """尝试将原始 Dict findings 转换为 AgentFindingModel"""
        if not isinstance(v, list):
            raise ValueError("findings 必须是列表")

        def _normalize_reachability(verdict: Optional[str], reachability: Any) -> str:
            text = str(reachability or "").strip().lower()
            if text in _ALLOWED_REACHABILITY:
                return text
            if verdict == "confirmed":
                return "reachable"
            if verdict == "likely":
                return "likely_reachable"
            if verdict == "false_positive":
                return "unreachable"
            return "unknown"

        def _normalize_verification_payload(item: Dict[str, Any], idx: int) -> Dict[str, Any]:
            payload = dict(item)
            payload["severity"] = str(payload.get("severity") or "medium").strip().lower()
            if payload.get("line_end") is None and payload.get("line_start") is not None:
                payload["line_end"] = payload.get("line_start")

            vr = payload.get("verification_result")
            if not isinstance(vr, dict):
                vr = {}

            verdict = _normalize_save_verdict(
                vr.get("verdict")
                or payload.get("verdict")
                or payload.get("authenticity")
                or "likely"
            )
            if not verdict:
                verdict = "likely"

            confidence_raw = vr.get("confidence", payload.get("confidence", 0.5))
            try:
                confidence = max(0.0, min(float(confidence_raw), 1.0))
            except Exception:
                confidence = 0.5

            reachability = _normalize_reachability(verdict, vr.get("reachability") or payload.get("reachability"))

            evidence = (
                vr.get("verification_evidence")
                or vr.get("verification_details")
                or payload.get("verification_evidence")
                or payload.get("verification_details")
            )
            evidence_text = str(evidence or "").strip()
            if len(evidence_text) < 10:
                evidence_text = (
                    f"auto_normalized_evidence: verdict={verdict}; "
                    f"confidence={confidence:.2f}; finding_index={idx}"
                )

            normalized_status = _normalize_save_status(
                vr.get("status") or payload.get("status"),
                verdict,
            )
            if normalized_status == "likely" and verdict == "uncertain":
                verdict = "likely"

            payload["verification_result"] = {
                **vr,
                "verdict": verdict,
                "confidence": confidence,
                "reachability": reachability,
                "verification_evidence": evidence_text,
                "status": normalized_status,
            }
            payload["verdict"] = verdict
            payload["confidence"] = confidence
            payload["reachability"] = reachability
            payload["verification_evidence"] = evidence_text
            payload["status"] = normalized_status

            function_name = str(payload.get("function_name") or "").strip()
            if not function_name:
                title_text = str(payload.get("title") or "")
                title_match = re.search(r"中([A-Za-z_][A-Za-z0-9_]*)函数", title_text)
                if title_match:
                    function_name = title_match.group(1).strip()
            if not function_name:
                reachability_target = vr.get("reachability_target") if isinstance(vr, dict) else None
                if isinstance(reachability_target, dict):
                    function_name = str(reachability_target.get("function") or "").strip()
            if not function_name:
                line_value = payload.get("line_start")
                function_name = f"<function_at_line_{line_value}>" if line_value else "<function_not_localized>"
            payload["function_name"] = function_name
            return payload
        
        result = []
        for idx, item in enumerate(v):
            if isinstance(item, dict):
                try:
                    normalized_item = _normalize_verification_payload(item, idx)
                    result.append(AgentFindingModel(**normalized_item))
                except Exception as e:
                    raise ValueError(f"findings[{idx}] 验证失败: {str(e)}")
            elif isinstance(item, AgentFindingModel):
                result.append(item)
            else:
                raise ValueError(f"findings[{idx}] 必须是 dict 或 AgentFindingModel，得到: {type(item).__name__}")
        
        return result


class SaveVerificationResultCallInput(BaseModel):
    """单条 save_verification_result 调用的兼容输入模型。"""

    model_config = ConfigDict(extra="forbid")

    findings: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="兼容旧链路：批量 findings 列表。",
    )
    finding: Optional[Dict[str, Any]] = Field(
        default=None,
        description="兼容输入：完整的单个 finding 对象（可内含 verification_result）。",
    )
    verification_result: Optional[Dict[str, Any]] = Field(
        default=None,
        description="兼容输入：嵌套 verification_result 对象。",
    )

    finding_identity: Optional[str] = None
    file_path: Optional[str] = None
    file: Optional[str] = None
    path: Optional[str] = None
    line_start: Optional[int] = None
    line: Optional[int] = None
    line_end: Optional[int] = None
    function_name: Optional[str] = None
    title: Optional[str] = None
    display_title: Optional[str] = None
    vulnerability_type: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    sink: Optional[str] = None
    dataflow_path: Optional[Any] = None
    is_verified: Optional[bool] = None
    cvss_score: Optional[Any] = None
    cvss_vector: Optional[str] = None
    poc_code: Optional[str] = None
    poc: Optional[Dict[str, Any]] = None
    poc_plan: Optional[str] = None
    suggestion: Optional[str] = None
    verdict: Optional[str] = None
    authenticity: Optional[str] = None
    confidence: Optional[Any] = None
    ai_confidence: Optional[Any] = None
    status: Optional[str] = None
    reachability: Optional[str] = None
    verification_evidence: Optional[str] = None
    verification_details: Optional[str] = None
    evidence: Optional[str] = None
    cwe_id: Optional[str] = None
    code_snippet: Optional[str] = None
    function_trigger_flow: Optional[Any] = None
    code_context: Optional[str] = None
    localization_status: Optional[str] = None
    report: Optional[str] = None
    vulnerability_report: Optional[str] = None
    flow: Optional[Dict[str, Any]] = None
    reachability_target: Optional[Dict[str, Any]] = None
    context_start_line: Optional[int] = None
    context_end_line: Optional[int] = None
    function_range_validation: Optional[Dict[str, Any]] = None
    validation_reason: Optional[str] = None
    localization_failure_trace: Optional[Any] = None
    known_facts: Optional[Any] = None
    inferences_to_verify: Optional[Any] = None
    final_conclusion: Optional[Any] = None
    verification_todo_id: Optional[str] = None
    verification_fingerprint: Optional[str] = None
    source_sink_authenticity_passed: Optional[bool] = None
    source_sink_authenticity_errors: Optional[Any] = None
    finding_metadata: Optional[Dict[str, Any]] = None
    attacker_flow: Optional[str] = None
    taint_flow: Optional[Any] = None
    evidence_chain: Optional[Any] = None
    missing_checks: Optional[Any] = None
    fix_code: Optional[str] = None
    fix_description: Optional[str] = None
    verification_method: Optional[str] = None
    sink_reachable: Optional[Any] = None
    upstream_call_chain: Optional[Any] = None
    sink_trigger_condition: Optional[str] = None


class UpdateVulnerabilityFindingInput(BaseModel):
    finding_identity: str = Field(
        ...,
        min_length=8,
        description="要修正的漏洞稳定身份标识。",
    )
    fields_to_update: Dict[str, Any] = Field(
        ...,
        description=(
            "需要更新的字段。允许顶层字段："
            "file_path,line_start,line_end,function_name,title,vulnerability_type,"
            "severity,description,code_snippet,source,sink,suggestion；"
            "允许嵌套字段：verification_result.localization_status,"
            "verification_result.function_trigger_flow,"
            "verification_result.verification_evidence,"
            "verification_result.verification_details,"
            "verification_result.evidence,"
            "verification_result.verdict,"
            "verification_result.authenticity,"
            "verification_result.confidence,"
            "verification_result.reachability"
        ),
    )
    update_reason: str = Field(
        ...,
        min_length=5,
        description="本次修正原因，例如“Report阶段核对源码后修正行号”。",
    )

    @field_validator("fields_to_update")
    @classmethod
    def validate_patch(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        ok, error, sanitized, _ = validate_finding_update_patch(value)
        if not ok:
            raise ValueError(error or "非法更新字段")
        return sanitized


class SaveVerificationResultTool(AgentTool):
    """
    Verification Agent 专用：将单个验证结果持久化保存到数据库。

    核心责任：
    1. **强制验证参数** - 通过 Pydantic 模型确保 finding 的数据质量
    2. **前置校验** - 在工具执行前检查必填字段和类型
    3. **详细错误报告** - 告知 Agent 哪些字段缺失或错误，便于纠正
    4. **支持多状态** - 持久化 confirmed、likely、false_positive，并兼容 legacy uncertain 输入

    调用时机：每验证完一个漏洞，确定其 verdict / confidence / reachability /
    verification_evidence 后，立即调用此工具完成持久化，
    避免结果仅停留在内存中而丢失。

    返回：
    - saved: 是否成功保存（布尔值）
    - save_status: saved / duplicate_skipped / buffered / not_saved / failed
    - message: 人类可读的结果描述
    """

    def __init__(
        self,
        task_id: str,
        save_callback: Optional[Callable[[List[Dict[str, Any]]], Coroutine[Any, Any, int]]] = None,
        defer_persistence: bool = False,
    ):
        """
        Args:
            task_id: 当前审计任务 ID，用于日志追踪
            save_callback: 异步持久化回调 async (findings: List[Dict]) -> int
                           返回实际保存的条数。若为 None，结果仅写入内存缓冲。
            defer_persistence: 为 True 时只缓冲结果，不在工具执行时立即入库；
                               由 Workflow 在 Verification 结束后统一去重并批量持久化。
        """
        super().__init__()
        self.task_id = task_id
        self._save_callback = save_callback
        self._defer_persistence = bool(defer_persistence)
        # 内存缓冲：即使没有注入回调也能暂存结果
        self._buffered_findings: List[Dict[str, Any]] = []
        self._saved_count: Optional[int] = None  # None 表示尚未调用过
        self._seen_payload_digests: set[str] = set()

    # ------------------------------------------------------------------ #
    # AgentTool 必须实现的属性
    # ------------------------------------------------------------------ #

    @property
    def name(self) -> str:
        return "save_verification_result"

    @property
    def description(self) -> str:
        return """将单个验证结果持久化保存到数据库。

在验证完一个漏洞后立即调用，避免结果只存在会话内存中而丢失。

【文档要求的必填字段（由 LLM 提供）】
- vulnerability_type: 漏洞类型（建议使用 CWE 编码或规范化类型）
- severity: 严重程度（critical|high|medium|low|info）
- cvss_score: CVSS3.1 分数（可为 null）
- cvss_vector: CVSS3.1 向量（可为 null）
- title: 漏洞标题
- description: 漏洞描述
- file_path: 漏洞文件路径
- line_start: 起始行号（>= 1）
- line_end: 结束行号（默认等于 line_start）
- function_name: 函数名称（无法定位时可用占位符）
- source: Source 描述
- sink: Sink 描述
- dataflow_path: 数据流路径（数组）
- status: 漏洞展示状态（verified|likely|false_positive；legacy uncertain 会自动归一化为 likely）
- poc_code: Fuzzing Harness / PoC 代码
- suggestion: 修复建议
- confidence: 置信度 [0.0, 1.0]
- verification_evidence: 验证证据（必须包含验证方法、关键代码片段或执行输出、漏洞存在与否的理由）
- reachability: 可达性（reachable|likely_reachable|unreachable）

【由 Python 程序补全】
- task_id, is_verified, code_snippet, report

兼容字段（旧链路可继续传）：
- verdict, reachability, cwe_id, poc_plan, code_context, localization_status
- finding / verification_result / findings（历史嵌套结构）
- flow, reachability_target, verification_todo_id, verification_fingerprint
- finding_metadata, attacker_flow, taint_flow, evidence_chain, missing_checks

返回值：
- saved: 是否成功保存
- save_status: saved / duplicate_skipped / buffered / not_saved / failed
- message: 结果描述"""

    @property
    def args_schema(self):
        return SaveVerificationResultCallInput

    # ------------------------------------------------------------------ #
    # 公开属性：供 Orchestrator / 持久化兜底逻辑读取
    # ------------------------------------------------------------------ #

    @property
    def buffered_findings(self) -> List[Dict[str, Any]]:
        """返回最近一次（或历次）累积的 findings 缓冲（无论是否已持久化）"""
        return list(self._buffered_findings)

    @property
    def is_saved(self) -> bool:
        """返回是否已通过回调成功持久化（累计保存条数 > 0）。"""
        return int(self._saved_count or 0) > 0

    @property
    def saved_count(self) -> Optional[int]:
        return self._saved_count

    @property
    def defer_persistence(self) -> bool:
        return self._defer_persistence

    def clone_for_worker(self) -> "SaveVerificationResultTool":
        """
        为并行 worker 克隆独立工具实例，保留持久化回调但隔离缓冲状态。
        """
        cloned = super().clone_for_worker()
        if isinstance(cloned, SaveVerificationResultTool):
            cloned._buffered_findings = []
            cloned._saved_count = None
            cloned._seen_payload_digests = set()
        return cloned

    @staticmethod
    def _build_payload_digest(findings: List[Dict[str, Any]]) -> str:
        try:
            normalized = json.dumps(findings, ensure_ascii=False, sort_keys=True, default=str)
        except Exception:
            normalized = str(findings)
        return hashlib.sha1(normalized.encode("utf-8", errors="ignore")).hexdigest()

    @staticmethod
    def _build_buffer_key(finding: Dict[str, Any]) -> str:
        identity = str(finding.get("finding_identity") or "").strip()
        if identity:
            return f"identity:{identity}"
        return "|".join(
            [
                str(finding.get("file_path") or "").strip().lower(),
                str(finding.get("line_start") or ""),
                str(finding.get("function_name") or "").strip().lower(),
                str(finding.get("vulnerability_type") or "").strip().lower(),
                str(finding.get("title") or "").strip().lower(),
            ]
        )

    def _upsert_buffered_finding(self, finding: Dict[str, Any]) -> None:
        buffer_key = self._build_buffer_key(finding)
        for idx, existing in enumerate(self._buffered_findings):
            if not isinstance(existing, dict):
                continue
            if self._build_buffer_key(existing) != buffer_key:
                continue
            self._buffered_findings[idx] = merge_finding_patch(existing, finding)
            return
        self._buffered_findings.append(finding)

    # ------------------------------------------------------------------ #
    # 核心执行逻辑
    # ------------------------------------------------------------------ #

    async def _execute(
        self,
        file_path: Optional[str] = None,
        line_start: Optional[int] = None,
        function_name: Optional[str] = None,
        title: Optional[str] = None,
        vulnerability_type: Optional[str] = None,
        severity: Optional[str] = None,
        confidence: Optional[float] = None,
        status: Optional[str] = None,
        description: Optional[str] = None,
        finding_identity: Optional[str] = None,
        line_end: Optional[int] = None,
        source: Optional[str] = None,
        sink: Optional[str] = None,
        dataflow_path: Optional[List[str]] = None,
        is_verified: Optional[bool] = None,
        cvss_score: Optional[float] = None,
        cvss_vector: Optional[str] = None,
        poc_code: Optional[str] = None,
        suggestion: Optional[str] = None,
        verdict: Optional[str] = None,
        reachability: Optional[str] = None,
        verification_evidence: Optional[str] = None,
        cwe_id: Optional[str] = None,
        poc_plan: Optional[str] = None,
        code_snippet: Optional[str] = None,
        function_trigger_flow: Optional[List[str]] = None,
        code_context: Optional[str] = None,
        localization_status: Optional[str] = None,
        report: Optional[str] = None,
        **kwargs,
    ) -> ToolResult:
        """
        保存单个验证结果。

        Args:
            file_path: 文件路径
            line_start: 起始行号
            function_name: 函数名称
            title: 漏洞标题
            vulnerability_type: 漏洞类型
            severity: 严重程度
            status: 漏洞展示状态（verified|likely|false_positive；legacy uncertain 会自动归一化为 likely）
            verdict: 真实性判定
            confidence: 置信度
            reachability: 可达性
            verification_evidence: 验证证据
            其他可选参数...

        Returns:
            ToolResult，包含 saved、save_status、message
        """
        task_id = self.task_id
        finding_payload = (
            dict(kwargs.get("finding"))
            if isinstance(kwargs.get("finding"), dict)
            else {}
        )
        verification_payload = _merge_optional_dicts(
            finding_payload.get("verification_result"),
            kwargs.get("verification_result"),
        )

        # 兼容旧版批量入参：{"findings": [{...}, {...}]}
        # 新规范仍推荐单条调用；这里仅做鲁棒性兜底，避免因历史提示词导致整批失败。
        findings_payload = kwargs.get("findings")
        if isinstance(findings_payload, list):
            candidate_findings = [item for item in findings_payload if isinstance(item, dict)]
            if not candidate_findings:
                return ToolResult(
                    success=False,
                    error="findings 为空或格式无效",
                    data={"saved": False, "save_status": "failed"},
                )
            attempted_count = 0
            saved_count = 0
            failed_count = 0
            for item in candidate_findings:
                attempted_count += 1
                result = await self._execute(finding=item)
                if result.success and isinstance(result.data, dict) and (
                    bool(result.data.get("saved")) or bool(result.data.get("already_saved"))
                ):
                    saved_count += 1
                elif result.success:
                    # buffered 也算执行成功，只是不一定已落库
                    saved_count += 0
                else:
                    failed_count += 1

            return ToolResult(
                success=failed_count == 0,
                data={
                    "saved": saved_count > 0,
                    "save_status": (
                        "saved"
                        if failed_count == 0 and saved_count > 0
                        else ("buffered" if failed_count == 0 else "failed")
                    ),
                    "attempted_count": attempted_count,
                    "saved_count": saved_count,
                    "failed_count": failed_count,
                    "message": (
                        f"批量保存完成：saved={saved_count}, failed={failed_count}, "
                        f"attempted={attempted_count}"
                    ),
                },
            )

        file_path = str(
            _pick_first_meaningful(
                file_path,
                finding_payload.get("file_path"),
                kwargs.get("file"),
                finding_payload.get("file"),
                kwargs.get("path"),
                finding_payload.get("path"),
            )
            or "unknown"
        ).strip() or "unknown"
        raw_line_start = _pick_first_meaningful(
            line_start,
            kwargs.get("line"),
            finding_payload.get("line_start"),
            finding_payload.get("line"),
        )
        try:
            line_start = max(1, int(raw_line_start if raw_line_start is not None else 1))
        except Exception:
            line_start = 1
        raw_line_end = _pick_first_meaningful(
            line_end,
            finding_payload.get("line_end"),
        )
        try:
            line_end = int(raw_line_end) if raw_line_end is not None else line_start
        except Exception:
            line_end = line_start
        line_end = max(line_start, line_end)

        reachability_target = _pick_first_meaningful(
            kwargs.get("reachability_target"),
            verification_payload.get("reachability_target"),
            finding_payload.get("reachability_target"),
        )
        function_name = str(
            _pick_first_meaningful(
                function_name,
                finding_payload.get("function_name"),
                reachability_target.get("function") if isinstance(reachability_target, dict) else None,
            )
            or ""
        ).strip()
        if not function_name:
            title_text = str(
                _pick_first_meaningful(
                    title,
                    finding_payload.get("title"),
                    kwargs.get("display_title"),
                    finding_payload.get("display_title"),
                )
                or ""
            )
            title_match = re.search(r"中([A-Za-z_][A-Za-z0-9_]*)函数", title_text)
            if title_match:
                function_name = title_match.group(1).strip()
        if not function_name:
            function_name = f"<function_at_line_{line_start}>"

        title = str(
            _pick_first_meaningful(
                title,
                finding_payload.get("title"),
                kwargs.get("display_title"),
                finding_payload.get("display_title"),
            )
            or f"{file_path}中{function_name}函数漏洞"
        ).strip() or f"{file_path}中{function_name}函数漏洞"
        vulnerability_type = str(
            _pick_first_meaningful(
                vulnerability_type,
                kwargs.get("type"),
                finding_payload.get("vulnerability_type"),
                finding_payload.get("type"),
            )
            or "unknown"
        ).strip() or "unknown"
        severity = str(
            _pick_first_meaningful(
                severity,
                finding_payload.get("severity"),
            )
            or "medium"
        ).strip() or "medium"
        if confidence is None:
            confidence = _pick_first_meaningful(
                verification_payload.get("confidence"),
                finding_payload.get("confidence"),
                kwargs.get("ai_confidence"),
            )
        if confidence is None:
            confidence = 0.5

        try:
            normalized_confidence = max(0.0, min(float(confidence), 1.0))
        except Exception:
            normalized_confidence = 0.5

        normalized_severity = str(severity or "medium").strip().lower()
        if normalized_severity not in {"critical", "high", "medium", "low", "info"}:
            normalized_severity = "medium"

        verdict = _pick_first_meaningful(
            verdict,
            kwargs.get("authenticity"),
            verification_payload.get("verdict"),
            verification_payload.get("authenticity"),
            finding_payload.get("verdict"),
            finding_payload.get("authenticity"),
        )
        normalized_verdict = _normalize_save_verdict(verdict)
        if not normalized_verdict:
            normalized_verdict = "likely"

        normalized_status = _normalize_save_status(
            _pick_first_meaningful(
                status,
                verification_payload.get("status"),
                finding_payload.get("status"),
            ),
            normalized_verdict,
        )
        if normalized_status == "likely" and normalized_verdict == "uncertain":
            normalized_verdict = "likely"

        # is_verified 由程序设置：仅表示“已经过 verification 阶段”
        # SaveVerificationResultTool 只在 verification 阶段调用，因此固定为 True。
        normalized_is_verified = True

        normalized_reachability = str(
            _pick_first_meaningful(
                reachability,
                verification_payload.get("reachability"),
                finding_payload.get("reachability"),
            )
            or ""
        ).strip().lower()
        if normalized_reachability not in _ALLOWED_REACHABILITY:
            if normalized_verdict == "confirmed":
                normalized_reachability = "reachable"
            elif normalized_verdict == "likely":
                normalized_reachability = "likely_reachable"
            elif normalized_verdict == "false_positive":
                normalized_reachability = "unreachable"
            else:
                normalized_reachability = "unknown"

        evidence_text = str(
            _pick_first_meaningful(
                verification_evidence,
                kwargs.get("verification_details"),
                kwargs.get("evidence"),
                verification_payload.get("verification_evidence"),
                verification_payload.get("verification_details"),
                verification_payload.get("evidence"),
                finding_payload.get("verification_evidence"),
                finding_payload.get("verification_details"),
                finding_payload.get("evidence"),
                description,
                finding_payload.get("description"),
            )
            or ""
        ).strip()
        if len(evidence_text) < 10:
            evidence_text = (
                f"auto_generated_verification_evidence: verdict={normalized_verdict}; "
                f"confidence={normalized_confidence:.2f}; file={file_path}"
            )

        function_trigger_flow = _pick_first_meaningful(
            function_trigger_flow,
            verification_payload.get("function_trigger_flow"),
            finding_payload.get("function_trigger_flow"),
            (verification_payload.get("flow") or {}).get("function_trigger_flow")
            if isinstance(verification_payload.get("flow"), dict)
            else None,
            (finding_payload.get("flow") or {}).get("function_trigger_flow")
            if isinstance(finding_payload.get("flow"), dict)
            else None,
        )
        normalized_function_trigger_flow = _normalize_text_list(function_trigger_flow)

        raw_flow_payload = _pick_first_meaningful(
            kwargs.get("flow"),
            verification_payload.get("flow"),
            finding_payload.get("flow"),
        )
        flow_payload = dict(raw_flow_payload) if isinstance(raw_flow_payload, dict) else {}

        if isinstance(dataflow_path, list):
            normalized_dataflow_path = [str(item) for item in dataflow_path if str(item).strip()]
        elif dataflow_path is None:
            flow_call_chain = flow_payload.get("call_chain") if isinstance(flow_payload, dict) else None
            normalized_dataflow_path = (
                _normalize_text_list(
                    _pick_first_meaningful(
                        finding_payload.get("dataflow_path"),
                        flow_call_chain,
                        normalized_function_trigger_flow,
                    )
                )
            )
        else:
            normalized_dataflow_path = _normalize_text_list(dataflow_path)

        if normalized_dataflow_path and "call_chain" not in flow_payload:
            flow_payload["call_chain"] = list(normalized_dataflow_path)
        if normalized_function_trigger_flow and "function_trigger_flow" not in flow_payload:
            flow_payload["function_trigger_flow"] = list(normalized_function_trigger_flow)

        normalized_cvss_score: Optional[float]
        raw_cvss_score = _pick_first_meaningful(
            cvss_score,
            finding_payload.get("cvss_score"),
        )
        if raw_cvss_score is None:
            normalized_cvss_score = None
        else:
            try:
                normalized_cvss_score = float(raw_cvss_score)
            except Exception:
                normalized_cvss_score = None

        description = _pick_first_meaningful(
            description,
            finding_payload.get("description"),
        )
        finding_identity = _pick_first_meaningful(
            finding_identity,
            finding_payload.get("finding_identity"),
        )
        source = _pick_first_meaningful(source, finding_payload.get("source"))
        sink = _pick_first_meaningful(sink, finding_payload.get("sink"))
        cwe_id = _pick_first_meaningful(cwe_id, finding_payload.get("cwe_id"))
        poc_plan = _pick_first_meaningful(
            poc_plan,
            verification_payload.get("poc_plan"),
            finding_payload.get("poc_plan"),
        )
        code_snippet = _pick_first_meaningful(
            code_snippet,
            verification_payload.get("code_snippet"),
            finding_payload.get("code_snippet"),
        )
        code_context = _pick_first_meaningful(
            code_context,
            verification_payload.get("code_context"),
            finding_payload.get("code_context"),
        )
        localization_status = _pick_first_meaningful(
            localization_status,
            verification_payload.get("localization_status"),
            finding_payload.get("localization_status"),
        )
        report = _pick_first_meaningful(
            report,
            kwargs.get("vulnerability_report"),
            finding_payload.get("report"),
            finding_payload.get("vulnerability_report"),
        )
        cvss_vector = _pick_first_meaningful(
            cvss_vector,
            finding_payload.get("cvss_vector"),
        )
        poc_code = _pick_first_meaningful(
            poc_code,
            finding_payload.get("poc_code"),
        )
        suggestion = _pick_first_meaningful(
            suggestion,
            verification_payload.get("suggestion"),
            finding_payload.get("suggestion"),
        )

        finding_metadata = _merge_optional_dicts(
            finding_payload.get("finding_metadata"),
            verification_payload.get("finding_metadata"),
            kwargs.get("finding_metadata"),
        )
        for metadata_key in _SOURCE_SINK_GATE_METADATA_KEYS:
            metadata_value = _pick_first_meaningful(
                kwargs.get(metadata_key),
                verification_payload.get(metadata_key),
                finding_payload.get(metadata_key),
                finding_metadata.get(metadata_key),
            )
            if metadata_value is not None:
                finding_metadata[metadata_key] = metadata_value

        verification_todo_id = _pick_first_meaningful(
            kwargs.get("verification_todo_id"),
            verification_payload.get("verification_todo_id"),
            finding_payload.get("verification_todo_id"),
        )
        verification_fingerprint = _pick_first_meaningful(
            kwargs.get("verification_fingerprint"),
            verification_payload.get("verification_fingerprint"),
            finding_payload.get("verification_fingerprint"),
        )
        attacker_flow = _pick_first_meaningful(
            kwargs.get("attacker_flow"),
            finding_payload.get("attacker_flow"),
        )
        taint_flow = _normalize_text_list(
            _pick_first_meaningful(
                kwargs.get("taint_flow"),
                finding_payload.get("taint_flow"),
            )
        )
        evidence_chain = _normalize_text_list(
            _pick_first_meaningful(
                kwargs.get("evidence_chain"),
                finding_payload.get("evidence_chain"),
            )
        )
        missing_checks = _normalize_text_list(
            _pick_first_meaningful(
                kwargs.get("missing_checks"),
                finding_payload.get("missing_checks"),
            )
        )
        fix_code = _pick_first_meaningful(
            kwargs.get("fix_code"),
            finding_payload.get("fix_code"),
        )
        fix_description = _pick_first_meaningful(
            kwargs.get("fix_description"),
            finding_payload.get("fix_description"),
        )
        verification_method = _pick_first_meaningful(
            kwargs.get("verification_method"),
            finding_payload.get("verification_method"),
        )
        poc = _pick_first_meaningful(
            kwargs.get("poc"),
            finding_payload.get("poc"),
        )

        source_sink_authenticity_errors = _normalize_text_list(
            _pick_first_meaningful(
                kwargs.get("source_sink_authenticity_errors"),
                verification_payload.get("source_sink_authenticity_errors"),
                finding_payload.get("source_sink_authenticity_errors"),
            )
        )
        source_sink_authenticity_passed = _pick_first_meaningful(
            kwargs.get("source_sink_authenticity_passed"),
            verification_payload.get("source_sink_authenticity_passed"),
            finding_payload.get("source_sink_authenticity_passed"),
        )

        # 构造 finding 字典
        verification_result_payload = {
            **verification_payload,
            "verdict": normalized_verdict,
            "authenticity": normalized_verdict,
            "confidence": normalized_confidence,
            "reachability": normalized_reachability,
            "status": normalized_status,
            "verification_stage_completed": True,
            "verification_evidence": evidence_text,
            "verification_details": str(
                _pick_first_meaningful(
                    verification_payload.get("verification_details"),
                    kwargs.get("verification_details"),
                    finding_payload.get("verification_details"),
                    evidence_text,
                )
                or evidence_text
            ),
            "evidence": str(
                _pick_first_meaningful(
                    verification_payload.get("evidence"),
                    kwargs.get("evidence"),
                    finding_payload.get("evidence"),
                    evidence_text,
                )
                or evidence_text
            ),
            "poc_plan": poc_plan,
            "code_snippet": code_snippet,
            "suggestion": suggestion,
            "function_trigger_flow": normalized_function_trigger_flow,
            "code_context": code_context,
            "localization_status": localization_status,
        }
        if flow_payload:
            verification_result_payload["flow"] = flow_payload
        for passthrough_key in (
            "reachability_target",
            "context_start_line",
            "context_end_line",
            "function_range_validation",
            "validation_reason",
            "localization_failure_trace",
            "known_facts",
            "inferences_to_verify",
            "final_conclusion",
        ):
            passthrough_value = _pick_first_meaningful(
                kwargs.get(passthrough_key),
                verification_payload.get(passthrough_key),
                finding_payload.get(passthrough_key),
            )
            if passthrough_value is not None:
                verification_result_payload[passthrough_key] = passthrough_value
        if verification_todo_id:
            verification_result_payload["verification_todo_id"] = verification_todo_id
        if verification_fingerprint:
            verification_result_payload["verification_fingerprint"] = verification_fingerprint
        if source_sink_authenticity_passed in {True, False}:
            verification_result_payload["source_sink_authenticity_passed"] = bool(
                source_sink_authenticity_passed
            )
        if source_sink_authenticity_errors:
            verification_result_payload["source_sink_authenticity_errors"] = source_sink_authenticity_errors
        if finding_metadata:
            verification_result_payload["finding_metadata"] = dict(finding_metadata)

        finding = {
            "finding_identity": finding_identity,
            "file_path": file_path,
            "line_start": line_start,
            "line_end": line_end if line_end is not None else line_start,
            "function_name": function_name,
            "title": title,
            "display_title": _pick_first_meaningful(
                kwargs.get("display_title"),
                finding_payload.get("display_title"),
            ),
            "vulnerability_type": vulnerability_type,
            "severity": normalized_severity,
            "cwe_id": cwe_id,
            "description": description,
            "source": source,
            "sink": sink,
            "dataflow_path": normalized_dataflow_path,
            "status": normalized_status,
            "is_verified": normalized_is_verified,
            "verification_stage_completed": True,
            "poc_code": poc_code,
            "poc": poc,
            "suggestion": suggestion,
            "confidence": normalized_confidence,
            "cvss_score": normalized_cvss_score,
            "cvss_vector": cvss_vector,
            "report": report,
            "vulnerability_report": report,
            "fix_code": fix_code,
            "fix_description": fix_description,
            "verification_method": verification_method,
            # code_snippet 同时放到顶层，供 _save_findings 作为初始候选值
            # （_save_findings 仍会用文件实际内容覆盖）
            "code_snippet": code_snippet,
            "finding_metadata": dict(finding_metadata) if finding_metadata else None,
            "attacker_flow": attacker_flow,
            "taint_flow": taint_flow,
            "evidence_chain": evidence_chain,
            "missing_checks": missing_checks,
            "verification_todo_id": verification_todo_id,
            "verification_fingerprint": verification_fingerprint,
            "sink_reachable": finding_metadata.get("sink_reachable") if finding_metadata else None,
            "upstream_call_chain": (
                finding_metadata.get("upstream_call_chain") if finding_metadata else None
            ),
            "sink_trigger_condition": (
                finding_metadata.get("sink_trigger_condition") if finding_metadata else None
            ),
            "known_facts": _pick_first_meaningful(
                kwargs.get("known_facts"),
                finding_payload.get("known_facts"),
            ),
            "inferences_to_verify": _pick_first_meaningful(
                kwargs.get("inferences_to_verify"),
                finding_payload.get("inferences_to_verify"),
            ),
            "final_conclusion": _pick_first_meaningful(
                kwargs.get("final_conclusion"),
                finding_payload.get("final_conclusion"),
            ),
            "verification_result": verification_result_payload,
        }
        ensure_finding_identity(task_id, finding)

        # 生成精确 payload digest：只对完全重复的保存做幂等拦截，
        # 保留同一 finding 后续补充 report / flow / metadata 的能力。
        payload_digest = self._build_payload_digest([finding])

        if payload_digest in self._seen_payload_digests:
            logger.info(
                "[SaveVerificationResult][%s] 幂等保护：重复 finding（payload_digest=%s），跳过",
                task_id,
                payload_digest,
            )
            return ToolResult(
                success=True,
                data={
                    "saved": False,
                    "save_status": "duplicate_skipped",
                    "already_saved": True,
                    "message": f"重复 finding 已跳过（{title}）",
                },
            )

        # 更新内存缓冲（供外部兜底读取）
        self._upsert_buffered_finding(finding)

        logger.info(
            "[SaveVerificationResult][%s] 保存验证结果：%s (%s) - status=%s, verdict=%s, confidence=%.2f",
            task_id,
            title,
            file_path,
            normalized_status,
            normalized_verdict,
            normalized_confidence,
        )

        if self._save_callback is None or self._defer_persistence:
            # 无回调或启用 deferred 模式时仅写入缓冲，由 Workflow 统一去重后落库。
            if self._defer_persistence:
                logger.info(
                    "[SaveVerificationResult][%s] 延迟持久化模式已启用，结果先写入缓冲，等待 Workflow 统一入库",
                    task_id,
                )
            else:
                logger.warning(
                    "[SaveVerificationResult][%s] 未注入 save_callback，结果仅写入内存缓冲",
                    task_id,
                )
            return ToolResult(
                success=True,
                data={
                    "saved": False,
                    "save_status": "buffered",
                    "buffered": True,
                    "deferred": self._defer_persistence,
                    "message": (
                        f"结果已写入内存缓冲（{title}），"
                        "将在 Verification 阶段结束后统一去重并持久化"
                    ),
                },
            )

        # 调用注入的持久化回调
        try:
            saved = await self._save_callback([finding])
            saved_delta = int(saved or 0)
            previous_saved = int(self._saved_count or 0)
            self._saved_count = previous_saved + saved_delta
            if saved_delta > 0:
                self._seen_payload_digests.add(payload_digest)
            
            logger.info(
                "[SaveVerificationResult][%s] 持久化完成：finding=%s, total_saved=%d",
                task_id,
                title,
                self._saved_count,
            )
            
            return ToolResult(
                success=True,
                data={
                    "saved": saved > 0,
                    "save_status": "saved" if saved > 0 else "not_saved",
                    "message": (
                        f"验证结果已保存：{title}（status={normalized_status}, verdict={normalized_verdict}, "
                        f"confidence={normalized_confidence:.2f}）"
                        if saved > 0
                        else f"验证结果未持久化：{title}"
                    ),
                },
            )
        except Exception as exc:
            logger.error(
                "[SaveVerificationResult][%s] 持久化失败: %s",
                task_id,
                exc,
                exc_info=True,
            )
            return ToolResult(
                success=False,
                error=str(exc),
                data={
                    "saved": False,
                    "save_status": "failed",
                    "message": f"持久化失败: {exc}",
                },
            )


class UpdateVulnerabilityFindingTool(AgentTool):
    """Report 阶段用于修正已保存 finding 的工具。"""

    def __init__(
        self,
        task_id: str,
        update_callback: Optional[
            Callable[[str, Dict[str, Any], str], Coroutine[Any, Any, Dict[str, Any]]]
        ] = None,
    ) -> None:
        super().__init__()
        self.task_id = task_id
        self._update_callback = update_callback

    @property
    def name(self) -> str:
        return "update_vulnerability_finding"

    @property
    def description(self) -> str:
        return (
            "在 Report 阶段修正已验证漏洞的结构化信息。"
            "必须提供 finding_identity、fields_to_update、update_reason。"
            "只允许修正定位/描述类字段，禁止修改 verdict/confidence/reachability。"
        )

    @property
    def args_schema(self):
        return UpdateVulnerabilityFindingInput

    async def _execute(
        self,
        finding_identity: str,
        fields_to_update: Dict[str, Any],
        update_reason: str,
    ) -> ToolResult:
        ok, error, sanitized, updated_fields = validate_finding_update_patch(fields_to_update)
        if not ok:
            return ToolResult(success=False, error=error, data={"updated": False, "message": error})

        if self._update_callback is None:
            return ToolResult(
                success=False,
                error="未注入 update_callback",
                data={
                    "updated": False,
                    "finding_identity": finding_identity,
                    "message": "update_vulnerability_finding 未配置后端更新回调",
                },
            )

        try:
            updated_finding = await self._update_callback(
                finding_identity,
                sanitized,
                update_reason,
            )
            return ToolResult(
                success=True,
                data={
                    "updated": True,
                    "finding_identity": finding_identity,
                    "updated_fields": updated_fields,
                    "updated_finding": updated_finding,
                    "message": f"已修正 finding：{finding_identity}",
                },
            )
        except Exception as exc:
            logger.error(
                "[UpdateVulnerabilityFinding][%s] 更新失败: %s",
                self.task_id,
                exc,
                exc_info=True,
            )
            return ToolResult(
                success=False,
                error=str(exc),
                data={
                    "updated": False,
                    "finding_identity": finding_identity,
                    "message": f"更新失败: {exc}",
                },
            )
