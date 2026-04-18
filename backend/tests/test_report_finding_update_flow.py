from pathlib import Path
from typing import Any, Dict, List

import pytest
from sqlalchemy import select

from app.api.v1.endpoints.agent_tasks import _save_findings
from app.models.agent_task import AgentFinding
from app.services.agent.agents.report import ReportAgent
from app.services.agent.tools.base import AgentTool, ToolResult
from app.services.agent.tools.verification_result_tools import (
    SaveVerificationResultTool,
    UpdateVulnerabilityFindingTool,
)


class _SequenceLLM:
    def __init__(self, responses: List[str]) -> None:
        self._responses = list(responses)

    async def complete(self, messages: List[Dict[str, str]], temperature: float = 0.2):
        if not self._responses:
            raise RuntimeError("no more llm responses")
        return {"content": self._responses.pop(0), "usage": {"total_tokens": 7}}


class _ReadFileTool(AgentTool):
    @property
    def name(self) -> str:
        return "read_file"

    @property
    def description(self) -> str:
        return "read file"

    async def _execute(self, file_path: str, start_line: int = 1, end_line: int = 20) -> ToolResult:
        content = "\n".join(
            [
                "10 def correct_func(user_input):",
                "11     sink(user_input)",
            ]
        )
        return ToolResult(success=True, data={"file_path": file_path, "content": content})


