# Phase 3：Isolated Sub-Agent Runtime

## 阅读定位

- **文档类型**：How-to oriented implementation spec。
- **目标读者**：负责 worker runtime、handoff、并发配额和 legacy sub-agent 兼容桥接的实现者。
- **阅读目标**：理解本 phase 的重点是“统一 worker 壳与隔离规则”，不是重写顶层 orchestrator。
- **建议前置**：先读 [phase0-runtime-contracts-and-guardrails.md](./phase0-runtime-contracts-and-guardrails.md) 和 [phase1-session-runtime-and-middleware.md](./phase1-session-runtime-and-middleware.md)；如果会依赖 skills 能力，再补读 [phase2-skills-progressive-loading.md](./phase2-skills-progressive-loading.md)。
- **术语入口**：`worker profile`、`HandoffEnvelope` 等词可先在 [../glossary.md](../glossary.md) 中对齐。

## 目标与边界

### 目标

把当前 `ParallelPhaseExecutor`、`SubAgentExecutor`、`CreateSubAgentTool`、`ExecutionContext.child_context()` 的松散派发模式，收敛成统一的隔离 worker runtime。核心目标是“收敛为同一套 worker 壳”，而不是重新设计顶层 orchestrator。

### 范围

- worker profile
- tool allowlist / denylist
- 独立消息历史
- 并发配额
- 父子 trace
- `HandoffEnvelope.selected_context`
- 递归派生阻断
- workflow worker 主入口
- legacy `create_sub_agent` 兼容桥接
- phase 内批次调度
- worker 结果归并协议

### 非目标

- 不把顶层主流程交还给 lead-agent 自由拆解。
- 不让 worker 直接拥有新的 queue 真相源。
- 不在本阶段实现 thread checkpoint 落盘。
- 不重写 workflow engine 的 phase 推进。

### 哪些模块语义不动

- `WorkflowOrchestratorAgent` 的顶层确定性阶段推进

## 上下游文档

- 上一篇：[phase2-skills-progressive-loading.md](./phase2-skills-progressive-loading.md)
- 下一篇：[phase4-thread-checkpoint-and-recovery.md](./phase4-thread-checkpoint-and-recovery.md)
- 总览入口：[README.md](./README.md)
- `AuditWorkflowEngine` 的 phase 顺序和队列驱动语义
- `TaskWriteScopeGuard` 的写保护语义
- `ToolExecutionCoordinator` 的工具 contract 语义

## 当前代码锚点

- `backend/app/services/agent/workflow/parallel_executor.py`
  - 当前是 phase worker 的真实调度入口，已经负责并发、worker agent 克隆、结果汇总。
- `backend/app/services/agent/workflow/engine.py`
  - 当前是 phase 边界与 queue 消耗的唯一权威入口。
- `backend/app/services/agent/core/executor.py`
  - 当前 `SubAgentExecutor.create_and_run_sub_agent()` 仍通过自由 `context` 字典传递上下文。
- `backend/app/services/agent/tools/agent_tools.py`
  - 当前 `CreateSubAgentTool` 仍允许创建并立即执行 legacy 子 agent。
- `backend/app/services/agent/core/context.py`
  - 当前 `ExecutionContext.child_context()` 只负责 trace 派生。
- `backend/app/services/agent/workflow/models.py`
  - 当前 `WorkflowConfig` 已包含 `bl_analysis_max_workers`，文档必须与此对齐。

## 现状与缺口

### 当前现状

- `ParallelPhaseExecutor` 已经是 analysis / verification / report / BL analysis 的事实 worker runtime。
- `CreateSubAgentTool` 可以创建并立即执行子 agent。
- `SubAgentExecutor.create_and_run_sub_agent()` 当前通过自由 `context` 字典传递上下文。
- `ExecutionContext.child_context()` 主要负责 trace 派生，不承担结构化 handoff 协议。
- 当前 workflow worker 和 legacy sub-agent 是两套并行实现，不共享同一套 profile、handoff、result merge 契约。

### 核心缺口

- 父线程与子线程的消息历史没有明确边界。
- 递归派生能力默认没有被 runtime 层阻断。
- phase 内并发策略仍有“workflow 配额”和“legacy 子 agent 自由派发”两套来源。
- handoff payload 缺少结构化证据引用与 queue 引用协议。
- `business_logic_analysis` 当前是真实 phase，但文档里没有一等 worker profile。
- worker 结果归并缺少统一 envelope，容易在实现时绕过父线程直接写 queue。

## 目标状态

### 双入口模型

Phase 3 必须明确两类入口，但只保留一套底层 worker runtime：

