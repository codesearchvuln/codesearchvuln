"""
Recon 文件侦查追踪工具

维护一个文件树 Markdown 文档，供 Recon Agent 追踪侦查进度。
- action="build"：Agent 完成初始 list_files 后调用，建立侦查清单
- action="mark_done"：Agent 认为某文件侦查完成后调用
- action="status"：查看当前进度
持久化路径：uploads/agent_memory/projects/{task_id}/recon_file_tree.md
"""

import logging
from pathlib import Path
from typing import List, Optional, Set

from pydantic import BaseModel, Field

from .base import AgentTool, ToolResult

logger = logging.getLogger(__name__)

_DEFAULT_BASE_DIR = Path("./uploads/agent_memory/projects")


def _normalize_path(path: str) -> str:
    """规范化文件路径：去除前导 ./ 和多余斜杠，统一为正斜杠。"""
    normalized = str(path or "").replace("\\", "/").strip()
    while normalized.startswith("./"):
        normalized = normalized[2:]
    while normalized.startswith("/"):
        normalized = normalized[1:]
    while "//" in normalized:
        normalized = normalized.replace("//", "/")
    while normalized.endswith("/"):
        normalized = normalized[:-1]
    return normalized


def _compress_tree(files: List[str]) -> tuple[List[str], Set[str]]:
    """将文件列表压缩为侦查项。

    规则：
    - 根目录下文件保留为文件项
    - 同一目录下若存在多个直接文件，则仅保留该目录
    - 同一目录下若只有一个直接文件，则保留该文件而不保留目录
    """
    normalized_files: List[str] = []
    seen_files: Set[str] = set()
    for file_path in files:
        normalized = _normalize_path(file_path)
        if not normalized or normalized in seen_files:
            continue
        seen_files.add(normalized)
        normalized_files.append(normalized)

    files_by_directory: dict[str, List[str]] = {}
    for file_path in normalized_files:
        parent = _normalize_path(str(Path(file_path).parent))
        if parent == ".":
            parent = ""
        files_by_directory.setdefault(parent, []).append(file_path)

    tree: List[str] = []
    directory_entries: Set[str] = set()
    for directory, directory_files in files_by_directory.items():
        if not directory:
            tree.extend(directory_files)
            continue
        if len(directory_files) == 1:
            tree.append(directory_files[0])
            continue
        tree.append(directory)
        directory_entries.add(directory)

    return sorted(tree), directory_entries


def _find_best_match(file_path: str, tree: List[str], directory_entries: Set[str]) -> Optional[str]:
    """在侦查清单中查找最佳匹配项。"""
    normalized = _normalize_path(file_path)
    if not normalized:
        return None

    # 精确匹配
    if normalized in tree:
        return normalized

    # 目录匹配：文件命中目录项时，优先返回最长目录前缀
    directory_matches = [
        candidate
        for candidate in tree
        if candidate in directory_entries and normalized.startswith(candidate + "/")
    ]
    if directory_matches:
        return max(directory_matches, key=len)

    # 后缀包含匹配：查找以 normalized 结尾的文件路径
    for candidate in tree:
        if candidate in directory_entries:
            continue
        if candidate.endswith(normalized) or normalized.endswith(candidate):
            return candidate

    # 文件名匹配：仅用文件名部分匹配文件项
    base_name = normalized.split("/")[-1]
    if base_name:
        for candidate in tree:
            if candidate in directory_entries:
                continue
            if candidate.split("/")[-1] == base_name:
                return candidate

    return None


def _display_entry(entry: str, directory_entries: Set[str]) -> str:
    return f"{entry}/" if entry in directory_entries else entry


def _build_markdown(tree: List[str], done: Set[str], directory_entries: Set[str]) -> str:
    """生成侦查追踪 Markdown 文档。"""
    total = len(tree)
    done_count = sum(1 for f in tree if f in done)
    pending_count = total - done_count

    lines = [f"## 📂 侦查清单（{done_count}/{total} 已侦查）", ""]

    done_files = [f for f in tree if f in done]
    pending_files = [f for f in tree if f not in done]

    if done_files:
        lines.append(f"### 已侦查（{len(done_files)}项）")
        for f in done_files:
            lines.append(f"- [x] {_display_entry(f, directory_entries)}")
        lines.append("")

    if pending_files:
        lines.append(f"### ⏳ 待侦查（{pending_count}项）")
        for f in pending_files:
            lines.append(f"- [ ] {_display_entry(f, directory_entries)}")
        lines.append("")

    return "\n".join(lines)


class UpdateReconFileTreeInput(BaseModel):
    action: str = Field(
        ...,
        description="操作类型：build（建立文件树）| mark_done（标记文件为已侦查）| status（查看当前进度）",
    )
    files: Optional[List[str]] = Field(
        None,
        description="文件路径列表（action=build 时使用）",
    )
    file_path: Optional[str] = Field(
        None,
        description="单个文件路径（action=mark_done 时使用）",
    )


