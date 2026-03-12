import ast
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"


def test_agent_specific_rag_modules_are_removed() -> None:
    knowledge_root = BACKEND_ROOT / "app/services/agent/knowledge"
    assert not any(knowledge_root.glob("**/*.py"))
    assert not (BACKEND_ROOT / "app/services/agent/tools/rag_tool.py").exists()


def test_initialize_tools_no_longer_exposes_rag_toggle() -> None:
    agent_tasks_path = BACKEND_ROOT / "app/api/v1/endpoints/agent_tasks.py"
    module = ast.parse(agent_tasks_path.read_text(encoding="utf-8"))
    init_tools = next(
        node
        for node in module.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "_initialize_tools"
    )
    param_names = [arg.arg for arg in init_tools.args.args]

    assert "rag_enabled" not in param_names


def test_agent_tree_types_no_longer_expose_knowledge_modules() -> None:
    backend_agent_tasks = (BACKEND_ROOT / "app/api/v1/endpoints/agent_tasks.py").read_text(
        encoding="utf-8"
    )
    frontend_agent_tasks = (REPO_ROOT / "frontend/src/shared/api/agentTasks.ts").read_text(
        encoding="utf-8"
    )

    assert "knowledge_modules:" not in backend_agent_tasks
    assert "knowledge_modules:" not in frontend_agent_tasks
