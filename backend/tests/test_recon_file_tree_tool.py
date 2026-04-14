import pytest

from app.services.agent.tools.recon_file_tree_tool import UpdateReconFileTreeTool


@pytest.mark.asyncio
async def test_recon_file_tree_build_collapses_multi_file_directories(tmp_path):
    tool = UpdateReconFileTreeTool(task_id="task-1", base_dir=tmp_path)

    result = await tool.execute(
        action="build",
        files=[
            "src/a.py",
            "src/b.py",
            "src/api/routes.py",
            "docs/index.md",
            "docs/guide.md",
            "README.md",
            "package.json",
        ],
    )

    assert result.success is True
    assert tool._tree == ["README.md", "docs", "package.json", "src", "src/api/routes.py"]
    assert tool._directory_entries == {"docs", "src"}
    assert "- [ ] docs/" in result.data
    assert "- [ ] src/" in result.data
    assert "- [ ] src/api/routes.py" in result.data
    assert "- [ ] src/a.py" not in result.data
    assert "- [ ] src/b.py" not in result.data
    assert "- [ ] ." not in result.data


@pytest.mark.asyncio
async def test_recon_file_tree_mark_done_maps_file_to_directory_entry(tmp_path):
    tool = UpdateReconFileTreeTool(task_id="task-2", base_dir=tmp_path)

    await tool.execute(
        action="build",
        files=[
            "src/a.py",
            "src/b.py",
            "src/api/routes.py",
        ],
    )

    result = await tool.execute(action="mark_done", file_path="src/a.py")

    assert result.success is True
    assert "src" in tool._done
    assert "src/api/routes.py" not in tool._done
    assert "已标记「src/」为侦查完成" in result.data
    assert "- [x] src/" in result.data
    assert "- [ ] src/api/routes.py" in result.data


@pytest.mark.asyncio
async def test_recon_file_tree_mark_done_prefers_exact_file_over_parent_directory(tmp_path):
    tool = UpdateReconFileTreeTool(task_id="task-3", base_dir=tmp_path)

    await tool.execute(
        action="build",
        files=[
            "src/a.py",
            "src/b.py",
            "src/api/routes.py",
        ],
    )

    result = await tool.execute(action="mark_done", file_path="src/api/routes.py")

    assert result.success is True
    assert "src/api/routes.py" in tool._done
    assert "src" not in tool._done
    assert "已标记「src/api/routes.py」为侦查完成" in result.data
    assert "- [x] src/api/routes.py" in result.data
    assert "- [ ] src/" in result.data
