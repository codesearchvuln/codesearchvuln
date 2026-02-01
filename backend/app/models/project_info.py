from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base import Base
import uuid
from sqlalchemy.sql import func


class ProjectInfo(Base):
    __tablename__ = "project_info"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    language_info = Column(JSON, nullable=True, comment="项目所用编程语言信息, JSON格式")
    description = Column(String, nullable=True, comment="项目描述, 由大模型生成")
    status = Column(String, default="pending", comment="信息状态: pending, completed, failed")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")

    # Relationships
    project = relationship("Project", back_populates="infos")
