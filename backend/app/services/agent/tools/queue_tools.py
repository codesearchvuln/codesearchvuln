"""
Orchestrator 漏洞队列管理工具
"""

import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class GetQueueStatusTool:
    """获取队列中待验证漏洞数量"""

    def __init__(self, queue_service, task_id: str):
        """
        Args:
            queue_service: VulnerabilityQueue 实例
            task_id: 审计任务 ID
        """
        self.queue_service = queue_service
        self.task_id = task_id
        self.name = "get_queue_status"
        self.description = (
            "获取当前待验证漏洞队列的状态信息，返回队列大小、"
            "总入队数、总出队数等统计数据。"
        )

    def get_schema(self) -> Dict[str, Any]:
        """工具的输入 schema"""
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }

    async def execute(self, **kwargs) -> str:
        """执行工具"""
        try:
            stats = self.queue_service.get_queue_stats(self.task_id)
            
            # 获取队列前几项预览
            peek_findings = self.queue_service.peek_queue(self.task_id, limit=3)
            peek_list = []
            for finding in peek_findings:
                if isinstance(finding, dict):
                    peek_list.append({
                        "file_path": finding.get("file_path", "N/A"),
                        "line": finding.get("line_start", "N/A"),
                        "title": finding.get("title", "N/A"),
                        "severity": finding.get("severity", "N/A"),
                    })
            
            result = {
                "success": True,
                "queue_status": {
                    "current_size": stats.get("current_size", 0),
                    "total_enqueued": stats.get("total_enqueued", 0),
                    "total_dequeued": stats.get("total_dequeued", 0),
                    "last_enqueue_time": stats.get("last_enqueue_time"),
                    "last_dequeue_time": stats.get("last_dequeue_time"),
                },
                "pending_count": stats.get("current_size", 0),
                "peek": peek_list,
            }
            
            logger.info(
                f"[Queue] Status check for task {self.task_id}: "
                f"{result['pending_count']} pending findings"
            )
            
            return json.dumps(result, ensure_ascii=False, indent=2)
        
        except Exception as e:
            logger.error(f"[Queue] Failed to get queue status: {e}")
            return json.dumps({
                "success": False,
                "error": str(e),
                "pending_count": 0,
            }, ensure_ascii=False)


class DequeueFindinGTool:
    """从队列中取出一条漏洞进行验证"""

    def __init__(self, queue_service, task_id: str):
        """
        Args:
            queue_service: VulnerabilityQueue 实例
            task_id: 审计任务 ID
        """
        self.queue_service = queue_service
        self.task_id = task_id
        self.name = "dequeue_finding"
        self.description = (
            "从待验证漏洞队列中取出第一条漏洞。"
            "该漏洞应当被立即传递给 Verification Agent 进行验证。"
            "若队列为空，返回 null。"
        )

    def get_schema(self) -> Dict[str, Any]:
        """工具的输入 schema"""
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }

    async def execute(self, **kwargs) -> str:
        """执行工具"""
        try:
            finding = self.queue_service.dequeue_finding(self.task_id)
            
            if finding is None:
                result = {
                    "success": True,
                    "finding": None,
                    "queue_remaining": 0,
                }
                logger.info(f"[Queue] Queue empty for task {self.task_id}")
            else:
                remaining = self.queue_service.get_queue_size(self.task_id)
                result = {
                    "success": True,
                    "finding": finding,
                    "queue_remaining": remaining,
                    "file_path": finding.get("file_path"),
                    "line_start": finding.get("line_start"),
                    "title": finding.get("title"),
                    "severity": finding.get("severity"),
                }
                logger.info(
                    f"[Queue] Dequeued finding from task {self.task_id}: "
                    f"{finding.get('file_path')} (remaining: {remaining})"
                )
            
            return json.dumps(result, ensure_ascii=False, indent=2)
        
        except Exception as e:
            logger.error(f"[Queue] Failed to dequeue finding: {e}")
            return json.dumps({
                "success": False,
                "error": str(e),
                "finding": None,
            }, ensure_ascii=False)


class PushFindingToQueueTool:
    """Analysis Agent 使用：将发现的漏洞推送到队列"""

    def __init__(self, queue_service, task_id: str):
        """
        Args:
            queue_service: VulnerabilityQueue 实例
            task_id: 审计任务 ID
        """
        self.queue_service = queue_service
        self.task_id = task_id
        self.name = "push_finding_to_queue"
        self.description = (
            "将 Analysis Agent 发现的漏洞推送到全局队列，"
            "供 Orchestrator 调度 Verification Agent 验证。"
        )

    def get_schema(self) -> Dict[str, Any]:
        """工具的输入 schema"""
        return {
            "type": "object",
            "properties": {
                "finding": {
                    "type": "object",
                    "description": "漏洞信息对象",
                    "properties": {
                        "file_path": {"type": "string"},
                        "line_start": {"type": "integer"},
                        "line_end": {"type": "integer"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "vulnerability_type": {"type": "string"},
                        "severity": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["file_path", "line_start", "title", "vulnerability_type"],
                }
            },
            "required": ["finding"],
        }

    async def execute(self, finding: Dict[str, Any], **kwargs) -> str:
        """执行工具"""
        try:
            if not isinstance(finding, dict):
                return json.dumps({
                    "success": False,
                    "error": "finding must be a dict",
                }, ensure_ascii=False)
            
            success = self.queue_service.enqueue_finding(self.task_id, finding)
            
            if success:
                queue_size = self.queue_service.get_queue_size(self.task_id)
                result = {
                    "success": True,
                    "message": f"漏洞已入队，当前队列大小: {queue_size}",
                    "queue_size": queue_size,
                }
                logger.info(
                    f"[Queue] Finding enqueued for task {self.task_id}: "
                    f"{finding.get('file_path')} (queue size: {queue_size})"
                )
            else:
                result = {
                    "success": False,
                    "error": "Failed to enqueue finding",
                }
                logger.error(f"[Queue] Failed to enqueue finding for task {self.task_id}")
            
            return json.dumps(result, ensure_ascii=False, indent=2)
        
        except Exception as e:
            logger.error(f"[Queue] Failed to push finding: {e}")
            return json.dumps({
                "success": False,
                "error": str(e),
            }, ensure_ascii=False)
