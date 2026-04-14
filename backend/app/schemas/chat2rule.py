from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


Chat2RuleEngineType = Literal["opengrep", "gitleaks", "bandit", "phpstan", "pmd", "yasa"]


class Chat2RuleSelectionInput(BaseModel):
    file_path: str = Field(..., description="相对项目根目录的文件路径")
    start_line: int = Field(..., ge=1, description="起始行号，从 1 开始")
    end_line: int = Field(..., ge=1, description="结束行号，从 1 开始")


class Chat2RuleMessageInput(BaseModel):
    role: Literal["user", "assistant"] = Field(..., description="对话角色")
    content: str = Field(..., min_length=1, description="消息内容")


class Chat2RuleValidationResult(BaseModel):
    valid: bool = Field(..., description="规则是否通过基础校验")
    errors: list[str] = Field(default_factory=list, description="校验错误列表")
    normalized_rule_text: Optional[str] = Field(
        None,
        description="服务端清洗后的规则文本",
    )
    metadata: Optional[dict[str, Any]] = Field(
        None,
        description="从规则中解析出的元信息",
    )


class Chat2RuleOpengrepChatRequest(BaseModel):
    messages: list[Chat2RuleMessageInput] = Field(..., min_length=1)
    selections: list[Chat2RuleSelectionInput] = Field(..., min_length=1)
    draft_rule_text: Optional[str] = Field(
        None,
        description="当前草案规则文本，用于多轮修订",
    )


class Chat2RuleOpengrepChatResponse(BaseModel):
    assistant_message: str
    rule_title: str
    rule_text: str
    explanation: str
    validation_result: Chat2RuleValidationResult
    usage: dict[str, int] = Field(default_factory=dict)


class Chat2RuleOpengrepSaveRequest(BaseModel):
    rule_text: str = Field(..., min_length=1)
    title: Optional[str] = Field(None, description="保存时使用的规则名称")
    description: Optional[str] = Field(None, description="规则描述")


class Chat2RuleOpengrepSaveResponse(BaseModel):
    rule_id: str
    name: str
    language: str
    severity: str
    message: str


class Chat2RuleChatRequest(Chat2RuleOpengrepChatRequest):
    pass


class Chat2RuleChatResponse(Chat2RuleOpengrepChatResponse):
    engine_type: Chat2RuleEngineType
    save_supported: bool


class Chat2RuleSaveRequest(Chat2RuleOpengrepSaveRequest):
    pass


class Chat2RuleSaveResponse(Chat2RuleOpengrepSaveResponse):
    engine_type: Chat2RuleEngineType
    save_supported: bool
