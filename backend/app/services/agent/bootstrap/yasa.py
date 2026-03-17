"""YASA hybrid bootstrap scanner."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.yasa_runtime import build_yasa_scan_command
from app.services.yasa_language import resolve_yasa_language_profile

from .base import StaticBootstrapFinding, StaticBootstrapScanResult, StaticBootstrapScanner


def _resolve_yasa_binary() -> str:
    configured = str(getattr(settings, "YASA_BIN_PATH", "yasa") or "yasa").strip()
    if os.path.isabs(configured):
        if os.path.exists(configured) and os.access(configured, os.X_OK):
            return configured
        raise FileNotFoundError(f"yasa executable not found: {configured}")

    resolved = shutil.which(configured)
    if resolved:
        return resolved
    raise FileNotFoundError(
        f"无法找到 yasa 可执行文件，请确认 YASA_BIN_PATH 配置（当前: {configured}）"
    )


def _resolve_resource_dir() -> Optional[Path]:
    configured = str(getattr(settings, "YASA_RESOURCE_DIR", "") or "").strip()
    if configured:
        resource_dir = Path(configured).expanduser()
        if resource_dir.exists():
            return resource_dir

    candidates = [
        Path.home() / ".local" / "share" / "yasa-engine" / "resource",
        Path("/usr/local/share/yasa-engine/resource"),
        Path("/usr/share/yasa-engine/resource"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _parse_sarif(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    runs = payload.get("runs")
    if not isinstance(runs, list):
        return []

    findings: List[Dict[str, Any]] = []
    for run in runs:
        if not isinstance(run, dict):
            continue
        results = run.get("results")
        if not isinstance(results, list):
            continue
        for item in results:
            if not isinstance(item, dict):
                continue
            message_payload = item.get("message")
            if isinstance(message_payload, dict):
                message = str(message_payload.get("text") or "").strip()
            else:
                message = ""

            first_location = None
            locations = item.get("locations")
            if isinstance(locations, list) and locations:
                first_location = locations[0] if isinstance(locations[0], dict) else None
            physical_location = (
                first_location.get("physicalLocation")
                if isinstance(first_location, dict)
                else None
            )
            artifact = (
                physical_location.get("artifactLocation")
                if isinstance(physical_location, dict)
                else None
            )
            region = (
                physical_location.get("region")
                if isinstance(physical_location, dict)
                else None
            )
            file_path = str((artifact or {}).get("uri") or "").strip() or "unknown"
            start_line = region.get("startLine") if isinstance(region, dict) else None
            end_line = region.get("endLine") if isinstance(region, dict) else None
            if not isinstance(start_line, int):
                start_line = None
            if not isinstance(end_line, int):
                end_line = None

            rule_id = str(item.get("ruleId") or "").strip() or "yasa_rule"
            level = str(item.get("level") or "warning").strip().upper() or "WARNING"

            findings.append(
                {
                    "rule_id": rule_id,
                    "message": message or rule_id,
                    "file_path": file_path,
                    "start_line": start_line,
                    "end_line": end_line,
                    "level": level,
                }
            )
    return findings


class YasaBootstrapScanner(StaticBootstrapScanner):
    scanner_name = "yasa"
    source = "yasa_bootstrap"

    def __init__(self, *, language: str = "python", timeout_seconds: Optional[int] = None):
        normalized = str(language or "").strip().lower() or "python"
        self.profile = resolve_yasa_language_profile(normalized)
        configured_timeout = int(getattr(settings, "YASA_TIMEOUT_SECONDS", 600) or 600)
        self.timeout_seconds = max(1, int(timeout_seconds or configured_timeout))

    def _build_rule_config(self) -> Optional[str]:
        resource_dir = _resolve_resource_dir()
        if resource_dir is None:
            return None
        candidate = resource_dir / "example-rule-config" / self.profile["rule_config"]
        if candidate.exists():
            return str(candidate)
        return None

    def _normalize_findings(self, findings: List[Dict[str, Any]]) -> List[StaticBootstrapFinding]:
        normalized: List[StaticBootstrapFinding] = []
        for idx, item in enumerate(findings):
            level = str(item.get("level") or "WARNING").upper()
            severity = "ERROR" if level in {"ERROR", "CRITICAL"} else "WARNING"
            normalized.append(
                StaticBootstrapFinding(
                    id=f"yasa-{idx}",
                    title=str(item.get("rule_id") or "yasa_rule"),
                    description=str(item.get("message") or "yasa finding"),
                    file_path=str(item.get("file_path") or "unknown"),
                    line_start=item.get("start_line") if isinstance(item.get("start_line"), int) else None,
                    line_end=item.get("end_line") if isinstance(item.get("end_line"), int) else None,
                    code_snippet=None,
                    severity=severity,
                    confidence="MEDIUM",
                    vulnerability_type=str(item.get("rule_id") or "yasa_rule"),
                    source=self.source,
                    extra={"yasa_level": level},
                )
            )
        return normalized

    async def scan(self, project_root: str) -> StaticBootstrapScanResult:
        if not bool(getattr(settings, "YASA_ENABLED", True)):
            return StaticBootstrapScanResult(
                scanner_name=self.scanner_name,
                source=self.source,
                total_findings=0,
                findings=[],
                metadata={"enabled": False},
            )

        binary = _resolve_yasa_binary()
        rule_config_file = self._build_rule_config()
        report_dir = tempfile.mkdtemp(prefix="yasa_bootstrap_")
        cmd = build_yasa_scan_command(
            binary=binary,
            source_path=project_root,
            language=self.profile["language"],
            report_dir=report_dir,
            checker_pack_ids=[self.profile["checker_pack"]],
            rule_config_file=rule_config_file,
        )

        try:
            process_result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
            )
            sarif_path = Path(report_dir) / "report.sarif"
            findings: List[Dict[str, Any]] = []
            if sarif_path.exists():
                try:
                    payload = json.loads(sarif_path.read_text(encoding="utf-8", errors="ignore"))
                    findings = _parse_sarif(payload)
                except Exception as exc:  # noqa: BLE001
                    raise RuntimeError(f"yasa output parse failed: {exc}") from exc

            if process_result.returncode != 0 and not findings:
                stderr_text = str(process_result.stderr or "").strip()
                stdout_text = str(process_result.stdout or "").strip()
                raise RuntimeError(f"yasa failed: {(stderr_text or stdout_text or 'unknown error')[:300]}")

            normalized = self._normalize_findings(findings)
            return StaticBootstrapScanResult(
                scanner_name=self.scanner_name,
                source=self.source,
                total_findings=len(findings),
                findings=normalized,
                metadata={
                    "language": self.profile["language"],
                    "checker_pack": self.profile["checker_pack"],
                },
            )
        finally:
            shutil.rmtree(report_dir, ignore_errors=True)
