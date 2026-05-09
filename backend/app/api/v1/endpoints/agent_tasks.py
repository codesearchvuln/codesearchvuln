"""Facade and compatibility exports for agent task endpoints."""

from fastapi import APIRouter

from .agent_tasks_bootstrap import *  # noqa: F401,F403
from .agent_tasks_contracts import *  # noqa: F401,F403
from .agent_tasks_execution import *  # noqa: F401,F403
from .agent_tasks_findings import *  # noqa: F401,F403
from .agent_tasks_log_export import (
    export_agent_task_logs as export_agent_task_logs,
)
from .agent_tasks_log_export import (
    router as _log_export_router,
)
from .agent_tasks_reporting import (
    generate_audit_report as generate_audit_report,
)
from .agent_tasks_reporting import (
    router as _reporting_router,
)
from .agent_tasks_routes_results import *  # noqa: F401,F403
from .agent_tasks_routes_results import router as _results_router
from .agent_tasks_routes_tasks import *  # noqa: F401,F403
from .agent_tasks_routes_tasks import router as _tasks_router
from .agent_tasks_runtime import *  # noqa: F401,F403
from .agent_tasks_tool_runtime import *  # noqa: F401,F403

router = APIRouter()
router.include_router(_tasks_router)
router.include_router(_results_router)
router.include_router(_log_export_router)
router.include_router(_reporting_router)
