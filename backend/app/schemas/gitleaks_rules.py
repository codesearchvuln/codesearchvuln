from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GitleaksRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    rule_id: str = Field(..., min_length=1, max_length=255)
    secret_group: int = Field(0, ge=0)
    regex: str = Field(..., min_length=1)
    keywords: list[str] = Field(default_factory=list)
    path: str | None = None
    tags: list[str] = Field(default_factory=list)
    entropy: float | None = Field(None, ge=0)
    is_active: bool = True
    source: str = Field(default="custom", min_length=1, max_length=64)

    @field_validator("name", "rule_id", "regex", "source")
    @classmethod
    def _strip_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("字段不能为空")
        return cleaned

    @field_validator("keywords", "tags")
    @classmethod
    def _clean_string_list(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            item_text = str(item).strip()
            if item_text:
                cleaned.append(item_text)
        return cleaned


class GitleaksRuleCreateRequest(GitleaksRuleBase):
    pass


class GitleaksRuleUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    rule_id: str | None = Field(None, min_length=1, max_length=255)
    secret_group: int | None = Field(None, ge=0)
    regex: str | None = Field(None, min_length=1)
    keywords: list[str] | None = None
    path: str | None = None
    tags: list[str] | None = None
    entropy: float | None = Field(None, ge=0)
    is_active: bool | None = None
    source: str | None = Field(None, min_length=1, max_length=64)


class GitleaksRuleBatchUpdateRequest(BaseModel):
    rule_ids: list[str] | None = None
    source: str | None = None
    keyword: str | None = None
    current_is_active: bool | None = None
    is_active: bool


class GitleaksRuleResponse(GitleaksRuleBase):
    id: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
