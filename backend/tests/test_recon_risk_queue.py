from app.services.agent.recon_risk_queue import InMemoryReconRiskQueue


def _sample_risk_point() -> dict:
    return {
        "file_path": "src/auth/login.py",
        "line_start": 88,
        "description": "possible sql injection",
        "severity": "high",
    }


def test_inmemory_recon_risk_queue_stats_method_callable():
    queue = InMemoryReconRiskQueue()
    task_id = "task-stats-callable"

    assert callable(queue.stats)
    assert queue.enqueue(task_id, _sample_risk_point()) is True

    stats = queue.stats(task_id)
    assert stats["current_size"] == 1
    assert stats["total_enqueued"] == 1
    assert stats["total_dequeued"] == 0


def test_inmemory_recon_risk_queue_enqueue_dequeue_clear_and_contains():
    queue = InMemoryReconRiskQueue()
    task_id = "task-queue-flow"
    point = _sample_risk_point()

    assert queue.enqueue(task_id, point) is True
    assert queue.contains(task_id, point) is True
    assert queue.size(task_id) == 1
    assert queue.peek(task_id, limit=1)[0]["file_path"] == point["file_path"]

    item = queue.dequeue(task_id)
    assert item is not None
    assert item["line_start"] == point["line_start"]
    assert queue.size(task_id) == 0

    assert queue.clear(task_id) is True
    stats = queue.stats(task_id)
    assert stats["current_size"] == 0
    assert stats["total_enqueued"] == 0
