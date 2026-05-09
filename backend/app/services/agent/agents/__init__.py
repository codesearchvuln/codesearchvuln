"""
混合 Agent 架构
包含 Orchestrator、Recon、Analysis 和 Verification Agent

协作机制：
- Agent 之间通过 TaskHandoff 传递结构化上下文
- 每个 Agent 完成后生成 handoff 给下一个 Agent
"""

from .analysis import AnalysisAgent
from .base import AgentConfig, AgentResult, BaseAgent, TaskHandoff
from .business_logic_analysis import BusinessLogicAnalysisAgent
from .business_logic_recon import BusinessLogicReconAgent
from .business_logic_scan import BusinessLogicScanAgent
from .orchestrator import OrchestratorAgent
from .recon import ReconAgent
from .recon_subagent import ReconSubAgent
from .report import ReportAgent
from .verification import VerificationAgent

__all__ = [
    "BaseAgent",
    "AgentConfig",
    "AgentResult",
    "TaskHandoff",
    "OrchestratorAgent",
    "ReconAgent",
    "ReconSubAgent",
    "AnalysisAgent",
    "VerificationAgent",
    "BusinessLogicScanAgent",
    "BusinessLogicReconAgent",
    "BusinessLogicAnalysisAgent",
    "ReportAgent",
]
