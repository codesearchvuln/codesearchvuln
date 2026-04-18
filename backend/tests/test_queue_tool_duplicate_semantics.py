import pytest

from app.services.agent.business_logic_risk_queue import InMemoryBusinessLogicRiskQueue
from app.services.agent.recon_risk_queue import InMemoryReconRiskQueue
from app.services.agent.tools.business_logic_recon_queue_tools import (
    PushBLRiskPointToQueueTool,
    PushBLRiskPointsBatchToQueueTool,
)
from app.services.agent.tools.queue_tools import PushFindingToQueueTool
from app.services.agent.tools.recon_queue_tools import (
    PushRiskPointToQueueTool,
    PushRiskPointsBatchToQueueTool,
)
from app.services.agent.vulnerability_queue import InMemoryVulnerabilityQueue


TASK_ID = "duplicate-semantics"


def _make_recon_point() -> dict:
    return {
        "file_path": "src/auth.py",
        "line_start": 42,
        "description": "SQL query uses user input directly",
        "severity": "high",
        "confidence": 0.8,
        "vulnerability_type": "sql_injection",
    }


def _make_bl_point() -> dict:
    return {
        "file_path": "app/api/orders.py",
        "line_start": 21,
        "description": "update_order misses ownership check",
        "severity": "high",
        "confidence": 0.75,
        "vulnerability_type": "idor",
        "entry_function": "update_order",
        "context": "PUT /api/orders/{order_id}",
    }


def _make_finding() -> dict:
    return {
        "file_path": "src/auth.py",
        "line_start": 42,
        "title": "src/auth.py中login函数SQL注入漏洞",
        "description": "SQL query uses user input directly",
        "severity": "high",
        "confidence": 0.8,
        "vulnerability_type": "sql_injection",
    }


@pytest.mark.asyncio
async def test_push_risk_point_duplicate_is_idempotent_success():
    queue = InMemoryReconRiskQueue()
    tool = PushRiskPointToQueueTool(queue_service=queue, task_id=TASK_ID)
    point = _make_recon_point()

    first = await tool.execute(**point)
    second = await tool.execute(**point)

    assert first.success is True
    assert first.data["enqueue_status"] == "enqueued"
    assert first.data["duplicate_skipped"] is False

    assert second.success is True
    assert second.data["enqueue_status"] == "duplicate_skipped"
    assert second.data["duplicate_skipped"] is True
    assert "queue_size" not in second.data
    assert queue.size(TASK_ID) == 1


@pytest.mark.asyncio
async def test_push_risk_points_batch_reports_duplicate_count():
    queue = InMemoryReconRiskQueue()
    tool = PushRiskPointsBatchToQueueTool(queue_service=queue, task_id=TASK_ID)
    point = _make_recon_point()

    result = await tool.execute(risk_points=[point, dict(point)])

    assert result.success is True
    assert result.data["enqueued"] == 1
    assert result.data["duplicate_skipped"] == 1
    assert "queue_size" not in result.data


@pytest.mark.asyncio
async def test_recon_queue_keeps_structurally_distinct_points_on_same_line():
    queue = InMemoryReconRiskQueue()
    tool = PushRiskPointsBatchToQueueTool(queue_service=queue, task_id=TASK_ID)
    base = _make_recon_point()

    first = dict(base, entry_function="login", trust_boundary="HTTP -> auth -> SQL")
    second = dict(base, entry_function="admin_search", trust_boundary="HTTP -> admin -> SQL")

    result = await tool.execute(risk_points=[first, second])

    assert result.success is True
    assert result.data["enqueued"] == 2
    assert result.data["duplicate_skipped"] == 0
    assert "queue_size" not in result.data


@pytest.mark.asyncio
async def test_push_finding_duplicate_after_dequeue_reports_duplicate_status():
    queue = InMemoryVulnerabilityQueue()
    tool = PushFindingToQueueTool(queue, TASK_ID)
    finding = _make_finding()

    first = await tool.execute(**finding)
    assert first.success is True
    assert first.data["enqueue_status"] == "enqueued"
    assert first.data["duplicate_skipped"] is False
    assert "queue_size" not in first.data

    dequeued = queue.dequeue_finding(TASK_ID)
    assert dequeued is not None
    assert queue.get_queue_size(TASK_ID) == 0

    second = await tool.execute(**finding)
    assert second.success is True
    assert second.data["enqueue_status"] == "duplicate_skipped"
    assert second.data["duplicate_skipped"] is True
    assert "queue_size" not in second.data
    assert queue.get_queue_size(TASK_ID) == 0


@pytest.mark.asyncio
async def test_push_bl_risk_point_duplicate_is_idempotent_success():
    queue = InMemoryBusinessLogicRiskQueue()
    tool = PushBLRiskPointToQueueTool(queue_service=queue, task_id=TASK_ID)
    point = _make_bl_point()

    first = await tool.execute(**point)
    second = await tool.execute(**point)

    assert first.success is True
    assert first.data["enqueue_status"] == "enqueued"
    assert first.data["duplicate_skipped"] is False

    assert second.success is True
    assert second.data["enqueue_status"] == "duplicate_skipped"
    assert second.data["duplicate_skipped"] is True
    assert "queue_size" not in second.data
    assert queue.size(TASK_ID) == 1


@pytest.mark.asyncio
async def test_push_bl_risk_points_batch_reports_duplicate_count():
    queue = InMemoryBusinessLogicRiskQueue()
    tool = PushBLRiskPointsBatchToQueueTool(queue_service=queue, task_id=TASK_ID)
    point = _make_bl_point()

    result = await tool.execute(risk_points=[point, dict(point)])

    assert result.success is True
    assert result.data["enqueued"] == 1
    assert result.data["duplicate_skipped"] == 1
    assert "queue_size" not in result.data
