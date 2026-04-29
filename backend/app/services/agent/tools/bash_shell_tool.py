"""
Bash Shell 工具
在宿主环境执行 Bash 命令，默认工作目录为项目根目录。
"""

from __future__ import annotations

import asyncio
import os
import subprocess
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .base import AgentTool, ToolResult
from .evidence_protocol import (
    build_display_command,
    build_execution_status,
    build_inline_code_lines,
    unique_command_chain,
    validate_evidence_metadata,
)


class BashShellInput(BaseModel):
    command: str = Field(description="要执行的 Bash 命令")
    timeout: int = Field(default=60, description="超时时间（秒），范围 1-300")
    cwd: Optional[str] = Field(
        default=None,
        description="可选工作目录。绝对路径直接使用；相对路径基于项目根目录解析。",
    )
    max_output_chars: int = Field(default=12000, description="stdout/stderr 每项最大返回字符数，范围 1000-50000")


class BashShellTool(AgentTool):
    def __init__(self, project_root: str):
        super().__init__()
        self.project_root = os.path.normpath(str(project_root or "."))

    @property
    def name(self) -> str:
        return "bash_shell"

    @property
    def description(self) -> str:
        return """执行 Bash Shell 命令（宿主环境）。

输入：
- command: Bash 命令
- timeout: 可选，超时秒数（默认 60）
- cwd: 可选，执行目录（默认项目根目录）
- max_output_chars: 可选，stdout/stderr 截断上限
"""

    @property
    def args_schema(self):
        return BashShellInput

    @staticmethod
    def _trim_text(value: Any, limit: int) -> str:
        text = str(value or "")
        if len(text) <= limit:
            return text
        return text[:limit] + f"\n... (截断，共 {len(text)} 字符)"

    def _resolve_cwd(self, cwd: Optional[str]) -> str:
        raw = str(cwd or "").strip()
        if not raw:
            resolved = self.project_root
        elif os.path.isabs(raw):
            resolved = os.path.normpath(raw)
        else:
            resolved = os.path.normpath(os.path.join(self.project_root, raw))
        if not os.path.isdir(resolved):
            raise NotADirectoryError(f"工作目录不存在或不是目录: {resolved}")
        return resolved

    @staticmethod
    def _run_command_sync(command: str, cwd: str, timeout: int) -> subprocess.CompletedProcess[str]:
        env = dict(os.environ)
        env.setdefault("PAGER", "cat")
        env.setdefault("GIT_PAGER", "cat")
        return subprocess.run(
            ["bash", "-lc", command],
            cwd=cwd,
            env=env,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    async def _execute(
        self,
        command: str,
        timeout: int = 60,
        cwd: Optional[str] = None,
        max_output_chars: int = 12000,
        **kwargs,
    ) -> ToolResult:
        command_text = str(command or "").strip()
        if not command_text:
            return ToolResult(success=False, error="命令不能为空")

        safe_timeout = max(1, min(int(timeout or 60), 300))
        safe_output_limit = max(1000, min(int(max_output_chars or 12000), 50000))

        try:
            resolved_cwd = self._resolve_cwd(cwd)
        except NotADirectoryError as exc:
            return ToolResult(success=False, error=str(exc))

        try:
            completed = await asyncio.to_thread(
                self._run_command_sync,
                command_text,
                resolved_cwd,
                safe_timeout,
            )
            stdout_text = self._trim_text(completed.stdout, safe_output_limit)
            stderr_text = self._trim_text(completed.stderr, safe_output_limit)
            success = completed.returncode == 0
            error_text = None if success else (stderr_text or f"命令执行失败，退出码: {completed.returncode}")
            exit_code = int(completed.returncode)
        except subprocess.TimeoutExpired as exc:
            stdout_text = self._trim_text(exc.stdout, safe_output_limit)
            stderr_text = self._trim_text(exc.stderr, safe_output_limit)
            success = False
            exit_code = -1
            error_text = f"命令执行超时（>{safe_timeout}s）"
        except Exception as exc:
            stdout_text = ""
            stderr_text = ""
            success = False
            exit_code = -1
            error_text = f"Bash 执行异常: {exc}"

        output_parts = [
            "🐚 Bash Shell 执行结果",
            f"命令: {command_text}",
            f"工作目录: {resolved_cwd}",
            f"退出码: {exit_code}",
        ]
        if stdout_text:
            output_parts.append(f"\n标准输出:\n```\n{stdout_text}\n```")
        if stderr_text:
            output_parts.append(f"\n标准错误:\n```\n{stderr_text}\n```")
        if error_text:
            output_parts.append(f"\n错误: {error_text}")

        command_chain = unique_command_chain(["bash_shell", "bash"])
        display_command = build_display_command(command_chain)
        entry: Dict[str, Any] = {
            "exit_code": exit_code,
            "status": build_execution_status(
                success=success,
                error=error_text,
                exit_code=exit_code,
            ),
            "title": "Bash Shell 命令执行",
            "execution_command": command_text,
            "stdout_preview": self._trim_text(stdout_text, 300),
            "stderr_preview": self._trim_text(stderr_text, 300),
            "artifacts": [
                {"label": "退出码", "value": str(exit_code)},
                {"label": "工作目录", "value": resolved_cwd},
            ],
            "code": build_inline_code_lines(command_text, language="bash"),
        }
        validate_evidence_metadata(
            render_type="execution_result",
            command_chain=command_chain,
            display_command=display_command,
            entries=[entry],
        )

        return ToolResult(
            success=success,
            data="\n".join(output_parts),
            error=error_text,
            metadata={
                "render_type": "execution_result",
                "command_chain": command_chain,
                "display_command": display_command,
                "entries": [entry],
                "command": command_text,
                "cwd": resolved_cwd,
                "exit_code": exit_code,
            },
        )
