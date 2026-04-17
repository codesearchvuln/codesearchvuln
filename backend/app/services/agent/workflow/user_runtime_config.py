import json
from pathlib import Path
from typing import Any, Dict, Literal

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user_config import UserConfig

USER_AGENT_WORKFLOW_CONFIG_KEY = "agent_workflow_config"
AgentWorkflowConfigSource = Literal["user_override", "local_file", "settings_default"]

_AGENT_COUNT_LIMITS: Dict[str, tuple[int, int]] = {
    "recon_count": (1, 32),
    "analysis_count": (1, 32),
    "verification_count": (1, 32),
}
_AGENT_COUNT_CONFIG_PATH = Path(__file__).with_name("config.yml")


def _build_settings_default_config() -> Dict[str, int]:
    return {
        "recon_count": int(getattr(settings, "RECON_MAX_WORKERS", 3) or 3),
        "analysis_count": int(getattr(settings, "ANALYSIS_MAX_WORKERS", 5) or 5),
        "verification_count": int(getattr(settings, "VERIFICATION_MAX_WORKERS", 3) or 3),
    }


def _load_local_file_default_config() -> tuple[Dict[str, int], AgentWorkflowConfigSource]:
    defaults = _build_settings_default_config()
    config_path = _AGENT_COUNT_CONFIG_PATH
    if not config_path.exists():
        return defaults, "settings_default"

    try:
        payload = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return defaults, "settings_default"

    if not isinstance(payload, dict):
        return defaults, "settings_default"

    agents_config = payload.get("agents")
    if not isinstance(agents_config, dict):
        return defaults, "settings_default"

    resolved = dict(defaults)
    for agent_name, field_name in (
        ("recon", "recon_count"),
        ("analysis", "analysis_count"),
        ("verification", "verification_count"),
    ):
        agent_payload = agents_config.get(agent_name)
        if not isinstance(agent_payload, dict):
            continue
        raw_count = agent_payload.get("count")
        if raw_count is None:
            continue
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            continue
        min_value, max_value = _AGENT_COUNT_LIMITS[field_name]
        if min_value <= count <= max_value:
            resolved[field_name] = count

    return resolved, "local_file"


def _normalize_agent_workflow_config(
    raw_config: Dict[str, Any],
    *,
    defaults: Dict[str, int] | None = None,
) -> Dict[str, int]:
    normalized_defaults = dict(defaults or _build_settings_default_config())
    normalized: Dict[str, int] = {}
    for field_name, (min_value, max_value) in _AGENT_COUNT_LIMITS.items():
        fallback = normalized_defaults[field_name]
        raw_value = raw_config.get(field_name, fallback)
        try:
            count = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} must be an integer") from exc
        if count < min_value or count > max_value:
            raise ValueError(
                f"{field_name} out of range, expected [{min_value}, {max_value}]"
            )
        normalized[field_name] = count
    return normalized


def _parse_saved_agent_workflow_config(raw_other_config: Any) -> Dict[str, Any] | None:
    payload = dict(raw_other_config) if isinstance(raw_other_config, dict) else None
    if payload is None:
        return None
    raw_runtime = payload.get(USER_AGENT_WORKFLOW_CONFIG_KEY)
    if not isinstance(raw_runtime, dict):
        return None
    return raw_runtime


def describe_effective_agent_workflow_config(raw_other_config: Any) -> Dict[str, Any]:
    default_config, default_source = _load_local_file_default_config()
    saved_runtime = _parse_saved_agent_workflow_config(raw_other_config)

    if saved_runtime is None:
        return {
            **default_config,
            "default_recon_count": default_config["recon_count"],
            "default_analysis_count": default_config["analysis_count"],
            "default_verification_count": default_config["verification_count"],
            "default_source": default_source,
            "source": default_source,
            "has_user_override": False,
        }

    try:
        effective_config = _normalize_agent_workflow_config(
            saved_runtime,
            defaults=default_config,
        )
    except ValueError:
        return {
            **default_config,
            "default_recon_count": default_config["recon_count"],
            "default_analysis_count": default_config["analysis_count"],
            "default_verification_count": default_config["verification_count"],
            "default_source": default_source,
            "source": default_source,
            "has_user_override": False,
        }

    return {
        **effective_config,
        "default_recon_count": default_config["recon_count"],
        "default_analysis_count": default_config["analysis_count"],
        "default_verification_count": default_config["verification_count"],
        "default_source": default_source,
        "source": "user_override",
        "has_user_override": True,
    }


def resolve_effective_agent_workflow_config(raw_other_config: Any) -> Dict[str, int]:
    described = describe_effective_agent_workflow_config(raw_other_config)
    return {
        "recon_count": int(described["recon_count"]),
        "analysis_count": int(described["analysis_count"]),
        "verification_count": int(described["verification_count"]),
    }


async def load_user_agent_workflow_config(
    db: AsyncSession,
    *,
    user_id: str,
) -> Dict[str, Any]:
    result = await db.execute(select(UserConfig).where(UserConfig.user_id == user_id))
    user_config = result.scalar_one_or_none()

    raw_other_config: Dict[str, Any] = {}
    if user_config and str(user_config.other_config or "").strip():
        try:
            parsed_other = json.loads(user_config.other_config)
        except Exception:
            parsed_other = {}
        if isinstance(parsed_other, dict):
            raw_other_config = parsed_other

    return describe_effective_agent_workflow_config(raw_other_config)


async def save_user_agent_workflow_config(
    db: AsyncSession,
    *,
    user_id: str,
    runtime_config: Dict[str, Any],
) -> Dict[str, Any]:
    default_config, _default_source = _load_local_file_default_config()
    normalized = _normalize_agent_workflow_config(runtime_config, defaults=default_config)

    result = await db.execute(select(UserConfig).where(UserConfig.user_id == user_id))
    user_config = result.scalar_one_or_none()

    if user_config is None:
        payload = {
            USER_AGENT_WORKFLOW_CONFIG_KEY: normalized,
        }
        user_config = UserConfig(
            user_id=user_id,
            llm_config="{}",
            other_config=json.dumps(payload, ensure_ascii=False),
        )
        db.add(user_config)
    else:
        try:
            payload = json.loads(user_config.other_config or "{}")
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        payload[USER_AGENT_WORKFLOW_CONFIG_KEY] = normalized
        user_config.other_config = json.dumps(payload, ensure_ascii=False)

    await db.commit()
    return describe_effective_agent_workflow_config(
        {
            USER_AGENT_WORKFLOW_CONFIG_KEY: normalized,
        }
    )
