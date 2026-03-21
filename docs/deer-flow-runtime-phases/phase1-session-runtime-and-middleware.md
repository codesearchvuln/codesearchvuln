# Phase 1：Session Runtime And Middleware

## 阅读定位

- **文档类型**：How-to oriented implementation spec。
- **目标读者**：准备落地 session runtime、history compaction 和 runtime middleware 的实现者。
- **阅读目标**：明确 Phase 1 只解决 host session 真相源，不提前混入 skill loading、worker isolation 和 checkpoint 完整实现。
- **建议前置**：先读 [phase0-runtime-contracts-and-guardrails.md](./phase0-runtime-contracts-and-guardrails.md)，再进入本文。
- **术语入口**：`host session`、`loaded_skill_ids` 等词可先在 [../glossary.md](../glossary.md) 中统一。

## 目标与边界

### 目标

把当前分散在 `BaseAgent`、agent 子类、prompt 组装和部分 memory/MCP 路径中的会话级 runtime 行为，统一收敛成 `AgentRuntimeSession`。本阶段只解决“host session 如何成为单一真相源”，不处理 skill progressive loading、isolated worker、thread checkpoint 的完整实现。

### 范围

- 会话历史管理与压缩。
- 证据锚点保留策略。
- 确定性失败短路。
- 取消/中断传播。
- LLM/tool 回合计数。
- runtime policy 解析与 profile 绑定。
- 与 `ToolExecutionCoordinator` 的职责边界冻结。
- `AgentState` / `_conversation_history` / `_state.messages` 的迁移与兼容桥接。

### 非目标

- 不在本阶段引入 skills 正文延迟加载。
- 不在本阶段重写 `SubAgentExecutor`。
- 不在本阶段引入 thread checkpoint 存储。
- 不改变现有 tool contract 和 `ToolResult` 结构。

### 哪些模块语义不动

- `backend/app/services/agent/tools/runtime/coordinator.py` 的 hook 契约和错误分类权责
- finding 归一化与 queue 写入逻辑
- `WorkflowEngine` 的 phase 推进逻辑
- 各 agent 的系统提示词、领域解析与最终输出语义

## 当前代码锚点

- `backend/app/services/agent/agents/base.py`
  - 当前同时持有 `stream_llm_call()`、历史压缩、计数器、取消状态、重复失败统计、事件发射等多种职责。
- `backend/app/services/agent/core/state.py`
  - 当前 `AgentState.messages` 是另一套会话历史承载体，需要与 runtime session 做桥接或退役。
- `backend/app/services/agent/agents/recon.py`
  - 当前存在 `_should_compress_history()`、`_compress_history()`、`_files_read`、`_risk_points_pushed` 这类侦察特有摘要逻辑。
- `backend/app/services/agent/agents/analysis.py`
- `backend/app/services/agent/agents/verification.py`
- `backend/app/services/agent/agents/report.py`
- `backend/app/services/agent/agents/business_logic_recon.py`
- `backend/app/services/agent/agents/business_logic_analysis.py`
  - 上述 agent 都依赖 `_conversation_history` 或 `stream_llm_call()`，但还没有统一的 session 真相源。
- `backend/app/services/agent/workflow/workflow_orchestrator.py`
  - orchestrator 初始 prompt 与 workflow runtime context 仍需要在 Phase 1 通过 session 注入。

## 现状与缺口

### 当前现状

- `BaseAgent.stream_llm_call()` 会在调用前自动压缩消息。
- 部分 agent 子类仍维护自己的历史压缩与摘要逻辑，例如 `ReconAgent` 的 `_should_compress_history()` / `_compress_history()`。
- `BaseAgent` 当前同时持有：
  - LLM 流式调用
  - conversation history 管理
  - 错误短路
  - 统计计数
  - 取消状态
  - 事件发射
- `AgentState` 仍保留 `messages`、`iteration`、`tool_calls`、`total_tokens` 等另一套状态。
- `ToolExecutionCoordinator` 已统一工具输入输出契约、反射信息和稳定错误码，但 session 层还没有把这些结构化失败沉淀成统一状态。

### 核心缺口

- 同一 agent 会同时有 `AgentState`、`_conversation_history`、局部计数器三套近似真相源。
- 历史压缩策略散落在 `BaseAgent` 与具体 agent 子类里，无法保证行为一致。
- 取消/中断、确定性失败短路和 loop counter 没有独立 session state 持久化承载。
- recon 的证据摘要能力如果直接替换成 generic compaction，会丢失 `_files_read` / `_risk_points_pushed` 带来的结构化上下文。
- session 层与 tool runtime 的权责边界不够清晰，容易重复分类工具失败。

## 目标状态