@pytest.mark.asyncio
async def test_save_verification_result_generates_finding_identity():
    buffered: List[Dict[str, Any]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        buffered.extend(findings)
        return len(findings)

    tool = SaveVerificationResultTool(task_id="task-1", save_callback=_save_callback)
    result = await tool.execute(
        file_path="app/a.py",
        line_start=11,
        function_name="demo",
        title="app/a.py中demo函数SQL注入漏洞",
        vulnerability_type="sql_injection",
        severity="high",
        verdict="confirmed",
        confidence=0.9,
        reachability="reachable",
        verification_evidence="dynamic verification evidence is sufficient",
    )

    assert result.success is True
    assert buffered
    assert buffered[0]["finding_identity"].startswith("fid:")
    assert buffered[0]["verification_result"]["finding_identity"] == buffered[0]["finding_identity"]


@pytest.mark.asyncio
async def test_save_verification_result_accepts_legacy_batch_findings_payload():
    buffered: List[Dict[str, Any]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        buffered.extend(findings)
        return len(findings)

    tool = SaveVerificationResultTool(task_id="task-legacy", save_callback=_save_callback)
    result = await tool.execute(
        findings=[
            {
                "file_path": "src/auth.py",
                "line_start": 42,
                "line_end": 45,
                "function_name": "login",
                "title": "src/auth.py中login函数SQL注入漏洞",
                "vulnerability_type": "sql_injection",
                "severity": "high",
                "description": "用户输入拼接 SQL",
                "verification_result": {
                    "verdict": "confirmed",
                    "confidence": 0.91,
                    "reachability": "reachable",
                    "verification_evidence": "harness 触发了注入路径",
                },
            }
        ]
    )

    assert result.success is True
    assert isinstance(result.data, dict)
    assert result.data.get("saved_count") == 1
    assert buffered and buffered[0]["finding_identity"].startswith("fid:")


@pytest.mark.asyncio
async def test_save_verification_result_is_saved_false_when_callback_saves_zero():
    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        return 0

    tool = SaveVerificationResultTool(task_id="task-zero-save", save_callback=_save_callback)
    result = await tool.execute(
        file_path="src/demo.py",
        line_start=12,
        function_name="demo",
        title="src/demo.py中demo函数SQL注入漏洞",
        vulnerability_type="sql_injection",
        severity="high",
        verdict="confirmed",
        confidence=0.88,
        reachability="reachable",
        verification_evidence="zero-save callback for regression test",
    )

    assert result.success is True
    assert isinstance(result.data, dict)
    assert result.data.get("saved") is False
    assert result.data.get("save_status") == "not_saved"
    assert tool.saved_count == 0
    assert tool.is_saved is False


@pytest.mark.asyncio
async def test_save_verification_result_zero_save_can_retry_same_payload():
    saved_batches: List[List[Dict[str, Any]]] = []
    save_results = [0, 1]

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        saved_batches.append([dict(item) for item in findings])
        return save_results.pop(0)

    tool = SaveVerificationResultTool(task_id="task-zero-retry", save_callback=_save_callback)
    payload = {
        "file_path": "src/retry_demo.py",
        "line_start": 12,
        "function_name": "demo",
        "title": "src/retry_demo.py中demo函数SQL注入漏洞",
        "vulnerability_type": "sql_injection",
        "severity": "high",
        "verdict": "confirmed",
        "confidence": 0.88,
        "reachability": "reachable",
        "verification_evidence": "retry should be allowed when callback reports zero rows saved",
    }

    first = await tool.execute(**payload)
    second = await tool.execute(**payload)

    assert first.success is True
    assert first.data["saved"] is False
    assert first.data["save_status"] == "not_saved"
    assert second.success is True
    assert second.data["saved"] is True
    assert second.data["save_status"] == "saved"
    assert len(saved_batches) == 2
    assert len(tool.buffered_findings) == 1


@pytest.mark.asyncio
async def test_save_verification_result_clone_for_worker_resets_buffer_and_dedup_state():
    persisted_batches: List[List[Dict[str, Any]]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        persisted_batches.append([dict(item) for item in findings])
        return len(findings)

    tool = SaveVerificationResultTool(task_id="task-clone", save_callback=_save_callback)
    payload = {
        "file_path": "src/clone_demo.py",
        "line_start": 21,
        "function_name": "handler",
        "title": "src/clone_demo.py中handler函数SQL注入漏洞",
        "vulnerability_type": "sql_injection",
        "severity": "high",
        "verdict": "confirmed",
        "confidence": 0.9,
        "reachability": "reachable",
        "verification_evidence": "worker clone should not share dedup state",
    }
    first = await tool.execute(**payload)
    assert first.success is True
    assert tool.is_saved is True
    assert len(tool.buffered_findings) == 1

    cloned = tool.clone_for_worker()
    assert isinstance(cloned, SaveVerificationResultTool)
    assert cloned is not tool
    assert cloned.buffered_findings == []
    assert cloned.saved_count is None
    assert cloned.is_saved is False

    second = await cloned.execute(**payload)
    assert second.success is True
    assert len(persisted_batches) == 2


@pytest.mark.asyncio
async def test_save_verification_result_can_buffer_without_immediate_persistence():
    persisted_batches: List[List[Dict[str, Any]]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        persisted_batches.append([dict(item) for item in findings])
        return len(findings)

    tool = SaveVerificationResultTool(
        task_id="task-deferred",
        save_callback=_save_callback,
        defer_persistence=True,
    )
    result = await tool.execute(
        file_path="src/deferred_demo.py",
        line_start=18,
        function_name="handle",
        title="src/deferred_demo.py中handle函数SQL注入漏洞",
        vulnerability_type="sql_injection",
        severity="high",
        verdict="confirmed",
        confidence=0.91,
        reachability="reachable",
        verification_evidence="buffer first; flush after verification phase",
    )

    assert result.success is True
    assert result.data["saved"] is False
    assert result.data["save_status"] == "buffered"
    assert result.data["buffered"] is True
    assert result.data["deferred"] is True
    assert persisted_batches == []
    assert len(tool.buffered_findings) == 1
    assert tool.saved_count is None
    assert tool.is_saved is False


@pytest.mark.asyncio
async def test_save_verification_result_normalizes_uncertain_status_to_likely_and_keeps_display_fields():
    buffered: List[Dict[str, Any]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        buffered.extend(findings)
        return len(findings)

    tool = SaveVerificationResultTool(task_id="task-rich-fields", save_callback=_save_callback)
    result = await tool.execute(
        file_path="src/demo.c",
        line_start=108,
        line_end=112,
        function_name="ClonePolygonEdgesTLS",
        title="src/demo.c中ClonePolygonEdgesTLS函数内存破坏漏洞",
        vulnerability_type="memory_corruption",
        severity="high",
        status="uncertain",
        verdict="uncertain",
        confidence=0.74,
        reachability="likely_reachable",
        verification_evidence="fuzzing harness observed a repeatable invalid free pattern",
        description="复制指针未清理，后续释放路径可能触发双重释放。",
        source="用户可控图像绘制参数",
        sink="DestroyEdgeInfo / free edge info",
        dataflow_path=["ParseDrawCommand", "ClonePolygonEdgesTLS", "DestroyEdgeInfo"],
        cvss_score=8.1,
        cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H",
        poc_code="int main(void) { return 0; }",
        suggestion="复制指针后清空所有权并在释放前增加唯一释放保护。",
        code_snippet="edge_info[i] = CloneEdgeInfo(source[i]);",
        code_context="if (clone_failed) { DestroyEdgeInfo(edge_info[i]); }",
        report="# Rich finding report",
    )

    assert result.success is True
    assert buffered
    saved = buffered[0]
    assert saved["status"] == "likely"
    assert saved["verification_result"]["status"] == "likely"
    assert saved["source"] == "用户可控图像绘制参数"
    assert saved["sink"] == "DestroyEdgeInfo / free edge info"
    assert saved["dataflow_path"] == ["ParseDrawCommand", "ClonePolygonEdgesTLS", "DestroyEdgeInfo"]
    assert saved["cvss_score"] == 8.1
    assert saved["cvss_vector"] == "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H"
    assert saved["poc_code"] == "int main(void) { return 0; }"
    assert saved["suggestion"] == "复制指针后清空所有权并在释放前增加唯一释放保护。"
    assert saved["report"] == "# Rich finding report"


@pytest.mark.asyncio
async def test_save_verification_result_accepts_nested_finding_payload_and_keeps_verification_metadata():
    buffered: List[Dict[str, Any]] = []

    async def _save_callback(findings: List[Dict[str, Any]]) -> int:
        buffered.extend(findings)
        return len(findings)

    tool = SaveVerificationResultTool(task_id="task-nested-finding", save_callback=_save_callback)
    result = await tool.execute(
        finding={
            "file_path": "src/handler.py",
            "line_start": 12,
            "line_end": 18,
            "function_name": "handle_login",
            "title": "src/handler.py中handle_login函数SQL注入漏洞",
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "description": "用户输入直接进入 SQL sink。",
            "fix_code": "cursor.execute(query, (user_input,))",
            "fix_description": "改为参数化查询。",
            "verification_method": "agent_verification",
            "attacker_flow": "request.body.username -> handle_login",
            "taint_flow": ["request.body.username", "build_query", "cursor.execute"],
            "evidence_chain": ["search_code", "get_symbol_body", "run_code"],
            "finding_metadata": {
                "sink_reachable": True,
                "upstream_call_chain": ["router.login", "handle_login"],
                "sink_trigger_condition": "POST /api/login",
            },
            "verification_result": {
                "verdict": "confirmed",
                "confidence": 0.93,
                "reachability": "reachable",
                "verification_evidence": "dynamic replay confirmed the SQL sink is reachable",
                "flow": {"call_chain": ["router.login", "handle_login", "cursor.execute"]},
                "reachability_target": {
                    "file_path": "src/handler.py",
                    "function": "handle_login",
                    "start_line": 10,
                    "end_line": 20,
                },
                "verification_todo_id": "todo-123",
                "verification_fingerprint": "fingerprint-123",
                "source_sink_authenticity_passed": True,
            },
        }
    )

    assert result.success is True
    assert buffered
    saved = buffered[0]
    assert saved["fix_code"] == "cursor.execute(query, (user_input,))"
    assert saved["fix_description"] == "改为参数化查询。"
    assert saved["verification_method"] == "agent_verification"
    assert saved["attacker_flow"] == "request.body.username -> handle_login"
    assert saved["taint_flow"] == ["request.body.username", "build_query", "cursor.execute"]
    assert saved["evidence_chain"] == ["search_code", "get_symbol_body", "run_code"]
    assert saved["finding_metadata"]["sink_reachable"] is True
    assert saved["finding_metadata"]["upstream_call_chain"] == ["router.login", "handle_login"]
    assert saved["verification_result"]["flow"]["call_chain"] == [
        "router.login",
        "handle_login",
        "cursor.execute",
    ]
    assert saved["verification_result"]["reachability_target"]["function"] == "handle_login"
    assert saved["verification_result"]["verification_todo_id"] == "todo-123"
    assert saved["verification_result"]["verification_fingerprint"] == "fingerprint-123"
    assert saved["verification_result"]["source_sink_authenticity_passed"] is True


@pytest.mark.asyncio
async def test_save_verification_result_rejects_unknown_fields():
    tool = SaveVerificationResultTool(task_id="task-unknown-field")
    result = await tool.execute(
        file_path="src/demo.py",
        line_start=12,
        function_name="demo",
        title="src/demo.py中demo函数SQL注入漏洞",
        vulnerability_type="sql_injection",
        severity="high",
        verdict="confirmed",
        confidence=0.9,
        reachability="reachable",
        verification_evidence="unknown field rejection should happen before execution",
        unexpected_field="boom",
    )

    assert result.success is False
    assert result.error_code == "unknown_field"
    assert "发现未知字段" in str(result.data)


def test_report_project_fallback_handles_non_numeric_confidence_text():
    agent = ReportAgent(llm_service=_SequenceLLM([]), tools={}, event_emitter=None)
    markdown = agent._build_project_report_fallback(
        project_name="demo",
        findings=[
            {
                "title": "命令注入风险",
                "severity": "high",
                "confidence": "高危",
                "file_path": "MagickCore/delegate.c",
                "line_start": 439,
            }
        ],
        severity_stats={"critical": 0, "high": 1, "medium": 0, "low": 0, "info": 0},
        verdict_stats={"confirmed": 1, "likely": 0, "uncertain": 0, "false_positive": 0},
        vuln_type_stats={"command_injection": 1},
    )

    assert "Top 风险条目" in markdown
    assert "MagickCore/delegate.c:439" in markdown
    assert "- 严重程度分布\n  - critical：0\n  - high：1" in markdown
    assert "- 漏洞类型分布\n  - command_injection：1" in markdown


@pytest.mark.asyncio
async def test_update_vulnerability_finding_rejects_verdict_patch():
    async def _update_callback(identity: str, patch: Dict[str, Any], reason: str) -> Dict[str, Any]:
        return {"finding_identity": identity, **patch}

    tool = UpdateVulnerabilityFindingTool(task_id="task-2", update_callback=_update_callback)
    result = await tool.execute(
        finding_identity="fid:test",
        fields_to_update={"verdict": "false_positive"},
        update_reason="should fail",
    )

    assert result.success is False
    assert "参数校验失败" in str(result.error)
    assert "禁止更新字段" in str(result.data)


@pytest.mark.asyncio
async def test_report_agent_returns_updated_finding_after_update_tool():
    updated_findings: List[Dict[str, Any]] = []

    async def _update_callback(identity: str, patch: Dict[str, Any], reason: str) -> Dict[str, Any]:
        updated = {
            "finding_identity": identity,
            "file_path": "app/api.py",
            "line_start": 10,
            "line_end": 11,
            "function_name": "correct_func",
            "title": "app/api.py中correct_func函数SQL注入漏洞",
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "verification_result": {
                "localization_status": "success",
                "verification_evidence": "report stage corrected line and function",
            },
        }
        if "verification_result" in patch:
            updated["verification_result"].update(patch["verification_result"])
        updated.update({k: v for k, v in patch.items() if k != "verification_result"})
        updated_findings.append(updated)
        return updated

    llm = _SequenceLLM(
        [
            (
                "Thought: 先读取源码并修正错误定位。\n"
                "Action: read_file\n"
                'Action Input: {"file_path": "app/api.py", "start_line": 1, "end_line": 20}'
            ),
            (
                "Thought: 已确认原始行号和函数名错误，先修正 finding。\n"
                "Action: update_vulnerability_finding\n"
                'Action Input: {"finding_identity": "fid:test", "fields_to_update": {"line_start": 10, "line_end": 11, "function_name": "correct_func", "title": "app/api.py中correct_func函数SQL注入漏洞", "verification_result.localization_status": "success", "verification_result.verification_evidence": "report stage corrected line and function"}, "update_reason": "Report阶段核对源码后修正定位"}'
            ),
            (
                "Thought: 信息已充分，输出报告。\n"
                "Final Answer:\n"
                "# 漏洞报告：app/api.py中correct_func函数SQL注入漏洞\n\n"
                "## 漏洞概述\n\n已完成修正。"
            ),
        ]
    )
    tools = {
        "read_file": _ReadFileTool(),
        "update_vulnerability_finding": UpdateVulnerabilityFindingTool(
            task_id="task-3",
            update_callback=_update_callback,
        ),
    }
    agent = ReportAgent(llm_service=llm, tools=tools, event_emitter=None)

    result = await agent.run(
        {
            "finding": {
                "finding_identity": "fid:test",
                "title": "wrong title",
                "file_path": "app/api.py",
                "line_start": 99,
                "vulnerability_type": "sql_injection",
                "severity": "high",
                "verdict": "confirmed",
                "confidence": 0.9,
                "function_name": "wrong_func",
            },
            "project_info": {"name": "demo"},
            "config": {},
        }
    )

    assert result.success is True
    assert updated_findings
    assert result.data["updated_finding"]["line_start"] == 10
    assert result.data["finding_validated"] is True
    assert "correct_func" in result.data["vulnerability_report"]


@pytest.mark.asyncio
async def test_report_agent_rejects_inconsistent_final_finding_identity():
    async def _update_callback(identity: str, patch: Dict[str, Any], reason: str) -> Dict[str, Any]:
        return {
            "finding_identity": "fid:other",
            "title": "app/api.py中correct_func函数SQL注入漏洞",
            "file_path": "app/api.py",
            "line_start": 10,
            "line_end": 11,
            "function_name": "correct_func",
            "vulnerability_type": "sql_injection",
            "severity": "high",
        }

    llm = _SequenceLLM(
        [
            (
                "Thought: 先读取源码。\n"
                "Action: read_file\n"
                'Action Input: {"file_path": "app/api.py", "start_line": 1, "end_line": 20}'
            ),
            (
                "Thought: 需要修正 finding。\n"
                "Action: update_vulnerability_finding\n"
                'Action Input: {"finding_identity": "fid:test", "fields_to_update": {"line_start": 10, "line_end": 11, "function_name": "correct_func"}, "update_reason": "Report阶段核对源码后修正定位"}'
            ),
            (
                "Thought: 信息已充分，输出报告。\n"
                "Final Answer:\n"
                "# 漏洞报告：app/api.py中correct_func函数SQL注入漏洞\n\n"
                "## 漏洞概述\n\n已完成修正。"
            ),
        ]
    )
    agent = ReportAgent(
        llm_service=llm,
        tools={
            "read_file": _ReadFileTool(),
            "update_vulnerability_finding": UpdateVulnerabilityFindingTool(
                task_id="task-4",
                update_callback=_update_callback,
            ),
        },
        event_emitter=None,
    )

    result = await agent.run(
        {
            "finding": {
                "finding_identity": "fid:test",
                "title": "wrong title",
                "file_path": "app/api.py",
                "line_start": 99,
                "vulnerability_type": "sql_injection",
                "severity": "high",
                "verdict": "confirmed",
                "confidence": 0.9,
                "function_name": "wrong_func",
            },
            "project_info": {"name": "demo"},
            "config": {},
        }
    )

    assert result.success is False
    assert "finding_identity" in str(result.error)
    assert result.data["finding_validated"] is False


@pytest.mark.asyncio
async def test_save_findings_second_pass_persists_report_updates(db, test_agent_task, tmp_path: Path):
    project_root = tmp_path
    source_file = project_root / "app" / "api.py"
    source_file.parent.mkdir(parents=True, exist_ok=True)
    source_file.write_text(
        "def correct_func(user_input):\n"
        "    sink(user_input)\n",
        encoding="utf-8",
    )

    finding = {
        "finding_identity": "fid:report-sync",
        "title": "app/api.py中correct_func函数SQL注入漏洞",
        "file_path": "app/api.py",
        "line_start": 2,
        "line_end": 2,
        "function_name": "correct_func",
        "vulnerability_type": "sql_injection",
        "severity": "high",
        "description": "initial description",
        "verdict": "confirmed",
        "confidence": 0.95,
        "reachability": "reachable",
        "verification_evidence": "verified from source to sink",
        "verification_result": {
            "authenticity": "confirmed",
            "verdict": "confirmed",
            "confidence": 0.95,
            "reachability": "reachable",
            "verification_evidence": "verified from source to sink",
        },
    }

    saved_count = await _save_findings(
        db,
        test_agent_task.id,
        [dict(finding)],
        project_root=str(project_root),
    )
    assert saved_count == 1

    updated = dict(finding)
    updated["description"] = "report corrected description"
    updated["vulnerability_report"] = "# final markdown report"

    synced_count = await _save_findings(
        db,
        test_agent_task.id,
        [updated],
        project_root=str(project_root),
    )
    assert synced_count == 1

    result = await db.execute(
        select(AgentFinding).where(AgentFinding.task_id == test_agent_task.id)
    )
    rows = result.scalars().all()
    assert len(rows) == 1
    persisted = rows[0]
    assert persisted.report == "# final markdown report"
    assert persisted.description == "report corrected description"
