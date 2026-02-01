from app.services.upload.project_stats import generate_project_description
import asyncio
from app.models.project_info import ProjectInfo
# 🔥 导入所有模型以确保 SQLAlchemy 注册表完整
from app.models import project, opengrep, agent_task  # noqa


async def test_generate_project_description():
    uuid = "9dd1a552-c953-4ccd-a00e-b4a45fcdb050"
    project_info = ProjectInfo()
    project_info.project_id = uuid
    return await generate_project_description(project_info)


result = asyncio.run(test_generate_project_description())

print(result["project_description"])
