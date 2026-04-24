import pytest

from app.services.agent import event_manager


def test_truncate_payload_respects_2mb_limit():
    small = "a" * 150_000
    value, truncated = event_manager._truncate_payload(small)
    assert value == small
    assert truncated is False

    huge = "b" * (event_manager.MAX_EVENT_PAYLOAD_CHARS + 123)
    value, truncated = event_manager._truncate_payload(huge)
    assert truncated is True
    assert len(value) == event_manager.MAX_EVENT_PAYLOAD_CHARS


def test_hidden_thinking_event_type_detection():
    manager = event_manager.EventManager()
    assert manager._is_hidden_thinking_event("thinking_token") is True
    assert manager._is_hidden_thinking_event("thinking") is True
    assert manager._is_hidden_thinking_event("llm_action") is True
    assert manager._is_hidden_thinking_event("llm_observation") is True
    assert manager._is_hidden_thinking_event("tool_result") is False


@pytest.mark.asyncio
async def test_add_event_drops_thinking_events_from_queue_and_db(monkeypatch):
    manager = event_manager.EventManager(db_session_factory=True)
    task_id = "task-hidden"
    manager.create_queue(task_id)

    saved_events = []

    async def fake_save(event_data):
        saved_events.append(event_data)

    manager._save_event_to_db = fake_save  # type: ignore[attr-defined]

    await manager.add_event(
        task_id=task_id,
        event_type="llm_thought",
        sequence=1,
        message="should be hidden",
        metadata={"agent_name": "Recon"},
    )

    queue = manager._event_queues[task_id]
    assert queue.qsize() == 0
    assert saved_events == []


@pytest.mark.asyncio
async def test_add_event_keeps_key_events_visible(monkeypatch):
    manager = event_manager.EventManager(db_session_factory=True)
    task_id = "task-visible"
    manager.create_queue(task_id)

    saved_events = []

    async def fake_save(event_data):
        saved_events.append(event_data)

    manager._save_event_to_db = fake_save  # type: ignore[attr-defined]

    await manager.add_event(
        task_id=task_id,
        event_type="tool_result",
        sequence=1,
        message="tool finished",
        tool_name="search_code",
        tool_output={"result": "ok"},
    )

    queue = manager._event_queues[task_id]
    assert queue.qsize() == 1
    assert len(saved_events) == 1
    assert saved_events[0]["event_type"] == "tool_result"
