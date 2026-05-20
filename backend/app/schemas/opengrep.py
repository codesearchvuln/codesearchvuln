"""
Opengrep API 数据模型 - Pydantic Schemas
用于API请求和响应序列化
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class OpengrepRuleCreateRequest(BaseModel):
    repo_owner: str
    repo_name: str
    commit_hash: str
    commit_content: str


class OpengrepRuleValidation(BaseModel):
    is_valid: bool = Field(..., description="规则是否通过验证")
    message: str | None = Field(None, description="验证失败原因或提示信息")


class OpengrepRuleAttempt(BaseModel):
    attempt: int = Field(..., description="尝试序号")
    rule: dict[str, Any] | None = Field(None, description="本次尝试生成的规则")
    validation: OpengrepRuleValidation


class OpengrepRulePatchRequest(BaseModel):
    repo_owner: str
    repo_name: str
    commit_hash: str
    commit_content: str


class OpengrepRulePatchResponse(BaseModel):
    rule: dict[str, Any] | None
    validation: OpengrepRuleValidation
    attempts: list[OpengrepRuleAttempt]
    meta: dict[str, Any] | None = None


class OpengrepRuleTextCreateRequest(BaseModel):
    rule_yaml: str


class OpengrepRuleTextResponse(BaseModel):
    rule: dict[str, Any] | None = None
    validation: OpengrepRuleValidation
    test_yaml: str | None = None
    rule_id: str | None = None


class OpengrepRuleUpdateRequest(BaseModel):
    name: str | None = Field(None, description="规则名称")
    pattern_yaml: str | None = Field(None, description="规则YAML文本")
    language: str | None = Field(None, description="编程语言")
    severity: str | None = Field(None, description="严重程度: ERROR, WARNING, INFO")
    is_active: bool | None = Field(None, description="是否启用")


class OpengrepRuleResponse(BaseModel):
    id: str
    name: str
    pattern_yaml: str
    language: str
    severity: str
    source: str
    is_active: bool
    created_at: datetime