1. **主入口：workflow phase worker**
   - `WorkflowEngine + ParallelPhaseExecutor`
   - 是 analysis / business_logic_analysis / verification / report 的主要 worker runtime
2. **兼容入口：legacy sub-agent**
   - `CreateSubAgentTool + SubAgentExecutor`
   - 只能桥接到受 profile 限制的同一套 worker runtime
   - 不能继续维持“自由 context 字典 + 自由子 agent 树”模式

### 角色切分

- `analysis_worker`
  - 面向候选风险点的文件/函数级分析
  - 默认只读工具 + 分析工具
- `business_logic_analysis_worker`
  - 面向候选业务逻辑风险点的鉴权/流程/状态机分析
  - 与 `analysis_worker` 独立 profile，不再只是“analysis 的文档别名”
- `verification_worker`
  - 面向候选 finding 的验证与 PoC/运行时佐证
  - 默认允许验证工具、动态执行工具和读工具
- `report_worker`
  - 面向报告归并与证据整理
  - 默认允许报告生成和只读检索工具

### 父线程 / worker 关系

- 父线程负责：
  - 决定是否启动 worker
  - 生产 `HandoffEnvelope`
  - 管理 phase 内配额
  - 合并 worker 结果
  - 决定何时写 queue / `_agent_results` / report 输入
- worker 负责：
  - 处理 handoff 指定的子任务
  - 仅使用其 profile 允许的工具
  - 持有独立消息历史
  - 返回结构化结果，不直接声明自己是 queue 真相源

### 独立历史规则

- worker thread 从新的 user task message 开始。
- 只允许读取 `HandoffEnvelope.selected_context` 中裁剪出的必要信息。
- 不默认继承父线程的长历史、思考日志和原始对话链。

## 接口/类型定义

### `WorkerRuntimeProfile`

在 `RuntimePolicyProfile` 基础上对各 worker 固定如下默认行为：

#### `analysis_worker`

- `allow_recursive_worker = False`
- `history_mode = "isolated_worker"`
- `max_parallel_workers` 由父 phase 配额控制
- 默认工具 allowlist：
  - `list_files`
  - `search_code`
  - `get_code_window`
  - `get_file_outline`
  - `get_function_summary`
  - `get_symbol_body`
  - `locate_enclosing_function`
  - `pattern_match`
  - `smart_scan`
  - `dataflow_analysis`
  - `controlflow_analysis_light`
  - `logic_authz_analysis`
- 默认 denylist：
  - `create_sub_agent`
  - 任意再次派发 worker 的工具

#### `business_logic_analysis_worker`

- `allow_recursive_worker = False`
- `history_mode = "isolated_worker"`
- 默认工具 allowlist：
  - `list_files`
  - `search_code`
  - `get_code_window`
  - `get_file_outline`
  - `get_function_summary`
  - `get_symbol_body`
  - `locate_enclosing_function`
  - `logic_authz_analysis`
  - `controlflow_analysis_light`
  - `pattern_match`
- 默认 denylist：
  - `create_sub_agent`
  - `run_code`
  - `sandbox_exec`
- 说明：
  - 它是独立 profile，不和 `analysis_worker` 共用名字。
  - 可以复用 analysis 类 agent 实现，但 runtime policy 必须独立解析。

#### `verification_worker`

- 在 analysis_worker 的读工具基础上额外允许：
  - `run_code`
  - `sandbox_exec`
  - `verify_vulnerability`
- 默认 denylist 同样包含：
  - `create_sub_agent`

#### `report_worker`

- 允许使用：
  - 只读代码检索工具
  - `create_vulnerability_report`
- 默认 denylist：
  - `create_sub_agent`
  - 动态验证类工具

### `IsolatedWorkerRuntime`

建议定义在 `backend/app/services/agent/runtime/subagents/executor.py`：

```python
class IsolatedWorkerRuntime:
    def spawn(self, *, profile_name: str, handoff: HandoffEnvelope) -> str: ...
    async def run(self, worker_thread_id: str) -> dict: ...
    def list_active_workers(self, *, parent_thread_id: str) -> list[dict]: ...
    def collect_result(self, worker_thread_id: str) -> dict: ...
```

### `WorkerResultEnvelope`

worker 返回给父线程的统一结果至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `worker_thread_id` | `str` | worker thread 标识 |
| `parent_thread_id` | `str` | 父 thread 标识 |
| `profile_name` | `str` | worker profile |
| `result_class` | `Literal["analysis","business_logic_analysis","verification","report"]` | 结果类别 |
| `summary` | `dict` | 本次 worker 的最小可归并摘要 |
| `evidence_refs` | `list[dict]` | 结构化证据引用 |
| `finding_candidates` | `list[dict]` | 候选 finding 或验证更新 |
| `report_artifacts` | `list[dict]` | 报告草稿、摘要等产物 |
| `runtime_counters` | `dict` | llm/tool/turn 计数器 |
| `queue_write_intent` | `bool` | 是否建议父线程写 queue；worker 自身不直接成为真相源 |

