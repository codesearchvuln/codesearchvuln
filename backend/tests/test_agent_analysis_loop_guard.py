from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.agent.agents.analysis import AnalysisAgent
from app.services.agent.tools.base import ToolResult
import app.models.opengrep  # noqa: F401
import app.models.gitleaks  # noqa: F401


class _DummyReadFileTool:
    description = "dummy read file"

    async def execute(self, **kwargs):
        return ToolResult(success=True, data=f"read ok: {kwargs.get('file_path', 'unknown')}")


class _DummyPushFindingTool:
    description = "dummy push finding"

    def __init__(self):
        self.calls = []

    async def execute(self, **kwargs):
        self.calls.append(dict(kwargs))
        return ToolResult(success=True, data="漏洞已成功入队")


@pytest.mark.asyncio
async def test_analysis_loop_guard_degrades_after_repeated_no_action(monkeypatch):
    agent = AnalysisAgent(
        llm_service=SimpleNamespace(),
        tools={"get_code_window": _DummyReadFileTool()},
        event_emitter=None,
    )

    repeated_no_action_output = (
        "Thought: 我现在立即执行 Action 来读取高风险文件的代码证据，"
        "但我先继续思考，不输出可执行格式。"
    )
    monkeypatch.setattr(
        agent,
        "stream_llm_call",
        AsyncMock(side_effect=[(repeated_no_action_output, 10)] * 12),
    )

    result = await agent.run(
        {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {"single_risk_mode": False, "target_files": ["src/time64.c"]},
            "previous_results": {"bootstrap_findings": []},
            "task": "analysis",
        }
    )

    assert result.success is True
    assert isinstance(result.data, dict)
    assert result.data.get("degraded_reason") == "analysis_stagnation"
    assert result.tool_calls >= 1


@pytest.mark.asyncio
async def test_analysis_resets_empty_retry_counter_each_run(monkeypatch):
    agent = AnalysisAgent(
        llm_service=SimpleNamespace(),
        tools={"read_file": _DummyReadFileTool()},
        event_emitter=None,
    )
    # Simulate polluted state from a previous attempt.
    agent._empty_retry_count = 2

    llm_side_effects = [
        ("", 0),
        (
            "Thought: 先读取证据\n"
            "Action: read_file\n"
            'Action Input: {"file_path":"src/time64.c","start_line":1,"end_line":20}',
            10,
        ),
        ('Thought: 收敛完成\nFinal Answer: {"findings": [], "summary": "ok"}', 12),
    ]
    monkeypatch.setattr(agent, "stream_llm_call", AsyncMock(side_effect=llm_side_effects))

    result = await agent.run(
        {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {"single_risk_mode": False, "target_files": ["src/time64.c"]},
            "previous_results": {"bootstrap_findings": []},
            "task": "analysis",
        }
    )

    assert result.success is True
    assert agent._empty_retry_count == 0


@pytest.mark.asyncio
async def test_analysis_preserves_semantic_flow_fields_in_standardized_findings(monkeypatch):
    agent = AnalysisAgent(
        llm_service=SimpleNamespace(),
        tools={"read_file": _DummyReadFileTool()},
        event_emitter=None,
    )

    llm_side_effects = [
        (
            "Thought: 先读取代码上下文\n"
            "Action: read_file\n"
            'Action Input: {"file_path":"src/demo.py","start_line":1,"end_line":40}',
            10,
        ),
        (
            'Thought: 已完成分析\n'
            'Final Answer: {"findings":[{"vulnerability_type":"command_injection","severity":"high",'
            '"title":"src/demo.py中run函数命令注入漏洞","description":"用户输入拼接进系统命令。",'
            '"file_path":"src/demo.py","line_start":12,"line_end":18,"function_name":"run",'
            '"code_snippet":"os.system(\\"echo \\" + user_input)",'
            '"source":"request.args.get(\\"cmd\\")","sink":"os.system(command)",'
            '"attacker_flow":"GET /run?cmd=id -> run -> os.system(command)",'
            '"evidence_chain":["代码片段","数据流分析"],'
            '"taint_flow":["request.args.get(\\"cmd\\") -> command -> os.system(command)"],'
            '"variable_flow":["request.args.get(\\"cmd\\") -> user_input","user_input -> command"],'
            '"call_context":["GET /run 路由调用 run"],'
            '"input_output_relations":["cmd 参数决定最终执行的 shell 命令"],'
            '"sanitization_checks":["未发现 shell escaping 或 allowlist"],'
            '"attack_chain_steps":["攻击者控制 cmd","cmd 拼接进 command","os.system 执行命令"],'
            '"finding_metadata":{"sink_reachable":true,"upstream_call_chain":["GET /run","run()","os.system(command)"],'
            '"sink_trigger_condition":"公开路由可直接访问"},'
            '"suggestion":"改用参数数组并限制命令白名单"}],"summary":"ok"}',
            20,
        ),
    ]
    monkeypatch.setattr(agent, "stream_llm_call", AsyncMock(side_effect=llm_side_effects))

    result = await agent.run(
        {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {"single_risk_mode": False, "target_files": ["src/demo.py"]},
            "previous_results": {"recon": {"data": {"high_risk_areas": ["src/demo.py"]}}},
        }
    )

    assert result.success is True
    findings = result.data.get("findings") or []
    assert len(findings) == 1
    finding = findings[0]
    assert finding.get("attacker_flow") == "GET /run?cmd=id -> run -> os.system(command)"
    assert finding.get("evidence_chain") == ["代码片段", "数据流分析"]
    assert finding.get("taint_flow") == ["request.args.get(\"cmd\") -> command -> os.system(command)"]
    assert finding.get("variable_flow") == [
        "request.args.get(\"cmd\") -> user_input",
        "user_input -> command",
    ]
    assert finding.get("call_context") == ["GET /run 路由调用 run"]
    assert finding.get("input_output_relations") == ["cmd 参数决定最终执行的 shell 命令"]
    assert finding.get("sanitization_checks") == ["未发现 shell escaping 或 allowlist"]
    assert finding.get("attack_chain_steps") == [
        "攻击者控制 cmd",
        "cmd 拼接进 command",
        "os.system 执行命令",
    ]
    assert finding.get("finding_metadata") == {
        "sink_reachable": True,
        "upstream_call_chain": ["GET /run", "run()", "os.system(command)"],
        "sink_trigger_condition": "公开路由可直接访问",
    }


