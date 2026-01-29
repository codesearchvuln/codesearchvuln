from app.services.upload.project_stats import generate_project_description
import asyncio
from app.models.project_info import ProjectInfo


async def test_generate_project_description():
    uuid = "c4a41891-046d-48a7-a46b-7f68fc8a6fc0"
    project_info = ProjectInfo()
    project_info.project_id = uuid
    return await generate_project_description(project_info)


result = asyncio.run(test_generate_project_description())

print(result["project_description"])
