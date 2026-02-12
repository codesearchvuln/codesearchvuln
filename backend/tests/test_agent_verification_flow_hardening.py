from types import SimpleNamespace

import pytest

from app.services.agent.agents.verification import VerificationAgent
import app.models.opengrep  # noqa: F401
import app.models.gitleaks  # noqa: F401


def _make_agent() -> VerificationAgent:
    return VerificationAgent(
        llm_service=SimpleNamespace(),
        tools={"read_file": object(), "extract_function": object()},
        event_emitter=None,
    )


def test_verification_detects_interactive_drift_patterns():
    agent = _make_agent()
    assert agent._contains_interactive_drift("你需要选择下一步操作")
    assert agent._contains_interactive_drift("Please confirm whether to continue")
    assert not agent._contains_interactive_drift("已完成验证并输出结果")


def test_verification_repair_final_answer_fills_required_fields_and_defaults():
    agent = _make_agent()
    findings_to_verify = [
        {
            "title": "SQL injection in query endpoint",
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "file_path": "src/api/query.py",
            "line_start": 88,
            "line_end": 89,
            "code_snippet": "cursor.execute(f\"SELECT * FROM t WHERE id = '{user_id}'\")",
        }
    ]
    raw_answer = {
        "findings": [
            {
                "title": "SQL injection in query endpoint",
                "severity": "high",
                "vulnerability_type": "sql_injection",
                "verdict": "confirmed",
            }
        ]
    }

    repaired = agent._repair_final_answer(
        raw_answer,
        findings_to_verify,
        "analysis_with_poc_plan",
    )
    ok, err = agent._validate_final_answer_schema(repaired)

    assert ok, err
    finding = repaired["findings"][0]
    assert finding["file_path"] == "src/api/query.py"
    assert finding["line_start"] == 88
    assert finding["line_end"] == 89
    assert finding["reachability"] in {"reachable", "likely_reachable", "unreachable"}
    assert finding["suggestion"]
    assert finding["fix_code"]
    assert finding.get("poc") is not None


def test_verification_repair_final_answer_adds_poc_plan_for_confirmed_or_likely():
    agent = _make_agent()
    findings_to_verify = [
        {
            "title": "critical cmd injection",
            "vulnerability_type": "command_injection",
            "severity": "critical",
            "file_path": "src/cmd.py",
            "line_start": 10,
            "line_end": 10,
        },
        {
            "title": "medium xss",
            "vulnerability_type": "xss",
            "severity": "medium",
            "file_path": "src/view.py",
            "line_start": 20,
            "line_end": 20,
        },
    ]
    raw_answer = {
        "findings": [
            {
                "title": "critical cmd injection",
                "severity": "critical",
                "vulnerability_type": "command_injection",
                "file_path": "src/cmd.py",
                "line_start": 10,
                "line_end": 10,
                "verdict": "confirmed",
                "reachability": "reachable",
                "verification_details": "confirmed by harness",
                "poc": {"description": "poc", "payload": "python poc.py"},
            },
            {
                "title": "medium xss",
                "severity": "medium",
                "vulnerability_type": "xss",
                "file_path": "src/view.py",
                "line_start": 20,
                "line_end": 20,
                "verdict": "confirmed",
                "reachability": "reachable",
                "verification_details": "confirmed by read_file",
                "poc": {"description": "should be removed", "payload": "bad"},
            },
        ]
    }

    repaired = agent._repair_final_answer(
        raw_answer,
        findings_to_verify,
        "analysis_with_poc_plan",
    )

    assert repaired["findings"][0].get("poc") is not None
    assert repaired["findings"][1].get("poc") is not None