### `AgentRuntimeSession` 成为 host session 真相源

每个 host agent 在 `run()` 生命周期内都只持有一个 `AgentRuntimeSession`。后续所有消息准备、历史压缩、turn counter 更新、结构化失败记录，都必须通过 session 更新，而不是由 agent 本体零散维护。

本阶段覆盖的 host agent 包括：

- `WorkflowOrchestratorAgent`
- `ReconAgent`
- `BusinessLogicReconAgent`
- `AnalysisAgent`
- `BusinessLogicAnalysisAgent`
- `VerificationAgent`
- `ReportAgent`

### 职责分界

- `BaseAgent` 保留：
  - LLM transport 调用
  - event emitter / telemetry 对外输出
  - agent-specific system prompt
  - agent-specific 结果解析与领域产出
- `AgentRuntimeSession` 接管：
  - history tail / summary blocks
  - 证据锚点保留
  - loop counters
  - cancel / interrupt / degraded runtime flags
  - 确定性失败短路判定
  - prompt memory 注入统一入口
  - `loaded_skill_ids` 的基础持有位
- `ToolExecutionCoordinator` 继续唯一负责：
  - tool input normalization
  - schema validation
  - output contract validation
  - stable error code classification
  - reflection metadata 生成

### 并存迁移规则

Phase 1 不是“一步删光旧字段”，而是按以下顺序迁移：

1. **先建 session，不立刻删旧字段**
   - `AgentRuntimeSession` 从 `system_prompt + initial_message + runtime context` 建立会话。
2. **建立受控镜像期**
   - `_conversation_history` 与 `_state.messages` 在迁移期可以继续存在，但只能作为 session 的派生镜像。
   - LLM 调用前读取的消息必须来自 `session.build_messages_for_llm()`，不能再直接拼 `_conversation_history`。
3. **迁移 runtime 状态**
   - `_iteration`
   - `_total_tokens`
   - `_tool_calls`
   - `_cancelled`
   - `_deterministic_failure_counts`
   - `_deterministic_failure_last_error`
   - `_tool_repeat_call_counts`
   - `_last_llm_stream_meta`
   - 上述状态在 Phase 1 结束后都应由 session/state view 提供。
4. **最后才移除 agent-local 主逻辑**
   - agent-local history compaction / retry short-circuit 逻辑只能保留为 session provider 或 adapter，不再做主入口。

### 历史压缩适配层

Recon 当前的 `_files_read`、`_risk_points_pushed`、`_compress_history()` 不能被 generic compaction 直接替换。Phase 1 需要增加 agent-specific summary provider 机制：

- `AgentRuntimeSession` 负责统一触发压缩。
- `ReconAgent` / `BusinessLogicReconAgent` 提供 evidence-summary provider，把：
  - 已读取文件
  - 已推送风险点
  - 技术栈提取
  - 最近分析思路
  转成结构化 summary block。
- `Analysis` / `Verification` / `Report` / `BusinessLogicAnalysis` 默认可以使用 generic provider，但必须保留文件/行号/符号级证据锚点。

## 接口/类型定义

### `AgentRuntimeSession`

建议定义在 `backend/app/services/agent/runtime/session.py`：

```python
class AgentRuntimeSession:
    spec: RuntimeSessionSpec
    state: RuntimeSessionState

    def seed(self, *, system_prompt: str, initial_user_message: str) -> None: ...
    def build_messages_for_llm(self) -> list[dict]: ...
    def record_llm_response(self, *, content: str, token_count: int) -> None: ...
    def record_tool_success(self, *, tool_name: str, observation: str, metadata: dict) -> None: ...
    def record_tool_failure(self, *, tool_name: str, error: str, error_code: str, metadata: dict) -> None: ...
    def maybe_compact_history(self) -> bool: ...
    def mark_cancelled(self, *, source: str) -> None: ...
    def mark_interrupted(self, *, source: str) -> None: ...
    def should_short_circuit_tool_retry(self, *, tool_name: str, error_code: str) -> bool: ...
    def snapshot_view(self) -> dict: ...
```

### `HistoryCompactionPolicy`

定义在 `backend/app/services/agent/runtime/history.py`，字段至少包括：

- `max_message_count`
- `max_estimated_tokens`
- `min_recent_messages`
- `retain_evidence_refs`
- `retain_last_failures`
- `summary_template`
- `summary_provider_name`

### `RuntimeEventEmitterAdapter`

定义在 `backend/app/services/agent/runtime/events.py`，负责把 Phase 0 冻结的 runtime event 名称以统一 payload 形式发出，避免 agent 自己拼装零散事件字段。

### `RuntimePolicyResolver`

