from app.api.v1.endpoints import agent_tasks_execution


def test_build_workflow_config_from_user_config_uses_resolved_runtime_counts(
    monkeypatch,
):
    monkeypatch.setattr(
        agent_tasks_execution,
        "resolve_effective_agent_workflow_config",
        lambda _other_config: {
            "recon_count": 3,
            "analysis_count": 7,
            "verification_count": 2,
        },
    )

    workflow_config = agent_tasks_execution._build_workflow_config_from_user_config(
        {
            "otherConfig": {
                "agent_workflow_config": {
                    "recon_count": 3,
                    "analysis_count": 7,
                    "verification_count": 2,
                }
            }
        }
    )

    assert workflow_config.recon_max_workers == 3
    assert workflow_config.analysis_max_workers == 7
    assert workflow_config.verification_max_workers == 2
    assert workflow_config.use_agent_count_config_file is False