class UpdateReconFileTreeTool(AgentTool):
    """Recon 文件侦查追踪工具。

    Agent 应在侦查开始时调用 action="build" 建立清单，
    之后每完成对一个文件的侦查即调用 action="mark_done"。
    """

    def __init__(self, *, task_id: str, base_dir: Path = _DEFAULT_BASE_DIR):
        super().__init__()
        self.task_id = str(task_id)
        self._file_path = Path(base_dir) / self.task_id / "recon_file_tree.md"
        self._tree: List[str] = []
        self._done: Set[str] = set()
        self._directory_entries: Set[str] = set()

    @property
    def name(self) -> str:
        return "update_recon_file_tree"

    @property
    def description(self) -> str:
        return """管理侦查追踪清单（Markdown 文档），用于追踪哪些目录或文件已完成侦查、哪些尚未侦查。

**三种操作（action 参数）**：

1. **build** - 建立文件树清单（在初始 list_files 之后调用）
   - 传入 files=[...] 列表，包含所有待侦查的代码文件路径
   - 工具会自动压缩为更适合 Recon 的清单：
     - 同目录下只有一个文件时，保留文件
     - 同目录下有多个文件时，保留目录
   - 示例：{"action": "build", "files": ["src/auth/login.py", "src/api/routes.py", ...]}

2. **mark_done** - 标记文件为已侦查（确认完成对某文件的侦查后调用）
   - 传入 file_path="..." 指定文件路径
   - 示例：{"action": "mark_done", "file_path": "src/auth/login.py"}

3. **status** - 查看当前侦查进度（不修改状态）
   - 示例：{"action": "status"}

返回当前侦查 Markdown 清单，展示已侦查和待侦查的目录/文件列表。"""

    @property
    def args_schema(self):
        return UpdateReconFileTreeInput

    def _save_markdown(self, content: str) -> None:
        """将 Markdown 内容写入持久化文件。"""
        try:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            self._file_path.write_text(content, encoding="utf-8")
        except Exception as exc:
            logger.warning("[ReconFileTree] 写入文件失败 (%s): %s", self._file_path, exc)

    async def _execute(self, **kwargs) -> ToolResult:
        action = str(kwargs.get("action") or "").strip().lower()
        files = kwargs.get("files")
        file_path = kwargs.get("file_path")

        if action == "build":
            if not isinstance(files, list) or not files:
                return ToolResult(
                    success=False,
                    error="action=build 时必须提供非空的 files 列表",
                )
            previous_tree = set(self._tree)
            previous_done = set(self._done)
            self._tree, self._directory_entries = _compress_tree(files)
            preserved_done = {item for item in previous_done if item in previous_tree and item in self._tree}
            self._done = preserved_done

            markdown = _build_markdown(self._tree, self._done, self._directory_entries)
            self._save_markdown(markdown)

            return ToolResult(
                success=True,
                data=(
                    f"侦查清单已建立，共 {len(self._tree)} 项待侦查。\n\n"
                    + markdown
                ),
            )

        elif action == "mark_done":
            if not file_path or not str(file_path).strip():
                return ToolResult(
                    success=False,
                    error="action=mark_done 时必须提供 file_path 参数",
                )
            if not self._tree:
                return ToolResult(
                    success=False,
                    error="文件树尚未建立，请先调用 action=build",
                )

            matched = _find_best_match(str(file_path), self._tree, self._directory_entries)
            if matched:
                self._done.add(matched)
                done_count = sum(1 for f in self._tree if f in self._done)
                markdown = _build_markdown(self._tree, self._done, self._directory_entries)
                self._save_markdown(markdown)
                return ToolResult(
                    success=True,
                    data=(
                        f"已标记「{_display_entry(matched, self._directory_entries)}」为侦查完成（{done_count}/{len(self._tree)}）。\n\n"
                        + markdown
                    ),
                )
            else:
                normalized = _normalize_path(str(file_path))
                self._done.add(normalized)
                done_count = sum(1 for f in self._tree if f in self._done)
                markdown = _build_markdown(self._tree, self._done, self._directory_entries)
                self._save_markdown(markdown)
                return ToolResult(
                    success=True,
                    data=(
                        f"路径「{normalized}」不在初始清单中，已记录为已侦查（{done_count}/{len(self._tree)}）。\n\n"
                        + markdown
                    ),
                )

        elif action == "status":
            if not self._tree:
                return ToolResult(
                    success=True,
                    data="文件侦查清单尚未建立。请先使用 list_files 获取项目文件列表，然后调用 action=build 建立清单。",
                )
            markdown = _build_markdown(self._tree, self._done, self._directory_entries)
            return ToolResult(success=True, data=markdown)

        else:
            return ToolResult(
                success=False,
                error=f"未知操作 action={action!r}，支持的操作：build | mark_done | status",
            )
