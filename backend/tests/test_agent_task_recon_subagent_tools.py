from app.api.v1.endpoints import agent_tasks_execution


def test_build_recon_subagent_tools_keeps_queue_push_tools():
    recon_tools = {
        "list_files": object(),
        "run_recon_subagent": object(),
        "push_risk_point_to_queue": object(),
        "push_risk_points_to_queue": object(),
        "get_recon_risk_queue_status": object(),
        "dequeue_recon_risk_point": object(),
        "peek_recon_risk_queue": object(),
        "clear_recon_risk_queue": object(),
        "is_recon_risk_point_in_queue": object(),
    }

    filtered = agent_tasks_execution._build_recon_subagent_tools(recon_tools)

    assert "list_files" in filtered
    assert "push_risk_point_to_queue" in filtered
    assert "push_risk_points_to_queue" in filtered
    assert "run_recon_subagent" not in filtered
    assert "get_recon_risk_queue_status" not in filtered
    assert "dequeue_recon_risk_point" not in filtered
    assert "peek_recon_risk_queue" not in filtered
    assert "clear_recon_risk_queue" not in filtered
    assert "is_recon_risk_point_in_queue" not in filtered
