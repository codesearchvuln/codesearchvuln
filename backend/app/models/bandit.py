"""
Bandit 静态扫描模型 - 数据库表定义
包括扫描任务和发现结果
"""

import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class BanditScanTask(Base):
    """Bandit 扫描任务"""

    __tablename__ = "bandit_scan_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="pending", comment="pending, running, completed, failed")
    target_path = Column(String, nullable=False, comment="扫描的目标路径")
    total_findings = Column(Integer, default=0, comment="发现总数")
    high_count = Column(Integer, default=0, comment="高危数量")
    medium_count = Column(Integer, default=0, comment="中危数量")
    low_count = Column(Integer, default=0, comment="低危数量")
    high_confidence_count = Column(Integer, default=0, comment="高置信度数量")
    scan_duration_ms = Column(Integer, default=0, comment="扫描耗时(毫秒)")
    files_scanned = Column(Integer, default=0, comment="已扫描文件数")
    error_message = Column(Text, nullable=True, comment="错误信息")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_bandit_tasks_project_created_at", "project_id", created_at.desc()),
        Index(
            "ix_bandit_tasks_project_lower_status_created_at",
            "project_id",
            func.lower(status),
            created_at.desc(),
        ),
    )

    project = relationship("Project", back_populates="bandit_scan_tasks")
    findings = relationship(
        "BanditFinding", back_populates="scan_task", cascade="all, delete-orphan"
    )


class BanditFinding(Base):
    """Bandit 扫描发现"""

    __tablename__ = "bandit_findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_task_id = Column(String, ForeignKey("bandit_scan_tasks.id"), nullable=False)
    test_id = Column(String, nullable=False, comment="Bandit 规则 ID")
    test_name = Column(String, nullable=True, comment="Bandit 规则名称")
    issue_text = Column(Text, nullable=True, comment="问题描述")
    file_path = Column(String, nullable=False, comment="文件路径")
    line_number = Column(Integer, nullable=True, comment="命中行号")
    issue_severity = Column(String, nullable=False, default="LOW", comment="严重程度")
    issue_confidence = Column(String, nullable=False, default="LOW", comment="置信度")
    code = Column(Text, nullable=True, comment="命中代码片段")
    more_info = Column(String, nullable=True, comment="规则文档链接")
    status = Column(String, default="open", comment="open, verified, false_positive, fixed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "ix_bandit_findings_scan_task_status_created",
            "scan_task_id",
            "status",
            created_at.desc(),
        ),
        Index(
            "ix_bandit_findings_scan_task_file_line",
            "scan_task_id",
            "file_path",
            "line_number",
        ),
        Index("ix_bandit_findings_test_id", "test_id"),
    )

    scan_task = relationship("BanditScanTask", back_populates="findings")

