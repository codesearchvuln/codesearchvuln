from app.core.config import Settings


def test_settings_default_image_contract_uses_codesearchvuln_namespace(monkeypatch) -> None:
    for env_name in (
        "GHCR_REGISTRY",
        "VULHUNTER_IMAGE_NAMESPACE",
        "VULHUNTER_IMAGE_TAG",
        "SCANNER_YASA_IMAGE",
        "SCANNER_OPENGREP_IMAGE",
        "SCANNER_BANDIT_IMAGE",
        "SCANNER_GITLEAKS_IMAGE",
        "SCANNER_PHPSTAN_IMAGE",
        "SCANNER_PMD_IMAGE",
        "FLOW_PARSER_RUNNER_IMAGE",
        "SANDBOX_RUNNER_IMAGE",
    ):
        monkeypatch.delenv(env_name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.GHCR_REGISTRY == "ghcr.io"
    assert settings.VULHUNTER_IMAGE_NAMESPACE == "codesearchvuln"
    assert settings.SCANNER_YASA_IMAGE == "ghcr.io/codesearchvuln/vulhunter-yasa-runner:latest"
    assert settings.SCANNER_OPENGREP_IMAGE == "ghcr.io/codesearchvuln/vulhunter-opengrep-runner:latest"
    assert settings.SCANNER_BANDIT_IMAGE == "ghcr.io/codesearchvuln/vulhunter-bandit-runner:latest"
    assert settings.SCANNER_GITLEAKS_IMAGE == "ghcr.io/codesearchvuln/vulhunter-gitleaks-runner:latest"
    assert settings.SCANNER_PHPSTAN_IMAGE == "ghcr.io/codesearchvuln/vulhunter-phpstan-runner:latest"
    assert settings.SCANNER_PMD_IMAGE == "ghcr.io/codesearchvuln/vulhunter-pmd-runner:latest"
    assert settings.FLOW_PARSER_RUNNER_IMAGE == "ghcr.io/codesearchvuln/vulhunter-flow-parser-runner:latest"
    assert settings.SANDBOX_RUNNER_IMAGE == "ghcr.io/codesearchvuln/vulhunter-sandbox-runner:latest"
