import pytest

from app.services.yasa_language import (
    normalize_yasa_language,
    resolve_yasa_language_from_programming_languages,
    resolve_yasa_language_with_preference,
)


def test_resolve_yasa_language_from_programming_languages_supports_json_and_csv():
    assert resolve_yasa_language_from_programming_languages('["php","javascript"]') == "javascript"
    assert resolve_yasa_language_from_programming_languages("php,javascript") == "javascript"


def test_resolve_yasa_language_with_preference_prioritizes_manual_value():
    assert (
        resolve_yasa_language_with_preference(
            preferred_language="typescript",
            programming_languages='["java"]',
        )
        == "typescript"
    )


def test_normalize_yasa_language_rejects_invalid_value():
    with pytest.raises(ValueError, match="不支持语言: php"):
        normalize_yasa_language("php", allow_auto=True)
