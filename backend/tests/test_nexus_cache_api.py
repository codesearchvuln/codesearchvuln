from __future__ import annotations

import json
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api import deps
from app.api.v1.endpoints import nexus
from app.core.config import settings


@pytest_asyncio.fixture
async def nexus_client(monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(nexus.router, prefix="/api/v1/nexus")

    async def override_current_user():
        return SimpleNamespace(id="nexus-test-user")

    app.dependency_overrides[deps.get_current_user] = override_current_user
    monkeypatch.setattr(
        settings,
        "NEXUS_CACHE_STORAGE_PATH",
        str(tmp_path / "nexus-cache"),
    )

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_nexus_cache_crud_lifecycle(nexus_client: httpx.AsyncClient):
    cache_key = "repo-main.json"
    created = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={
            "cache_key": cache_key,
            "payload_json": '{"graph":{"nodes":1}}',
            "meta": {"source": "gitnexus"},
        },
    )
    assert created.status_code == 201, created.text
    created_payload = created.json()
    assert created_payload["cache_key"] == cache_key
    assert created_payload["payload_json"] == '{"graph":{"nodes":1}}'
    assert created_payload["meta"] == {"source": "gitnexus"}

    listed = await nexus_client.get("/api/v1/nexus/cache")
    assert listed.status_code == 200, listed.text
    list_payload = listed.json()
    assert list_payload["total"] == 1
    assert list_payload["items"][0]["cache_key"] == cache_key

    fetched = await nexus_client.get(f"/api/v1/nexus/cache/{cache_key}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["payload_json"] == '{"graph":{"nodes":1}}'

    updated = await nexus_client.put(
        f"/api/v1/nexus/cache/{cache_key}",
        json={
            "payload_json": '{"graph":{"nodes":2}}',
            "meta": {"source": "gitnexus", "version": 2},
        },
    )
    assert updated.status_code == 200, updated.text
    updated_payload = updated.json()
    assert updated_payload["payload_json"] == '{"graph":{"nodes":2}}'
    assert updated_payload["meta"] == {"source": "gitnexus", "version": 2}

    deleted = await nexus_client.delete(f"/api/v1/nexus/cache/{cache_key}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["cache_key"] == cache_key

    missing = await nexus_client.get(f"/api/v1/nexus/cache/{cache_key}")
    assert missing.status_code == 404, missing.text


@pytest.mark.asyncio
async def test_nexus_cache_duplicate_and_prefix_list(nexus_client: httpx.AsyncClient):
    first = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "repo-a.json", "payload_json": '{"a":1}'},
    )
    assert first.status_code == 201, first.text

    duplicate = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "repo-a.json", "payload_json": '{"a":2}'},
    )
    assert duplicate.status_code == 409, duplicate.text

    second = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "repo-b.json", "payload_json": '{"b":1}'},
    )
    assert second.status_code == 201, second.text

    prefixed = await nexus_client.get(
        "/api/v1/nexus/cache",
        params={"prefix": "repo-a", "skip": 0, "limit": 20},
    )
    assert prefixed.status_code == 200, prefixed.text
    prefixed_payload = prefixed.json()
    assert prefixed_payload["total"] == 1
    assert prefixed_payload["items"][0]["cache_key"] == "repo-a.json"

    not_found = await nexus_client.put(
        "/api/v1/nexus/cache/missing.json",
        json={"payload_json": '{"x":1}'},
    )
    assert not_found.status_code == 404, not_found.text


@pytest.mark.asyncio
async def test_nexus_cache_validation_errors(nexus_client: httpx.AsyncClient):
    invalid_json_payload = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "bad.json", "payload_json": "{invalid-json"},
    )
    assert invalid_json_payload.status_code == 422, invalid_json_payload.text

    empty_key = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "", "payload_json": '{"ok":true}'},
    )
    assert empty_key.status_code == 422, empty_key.text

    oversized_payload_json = json.dumps({"blob": "x" * (nexus.MAX_PAYLOAD_SIZE_BYTES + 1)})
    oversized_payload = await nexus_client.post(
        "/api/v1/nexus/cache",
        json={"cache_key": "large.json", "payload_json": oversized_payload_json},
    )
    assert oversized_payload.status_code == 413, oversized_payload.text
