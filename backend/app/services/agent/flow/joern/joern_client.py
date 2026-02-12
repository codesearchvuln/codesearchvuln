from __future__ import annotations

import asyncio
import json
import logging
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.agent.flow.models import FlowEvidence

logger = logging.getLogger(__name__)


class JoernClient:
    """Best-effort Joern client for deep reachability verification.

    If Joern is unavailable, callers receive a structured blocked reason and can
    safely fall back to lightweight evidence.
    """

    def __init__(self, *, enabled: bool = True, timeout_sec: int = 45):
        self.enabled = bool(enabled)
        self.timeout_sec = max(10, int(timeout_sec))
        self._joern_bin = shutil.which("joern")
        self._version_checked = False
        self._version_ok = False

    def _base_blocked(self, reason: str) -> FlowEvidence:
        return FlowEvidence(
            path_found=False,
            path_score=0.0,
            call_chain=[],
            control_conditions=[],
            taint_paths=[],
            entry_inferred=False,
            blocked_reasons=[reason],
            engine="joern",
        )

    async def _check_version(self) -> bool:
        if self._version_checked:
            return self._version_ok

        self._version_checked = True
        if not self._joern_bin:
            self._version_ok = False
            return False

        try:
            proc = await asyncio.create_subprocess_exec(
                self._joern_bin,
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=8)
            _ = (stdout or b"").decode("utf-8", errors="ignore")
            err_text = (stderr or b"").decode("utf-8", errors="ignore")
            self._version_ok = proc.returncode == 0
            if not self._version_ok:
                logger.warning("Joern version check failed: %s", err_text[:200])
            return self._version_ok
        except Exception as exc:
            logger.warning("Joern version check exception: %s", exc)
            self._version_ok = False
            return False

    def _query_script_path(self) -> Path:
        return Path(__file__).resolve().parent / "queries" / "reachability.sc"

    async def _run_query(
        self,
        *,
        project_root: str,
        file_path: str,
        line_start: int,
    ) -> Optional[Dict[str, Any]]:
        if not self._joern_bin:
            return None

        script_path = self._query_script_path()
        if not script_path.exists():
            return None

        params = f"project={project_root},file={file_path},line={line_start}"

        cmd = [
            self._joern_bin,
            "--script",
            str(script_path),
            "--params",
            params,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.timeout_sec)
            stdout_text = (stdout or b"").decode("utf-8", errors="replace").strip()
            stderr_text = (stderr or b"").decode("utf-8", errors="replace").strip()

            if proc.returncode != 0:
                logger.debug("Joern query failed: %s", stderr_text[:280])
                return None

            if not stdout_text:
                return None

            try:
                return json.loads(stdout_text)
            except Exception:
                logger.debug("Joern query output is not JSON, fallback heuristic used")
                return None
        except Exception as exc:
            logger.debug("Joern query exception: %s", exc)
            return None

    async def verify_reachability(
        self,
        *,
        project_root: str,
        file_path: str,
        line_start: int,
        call_chain: Optional[List[str]] = None,
        control_conditions: Optional[List[str]] = None,
    ) -> FlowEvidence:
        if not self.enabled:
            return self._base_blocked("joern_disabled")

        if not await self._check_version():
            return self._base_blocked("joern_not_available")

        payload = await self._run_query(
            project_root=project_root,
            file_path=file_path,
            line_start=max(1, int(line_start)),
        )

        if isinstance(payload, dict):
            call_chain_payload = [
                str(item) for item in (payload.get("call_chain") or []) if str(item).strip()
            ]
            control_payload = [
                str(item)
                for item in (payload.get("control_conditions") or [])
                if str(item).strip()
            ]
            blocked = [str(item) for item in (payload.get("blocked_reasons") or []) if str(item)]
            taint_paths = [str(item) for item in (payload.get("taint_paths") or []) if str(item)]

            return FlowEvidence(
                path_found=bool(payload.get("path_found")),
                path_score=float(payload.get("path_score") or 0.0),
                call_chain=call_chain_payload,
                control_conditions=control_payload,
                taint_paths=taint_paths,
                entry_inferred=bool(payload.get("entry_inferred")),
                blocked_reasons=blocked,
                engine="joern",
                extra={"source": "joern_script"},
            )

        # Fallback heuristic when Joern runtime is available but script query cannot be parsed.
        fallback_chain = [str(item) for item in (call_chain or []) if str(item).strip()]
        fallback_conditions = [str(item) for item in (control_conditions or []) if str(item).strip()]
        has_path = len(fallback_chain) >= 2
        score = 0.78 if has_path else 0.58

        return FlowEvidence(
            path_found=has_path,
            path_score=score,
            call_chain=fallback_chain,
            control_conditions=fallback_conditions,
            taint_paths=[f"{fallback_chain[i]} -> {fallback_chain[i + 1]}" for i in range(len(fallback_chain) - 1)],
            entry_inferred=False,
            blocked_reasons=["joern_query_unavailable"],
            engine="joern",
            extra={"source": "joern_heuristic_fallback"},
        )


__all__ = ["JoernClient"]