@pytest.mark.asyncio
async def test_analysis_skips_business_logic_single_risk_point():
    agent = AnalysisAgent(
        llm_service=SimpleNamespace(),
        tools={},
        event_emitter=None,
    )

    result = await agent.run(
        {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {
                "single_risk_mode": True,
                "single_risk_point": {
                    "file_path": "src/orders.py",
                    "line_start": 18,
                    "description": "order_id 来自用户输入且缺少所有权校验",
                    "vulnerability_type": "idor",
                },
            },
            "previous_results": {},
        }
    )

    assert result.success is True
    assert result.data.get("degraded_reason") == "analysis_scope_excludes_business_logic"
    assert result.data.get("scope_owner") == "business_logic_analysis"
    assert result.data.get("findings") == []


@pytest.mark.asyncio
async def test_analysis_rescues_regular_findings_even_when_business_logic_candidates_are_filtered(monkeypatch):
    push_tool = _DummyPushFindingTool()
    agent = AnalysisAgent(
        llm_service=SimpleNamespace(),
        tools={
            "get_code_window": _DummyReadFileTool(),
            "push_finding_to_queue": push_tool,
        },
        event_emitter=None,
    )

    llm_side_effects = [
        (
            "Thought: 先读取风险点附近代码\n"
            "Action: get_code_window\n"
            'Action Input: {"file_path":"src/demo.py","start_line":1,"end_line":40}',
            10,
        ),
        (
            'Thought: 已完成分析\n'
            'Final Answer: {"findings":['
            '{"vulnerability_type":"sql_injection","severity":"high",'
            '"title":"src/demo.py中query函数SQL注入漏洞",'
            '"description":"用户输入进入 SQL 查询，最终可能导致越权读取。",'
            '"file_path":"src/demo.py","line_start":12,"code_snippet":"cursor.execute(query)"},'
            '{"vulnerability_type":"idor","severity":"high",'
            '"title":"src/demo.py中update函数IDOR越权漏洞",'
            '"description":"order_id 缺少所有权校验。",'
            '"file_path":"src/demo.py","line_start":24,"code_snippet":"Order.query.get(order_id)"}'
            '],"summary":"ok"}',
            20,
        ),
    ]
    monkeypatch.setattr(agent, "stream_llm_call", AsyncMock(side_effect=llm_side_effects))

    result = await agent.run(
        {
            "project_info": {"name": "demo", "root": "/tmp/demo"},
            "config": {"single_risk_mode": False, "target_files": ["src/demo.py"]},
            "previous_results": {"bootstrap_findings": []},
            "task": "analysis",
        }
    )

    assert result.success is True
    assert [item["vulnerability_type"] for item in result.data.get("findings") or []] == ["sql_injection"]
    assert [item["vulnerability_type"] for item in result.data.get("filtered_scope_findings") or []] == ["idor"]
    assert len(push_tool.calls) == 1
    assert push_tool.calls[0]["vulnerability_type"] == "sql_injection"
