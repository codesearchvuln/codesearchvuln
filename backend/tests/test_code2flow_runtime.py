from pathlib import Path
from types import SimpleNamespace

from app.services.agent.flow.lightweight.callgraph_code2flow import Code2FlowCallGraph


def test_code2flow_runtime_prefers_backend_venv_binary(monkeypatch, tmp_path):
    source_file = tmp_path / "demo.py"
    source_file.write_text("def caller():\n    callee()\n\ndef callee():\n    return 1\n", encoding="utf-8")

    seen = {}

    monkeypatch.setattr(
        "app.services.agent.flow.lightweight.callgraph_code2flow.resolve_backend_venv_executable",
        lambda name, required=False: f"/opt/backend-venv/bin/{name}",
    )

    def _fake_run(cmd, **kwargs):
        seen["cmd"] = cmd
        output_flag = "-o" if "-o" in cmd else "--output"
        output_path = Path(cmd[cmd.index(output_flag) + 1])
        output_path.write_text('"caller" -> "callee"\n', encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(
        "app.services.agent.flow.lightweight.callgraph_code2flow.subprocess.run",
        _fake_run,
    )

    graph = Code2FlowCallGraph(project_root=str(tmp_path), max_files=10)
    result = graph.generate()

    assert seen["cmd"][0] == "/opt/backend-venv/bin/code2flow"
    assert result.used_engine == "code2flow"
    assert "caller" in result.edges