### `HandoffEnvelope.selected_context` 规则

必须只包含以下四类内容：

- 当前子任务必须使用的证据摘要
- queue item 引用
- 必要的项目上下文与配置片段
- 受限的 memory 摘要

禁止包含：

- 父线程完整消息历史
- 父线程完整思考日志
- 与当前子任务无关的 bootstrap findings 全量副本

## 本 phase 必改文件

- 新增 `backend/app/services/agent/runtime/subagents/profiles.py`
- 新增 `backend/app/services/agent/runtime/subagents/executor.py`
- 新增 `backend/app/services/agent/runtime/subagents/handoff.py`
- 新增 `backend/app/services/agent/runtime/subagents/scheduler.py`
- 改造 `backend/app/services/agent/workflow/parallel_executor.py`
  - 作为 workflow worker 主入口接入新 runtime，而不是自建第二套并发/merge 契约
- 改造 `backend/app/services/agent/workflow/engine.py`
  - phase 内配额读取统一来自 runtime profile
- 改造 `backend/app/services/agent/core/context.py`
  - `ExecutionContext` 只保留 trace/correlation 元数据职责
- 改造 `backend/app/services/agent/core/executor.py`
  - `SubAgentExecutor` 从自由上下文派发切换为 handoff envelope + worker runtime bridge
- 改造 `backend/app/services/agent/tools/agent_tools.py`
  - `CreateSubAgentTool` 改为只能请求受 profile 限制的 worker runtime

## 兼容桥接

- `ParallelPhaseExecutor` 是主入口，不需要被新的 sub-agent runtime 取代；它需要被收敛为新 worker runtime 的 workflow façade。
- `CreateSubAgentTool` 在迁移期可以继续保留对外名称，但底层不能再自由创建无约束子 agent。
- 无法映射到稳定 worker profile 的 legacy 请求，应返回受控降级或 policy block，而不是继续走自由 `context` 模式。
- `ExecutionContext` 继续承载 trace，但 handoff payload 必须迁到 `HandoffEnvelope`。

## 迁移顺序

1. 先实现 worker profile registry 与 allow/deny 规则，包含 `business_logic_analysis_worker`。
2. 实现 `HandoffEnvelope` builder 和 `selected_context` 裁剪器。
3. 让 `ParallelPhaseExecutor` 改由 `IsolatedWorkerRuntime` 承载真正的 worker 生命周期。
4. 定义 `WorkerResultEnvelope`，把父线程归并协议固定下来。
5. 再让 `SubAgentExecutor` / `CreateSubAgentTool` 改走同一套 worker runtime bridge。
6. 最后统一并发配额读取、trace 链接和 legacy 降级策略。

## 测试入口

### 新增测试

- `test_isolated_worker_runtime_blocks_recursive_spawn`
- `test_worker_history_is_isolated_from_parent`
- `test_worker_handoff_selected_context_is_trimmed`
- `test_phase_worker_quota_is_enforced`
- `test_parent_and_worker_trace_are_linked_but_not_shared`
- `test_business_logic_analysis_worker_uses_dedicated_profile`
- `test_legacy_create_sub_agent_bridges_to_worker_runtime`
- `test_worker_result_envelope_is_merged_only_by_parent`

### 复用现有测试资产

- `backend/tests/test_parallel_executor.py`
  - 验证 phase 内并发结果合并在引入 worker runtime 后不回归。
- `backend/tests/test_agent_prompt_contracts.py`
  - 验证 worker profile 对 prompt / tool 可见性约束不破坏关键工具契约。
- `backend/tests/test_agent_task_terminal_finalization.py`
  - 验证 worker 引入后最终收尾和 verification gate 语义不变。

## 禁止的半成品

- worker runtime 已引入，但 `ParallelPhaseExecutor` 和 legacy `SubAgentExecutor` 仍各自维护一套上下文与归并协议。
- workflow worker 走新 runtime，`create_sub_agent` 仍然自由透传完整父上下文。
- `business_logic_analysis` 仍然没有独立 profile，只在说明文字里被当作 `analysis_worker` 的别名。
- worker 结果直接写 queue，父线程只做被动汇总。
- 并发配额既存在于 `ParallelPhaseExecutor`，又存在于 worker runtime，且来源不一致。
- `ExecutionContext` 继续同时承担 trace 和 handoff payload 两种职责。