定义在 `backend/app/services/agent/runtime/policies.py`，输入 `phase + agent_type + config`，输出稳定 `RuntimePolicyProfile` 与 `HistoryCompactionPolicy`。

## 本 phase 必改文件

- 新增 `backend/app/services/agent/runtime/session.py`
- 新增 `backend/app/services/agent/runtime/policies.py`
- 新增 `backend/app/services/agent/runtime/events.py`
- 新增 `backend/app/services/agent/runtime/history.py`
- 改造 `backend/app/services/agent/agents/base.py`
  - 删除本地压缩真相源地位
  - 所有历史压缩、counter、runtime flags 改为委托给 session
- 改造 `backend/app/services/agent/agents/recon.py`
  - 把 `_should_compress_history()` / `_compress_history()` 转成 session summary provider / adapter
- 改造 `backend/app/services/agent/agents/business_logic_recon.py`
  - 复用 recon summary provider 机制，不再保留独立主逻辑分叉
- 改造 `backend/app/services/agent/agents/analysis.py`
- 改造 `backend/app/services/agent/agents/business_logic_analysis.py`
- 改造 `backend/app/services/agent/agents/verification.py`
- 改造 `backend/app/services/agent/agents/report.py`
- 改造 `backend/app/services/agent/workflow/workflow_orchestrator.py`
  - 初始 prompt 仍由 agent 组装，但消息注入路径统一经由 session

## 兼容桥接

- 迁移期允许 `_conversation_history` 和 `_state.messages` 继续存在，但它们只能从 session 派生，不能再被直接视为真相源。
- `BaseAgent.stream_llm_call()` 仍可作为 transport façade 保留，但其输入消息必须来自 session view。
- `ToolExecutionCoordinator` 的 `error_code` / `reflection` 仍然是工具失败分类唯一来源，session 只消费结果，不重新解释。
- `MarkdownMemoryStore` 保持存储角色，不承担 session 真相源职责。

## 迁移顺序

1. 先实现 `RuntimePolicyResolver` 与 `HistoryCompactionPolicy`。
2. 实现 `AgentRuntimeSession` 的最小闭环：`seed`、`build_messages_for_llm`、`record_llm/tool`、`maybe_compact_history`。
3. 在 `BaseAgent` 中接入 session，统一 LLM 调用前后的消息流与计数器更新。
4. 把 `ReconAgent` / `BusinessLogicReconAgent` 的压缩逻辑改造成 session summary provider。
5. 再扩展到 `AnalysisAgent`、`BusinessLogicAnalysisAgent`、`VerificationAgent`、`ReportAgent`、`WorkflowOrchestratorAgent`。
6. 最后补齐 runtime event adapter 与 deterministic short-circuit 规则。

## 上下游文档

- 上一篇：[phase0-runtime-contracts-and-guardrails.md](./phase0-runtime-contracts-and-guardrails.md)
- 下一篇：[phase2-skills-progressive-loading.md](./phase2-skills-progressive-loading.md)
- 总览入口：[README.md](./README.md)

## 测试入口

### 新增测试

- `test_runtime_session_history_compaction_preserves_evidence_refs`
- `test_runtime_session_tracks_single_source_of_truth`
- `test_runtime_session_short_circuits_deterministic_failures`
- `test_runtime_session_propagates_cancel_and_interrupt_flags`
- `test_recon_history_summary_provider_preserves_files_and_risk_points`
- `test_runtime_session_covers_report_and_business_logic_agents`

### 复用现有测试资产

- `backend/tests/test_tool_runtime_coordinator.py`
  - 继续验证工具失败 reflection 和 output contract 不回归。
- `backend/tests/test_agent_stream_timeout_diagnostic.py`
  - 验证 session 接入后流式 LLM 调用的超时诊断行为仍正确。
- `backend/tests/test_agent_analysis_loop_guard.py`
  - 验证 session 接管 loop counter 后不会破坏原有分析循环保护。

## 禁止的半成品

- `BaseAgent` 接入了 session，但仍然直接把 `_conversation_history` 当作 LLM 输入真相源。
- `AgentState.messages`、`_conversation_history`、session 三套消息源继续并行演化，没有主从关系。
- `ReconAgent` / `BusinessLogicReconAgent` 仍保留各自压缩主逻辑，而 session 只是消息包装器。
- session 重复做工具错误分类，而不是消费 `ToolExecutionCoordinator` 的 `error_code` 和 `reflection`。
- 只迁移 `Recon/Analysis/Verification/Orchestrator`，遗漏 `Report`、`BusinessLogicRecon`、`BusinessLogicAnalysis`。
- history compaction 后只保留自然语言摘要，不保留结构化证据锚点。
