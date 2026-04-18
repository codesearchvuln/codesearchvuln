from app.api.v1.endpoints.agent_tasks_access import build_agent_task_response
from app.api.v1.endpoints.agent_tasks_runtime import _running_orchestrators
from app.models.agent_task import AgentTask, AgentTaskPhase, AgentTaskStatus


class _WorkflowPhaseStub:
    def __init__(self, phase: str):
        self._phase = phase

    def get_current_workflow_phase(self):
        return self._phase

    def get_stats(self):
        return {"iterations": 0, "tool_calls": 0, "tokens_used": 0}

    sub_agents = {}


def test_build_agent_task_response_prefers_runtime_workflow_phase_for_running_task():
    task = AgentTask(
        id="task-runtime-phase",
        project_id="project-1",
        created_by="user-1",
        status=AgentTaskStatus.RUNNING,
        current_phase=AgentTaskPhase.ANALYSIS,
        current_step="分析阶段进行中",
        total_files=0,
    )
    _running_orchestrators[task.id] = _WorkflowPhaseStub("recon")
    try:
        response = build_agent_task_response(task)
    finally:
        _running_orchestrators.pop(task.id, None)

    assert response.workflow_phase == "recon"
    assert response.display_phase == "recon"


def test_build_agent_task_response_marks_hybrid_static_scan_from_current_step():
    task = AgentTask(
        id="task-hybrid-static",
        project_id="project-1",
        created_by="user-1",
        name="混合扫描任务",
        description="[HYBRID] demo",
        status=AgentTaskStatus.RUNNING,
        current_phase=AgentTaskPhase.RECONNAISSANCE,
        current_step="静态预扫进行中",
        total_files=0,
    )

    response = build_agent_task_response(task)

    assert response.workflow_phase == AgentTaskPhase.RECONNAISSANCE
    assert response.display_phase == "static_scan"
