from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.config import LLMTestRequest, test_llm_connection as llm_connection_endpoint
from app.api.v1.endpoints.config import get_default_config
from app.services.llm.factory import LLMFactory
from app.services.llm.service import LLMConfigError, LLMService
from app.services.llm.types import LLMConfig, LLMProvider


class _DummyResult:
    def scalar_one_or_none(self):
        return None


class _DummyDB:
    async def execute(self, *_args, **_kwargs):
        return _DummyResult()


def test_llm_service_requires_base_url():
    service = LLMService(
        user_config={
            "llmConfig": {
                "llmProvider": "openai",
                "llmApiKey": "sk-test",
                "llmModel": "gpt-5",
            }
        }
    )

    with pytest.raises(LLMConfigError, match="llmBaseUrl"):
        _ = service.config


def test_llm_service_uses_provider_specific_key_when_generic_missing():
    service = LLMService(
        user_config={
            "llmConfig": {
                "llmProvider": "openai",
                "openaiApiKey": "sk-provider-specific",
                "llmModel": "gpt-5",
                "llmBaseUrl": "https://api.openai.com/v1",
            }
        }
    )

    config = service.config
    assert config.api_key == "sk-provider-specific"
    assert config.model == "gpt-5"
    assert config.base_url == "https://api.openai.com/v1"


def test_llm_service_allows_ollama_without_api_key():
    service = LLMService(
        user_config={
            "llmConfig": {
                "llmProvider": "ollama",
                "llmModel": "llama3.3",
                "llmBaseUrl": "http://localhost:11434/v1",
            }
        }
    )

    config = service.config
    assert config.provider == LLMProvider.OLLAMA
    assert config.api_key == "ollama"


def test_llm_factory_create_adapter_does_not_reuse_cache(monkeypatch):
    config = LLMConfig(
        provider=LLMProvider.OPENAI,
        api_key="sk-test",
        model="gpt-5",
        base_url="https://api.openai.com/v1",
    )

    def _fake_instantiate(cls, _config):
        return object()

    monkeypatch.setattr(LLMFactory, "_instantiate_adapter", classmethod(_fake_instantiate))

    first = LLMFactory.create_adapter(config)
    second = LLMFactory.create_adapter(config)
    assert first is not second


def test_default_config_uses_updated_agent_stream_timeouts():
    config = get_default_config()

    assert config["llmConfig"]["llmFirstTokenTimeout"] == 45
    assert config["llmConfig"]["llmStreamTimeout"] == 120


@pytest.mark.asyncio
async def test_test_llm_connection_requires_model_for_ollama():
    with pytest.raises(HTTPException) as exc_info:
        await llm_connection_endpoint(
            request=LLMTestRequest(
                provider="ollama",
                apiKey="",
                model="",
                baseUrl="http://localhost:11434/v1",
            ),
            db=_DummyDB(),
            current_user=SimpleNamespace(id="test-user"),
        )

    assert exc_info.value.status_code == 400
    assert "model" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_test_llm_connection_requires_api_key_for_non_ollama():
    with pytest.raises(HTTPException) as exc_info:
        await llm_connection_endpoint(
            request=LLMTestRequest(
                provider="openai",
                apiKey="",
                model="gpt-5",
                baseUrl="https://api.openai.com/v1",
            ),
            db=_DummyDB(),
            current_user=SimpleNamespace(id="test-user"),
        )

    assert exc_info.value.status_code == 400
    assert "apiKey" in str(exc_info.value.detail)
