from __future__ import annotations

import os
from typing import Any, List
from urllib.parse import urlparse


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return bool(default)
    text = str(value).strip().lower()
    if not text:
        return bool(default)
    return text in {"1", "true", "yes", "on"}


def _split_hosts(raw_hosts: Any) -> List[str]:
    values = [str(item).strip().lower() for item in str(raw_hosts or "").split(",")]
    return [item for item in values if item]


def is_ssh_git_url(url: str) -> bool:
    text = str(url or "").strip()
    if not text:
        return False
    return text.startswith("git@") or text.startswith("ssh://")


def has_url_auth(url: str) -> bool:
    parsed = urlparse(str(url or "").strip())
    return bool(parsed.username or parsed.password)


def _host_in_allow_list(host: str, allow_hosts: List[str]) -> bool:
    host_lower = str(host or "").strip().lower()
    if not host_lower or not allow_hosts:
        return False
    for allow_host in allow_hosts:
        candidate = str(allow_host or "").strip().lower()
        if not candidate:
            continue
        if host_lower == candidate or host_lower.endswith(f".{candidate}"):
            return True
    return False


def should_use_mirror(
    url: str,
    *,
    enabled: bool,
    allow_auth_url: bool,
    allow_hosts: List[str],
) -> bool:
    text = str(url or "").strip()
    if not text or not enabled:
        return False
    if is_ssh_git_url(text):
        return False

    parsed = urlparse(text)
    if parsed.scheme.lower() not in {"http", "https"}:
        return False
    if not _host_in_allow_list(parsed.netloc.split("@")[-1].split(":")[0], allow_hosts):
        return False
    if (not allow_auth_url) and has_url_auth(text):
        return False
    return True


def build_mirror_url(original_url: str, mirror_prefix: str) -> str:
    raw_url = str(original_url or "").strip()
    raw_prefix = str(mirror_prefix or "").strip()
    if not raw_url or not raw_prefix:
        return raw_url
    if "{url}" in raw_prefix:
        return raw_prefix.replace("{url}", raw_url)
    return f"{raw_prefix.rstrip('/')}/{raw_url}"


def get_mirror_candidates(
    original_url: str,
    *,
    enabled: Any = None,
    mirror_prefix: Any = None,
    allow_hosts: Any = None,
    allow_auth_url: Any = None,
) -> List[str]:
    raw_url = str(original_url or "").strip()
    if not raw_url:
        return []

    enabled_value = _as_bool(
        enabled if enabled is not None else os.getenv("GIT_MIRROR_ENABLED", "true"),
        default=True,
    )
    prefix_value = str(
        mirror_prefix
        if mirror_prefix is not None
        else os.getenv("GIT_MIRROR_PREFIX", "https://ghfast.top")
    ).strip()
    hosts_value = _split_hosts(
        allow_hosts if allow_hosts is not None else os.getenv("GIT_MIRROR_HOSTS", "github.com")
    )
    allow_auth_value = _as_bool(
        allow_auth_url
        if allow_auth_url is not None
        else os.getenv("GIT_MIRROR_ALLOW_AUTH_URL", "false")
    )

    if not should_use_mirror(
        raw_url,
        enabled=enabled_value,
        allow_auth_url=allow_auth_value,
        allow_hosts=hosts_value,
    ):
        return [raw_url]

    mirror_url = build_mirror_url(raw_url, prefix_value)
    if not mirror_url or mirror_url == raw_url:
        return [raw_url]
    return [mirror_url, raw_url]
