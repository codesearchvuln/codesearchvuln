# DeerFlow Runtime Phases 总览

## 阅读定位

- **文档类型**：Explanation + migration planning reference。
- **目标读者**：负责 DeerFlow runtime 改造的实现者、reviewer 和方案维护者。
- **阅读目标**：先看清整个改造为什么拆成 5 个 phase，再进入单个 phase 文档执行。
- **建议前置**：默认读者已经知道当前审计 workflow 主线；如果没有这层背景，先回看 [../architecture.md](../architecture.md) 和 [../agentic_scan_core/workflow_overview.md](../agentic_scan_core/workflow_overview.md)。
- **术语入口**：如果你需要先统一 `host session`、`worker profile`、`thread checkpoint` 等词，先看 [../glossary.md](../glossary.md)。

## 目的

本目录用于把 DeerFlow runtime 改造拆成一个共享契约层和四个能力阶段，确保实现者在落代码时不会重复定义 `session / thread / worker / checkpoint / skill`，也不会把现有审计 workflow 的确定性语义改散。

本轮文档默认包含两条主线：

- 主审计链路：`orchestrator -> recon -> analysis -> verification -> report`
- 业务逻辑链路：`business_logic_recon -> business_logic_analysis`

两条链路都属于同一套 runtime 契约，不再把业务逻辑轨道视为临时兼容实现。

## 五个 phase 分别解决什么问题

| Phase | 文档 | 解决的问题 | 进入下一阶段前要稳定什么 |
| --- | --- | --- | --- |
| Phase 0 | [phase0-runtime-contracts-and-guardrails.md](./phase0-runtime-contracts-and-guardrails.md) | 冻结术语、对象模型、事件和边界 | 词表与不可破坏边界 |
| Phase 1 | [phase1-session-runtime-and-middleware.md](./phase1-session-runtime-and-middleware.md) | 统一 host session 真相源 | session、history、runtime policy |
| Phase 2 | [phase2-skills-progressive-loading.md](./phase2-skills-progressive-loading.md) | 收敛 skill 目录与按需加载策略 | unified skill catalog 与 prompt 注入协议 |
| Phase 3 | [phase3-isolated-subagent-runtime.md](./phase3-isolated-subagent-runtime.md) | 把 workflow worker 和 legacy sub-agent 收敛到同一壳 | worker profile、handoff、并发规则 |
| Phase 4 | [phase4-thread-checkpoint-and-recovery.md](./phase4-thread-checkpoint-and-recovery.md) | 建立 thread 级 checkpoint 与恢复 | thread envelope、恢复边界、checkpoint 策略 |

## 当前代码到 Runtime 契约映射

| 当前代码对象 | 代码锚点 | 对应 runtime 契约 | 本轮文档要求 |
| --- | --- | --- | --- |
| `WorkflowPhase` / `WorkflowState` / `WorkflowConfig` | `backend/app/services/agent/workflow/models.py` | phase 词表、phase cursor、并发配额、BL 双轨状态摘要 | Phase 0 冻结命名；Phase 3/4 明确如何接入 worker 与 checkpoint |
| `WorkflowOrchestratorAgent` / `AuditWorkflowEngine` | `backend/app/services/agent/workflow/workflow_orchestrator.py` / `backend/app/services/agent/workflow/engine.py` | Domain Kernel | 语义不换壳，只允许加 runtime adapter 与保存点接线 |
| `ParallelPhaseExecutor` | `backend/app/services/agent/workflow/parallel_executor.py` | phase worker 调度入口、worker quota、worker merge point | Phase 3 作为主 worker runtime 入口 |
| `BaseAgent` / `AgentType` / `_conversation_history` / `stream_llm_call()` | `backend/app/services/agent/agents/base.py` | `RuntimeSessionSpec`、`RuntimeSessionState`、host session 真相源 | Phase 1 把会话状态收敛到 `AgentRuntimeSession` |
| 各 agent 子类 | `backend/app/services/agent/agents/*.py` | agent-specific prompt、解析逻辑、summary provider | Phase 1 迁移 session 时保留领域输出职责 |
| `AgentState` / `AgentStatePersistence` / `AgentCheckpoint` | `backend/app/services/agent/core/state.py` / `backend/app/services/agent/core/persistence.py` / `backend/app/models/agent_task.py` | legacy agent checkpoint、thread checkpoint bridge | Phase 4 采用 DB-first thread checkpoint，同时保留 legacy 能力 |
| `ExecutionContext` | `backend/app/services/agent/core/context.py` | trace/correlation 元数据 | Phase 3 仅保留 trace 职责，不再承载 handoff payload |
| `SubAgentExecutor` / `CreateSubAgentTool` | `backend/app/services/agent/core/executor.py` / `backend/app/services/agent/tools/agent_tools.py` | legacy sub-agent 入口 | Phase 3 改为桥接到受 profile 限制的 worker runtime |
| `ToolExecutionCoordinator` | `backend/app/services/agent/tools/runtime/coordinator.py` | tool contract、稳定错误码、reflection、hook 链 | Phase 0/1 明确它仍是工具失败分类唯一来源 |
| `/skills/catalog` / `/skills/{id}` | `backend/app/api/v1/endpoints/skills.py` | unified skill catalog API | Phase 2 从 scan-core 单源迁到 unified catalog 视图 |
| `/config` 的 `skillAvailability` | `backend/app/api/v1/endpoints/config.py` | runtime-ready skill availability 视图 | Phase 2 从 scan-core-only 迁到 unified catalog availability |
| `scan_core.py` / `build_skill_registry.py` / `backend/docs/agent-tools/*` | `backend/app/services/agent/skills/scan_core.py` / `backend/scripts/build_skill_registry.py` / `backend/docs/agent-tools/` | skills runtime 的三类输入源 | Phase 2 明确优先级、冲突规则和 prompt 注入策略 |
| `MarkdownMemoryStore.load_bundle()` / `write_skills_snapshot()` / `_sync_tool_catalog_to_memory()` | `backend/app/services/agent/memory/markdown_memory.py` / `backend/app/api/v1/endpoints/agent_tasks_execution.py` / `backend/app/api/v1/endpoints/agent_tasks_mcp.py` | prompt memory、`skills.md` 快照、`shared.md` 工具目录摘要 | Phase 2 要同时收敛 `skills.md` 与 `shared.md` 两条注入链 |

## Phase 依赖顺序

1. **Phase 0：Runtime Contracts And Guardrails**
   - 先冻结术语、对象、profile、event taxonomy 和跨阶段边界。
2. **Phase 1：Session Runtime And Middleware**
   - 让 host session 成为单一真相源，统一历史、计数器、失败短路和 runtime flags。
3. **Phase 2：Skills Progressive Loading**
   - 在稳定 session 上挂载 unified skill catalog、summary-only prompt surface 和正文按需加载。
4. **Phase 3：Isolated Sub-Agent Runtime**
   - 把 workflow worker 和 legacy `create_sub_agent` 都收敛到同一套隔离 worker runtime。
5. **Phase 4：Thread Checkpoint And Recovery**
   - 基于 session/skills/worker 稳定对象做 thread checkpoint 持久化与恢复。

依赖规则：

- Phase 1-4 不能再各自定义新版本的 `session spec/state/profile/handoff/checkpoint`。
- Phase 2 只能消费 Phase 1 暴露的 session 接口，不能重新引入 prompt 注入真相源。
- Phase 3 只能读取 Phase 0/1/2 定义好的 profile、session 和 skill load state。
- Phase 4 只能保存前 3 个 phase 暴露的稳定快照，不得回写 queue 真相源。

## 统一迁移规则

### 1. 领域语义不动，adapter 接线允许修改

以下语义必须保持稳定：

- `WorkflowOrchestratorAgent` / `AuditWorkflowEngine` 的确定性 phase 推进
- queue-authoritative model
- `TaskWriteScopeGuard`
- `ToolExecutionCoordinator`
- finding / risk / verification / report 的领域归一化逻辑

以下模块允许为接入 runtime adapter 做接线层改动：

- `backend/app/services/agent/workflow/engine.py`
- `backend/app/services/agent/workflow/parallel_executor.py`
- `backend/app/services/agent/workflow/workflow_orchestrator.py`
- `backend/app/services/agent/agents/*.py`
- `backend/app/services/agent/core/persistence.py`

### 2. 命名以 WorkflowPhase 为主，兼容 AgentType

- runtime phase 词表以 `WorkflowPhase` 当前实际使用的值为准，包含 `business_logic_recon` 与 `business_logic_analysis`。
- `AgentType` 当前仍只有 `orchestrator/recon/analysis/verification/report` 五类；业务逻辑轨道通过兼容映射接到 `recon` / `analysis`，但 runtime profile 不再沿用这种折叠表达。

### 3. 事件采用兼容承载，不要求前端一次性改名

- Phase 0 冻结的 runtime event taxonomy 通过现有 `emit_event()` / telemetry 设施发出。
- 旧前端事件类型可以继续存在；新增 taxonomy 先作为稳定 `event_name + metadata` 约束落地。
- 文档里提到的事件冻结对象是事件名和 metadata 必填字段，不要求立即替换前端展示层的全部文案或类型名。

### 4. prompt 收敛必须同时处理两条注入链

- `skills.md` 注入链：`MarkdownMemoryStore.load_bundle()` 读取 `skills.md` 片段，多个 agent 初始消息直接注入。
- `shared.md` 工具目录链：`_sync_tool_catalog_to_memory()` 把 `TOOL_SHARED_CATALOG.md` 摘要追加到 `shared.md`，又被 agent 初始消息一起带入。

只去掉 `skills.md` 注入而不处理 `shared.md` 工具目录摘要，不算完成 Phase 2。

### 5. checkpoint 采用 DB-first thread checkpoint

- thread checkpoint 首选数据库持久化。
- legacy agent checkpoint 文件/数据库能力继续保留。
- `AgentCheckpoint` 维持原语义；thread checkpoint 使用独立模型和独立查询接口，不把现有 `/agent-tasks/{task_id}/checkpoints` 改成混合列表。

## 现有测试复用矩阵

| 测试文件 | 主要守护内容 | 复用 phase |
| --- | --- | --- |
| `backend/tests/test_tool_runtime_coordinator.py` | tool contract、stable error code、reflection | Phase 0 / Phase 1 |
| `backend/tests/test_agent_stream_timeout_diagnostic.py` | `stream_llm_call()` 超时诊断 | Phase 1 |
| `backend/tests/test_agent_analysis_loop_guard.py` | 分析循环保护与 counter 行为 | Phase 1 |
| `backend/tests/test_skill_registry_builder.py` | registry manifest / aliases / mirror 输出 | Phase 2 |
| `backend/tests/test_skill_registry_api.py` | `/skills` API 兼容性 | Phase 2 |
| `backend/tests/test_tool_catalog_memory_sync.py` | `TOOL_SHARED_CATALOG.md -> shared.md` 同步链 | Phase 2 / Phase 4 |
| `backend/tests/test_runtime_tool_docs_coverage.py` | docs/agent-tools 目录与目录项覆盖 | Phase 2 |
| `backend/tests/test_parallel_executor.py` | phase worker 并发、结果归并 | Phase 3 / Phase 4 |
| `backend/tests/test_agent_prompt_contracts.py` | prompt/tool surface 约束 | Phase 3 |
| `backend/tests/test_agent_task_terminal_finalization.py` | terminal finalization、恢复后终态收敛 | Phase 3 / Phase 4 |

## 最终验收清单

所有 phase 文档细化完成后，应能逐项对照以下清单：

- 词表一致：phase、profile、event、handoff、checkpoint 名称在 5 份文档中没有冲突。
- 路径一致：所有关键实现入口都落到当前仓库真实存在的文件或明确新增文件上。
- 迁移顺序一致：Phase 1-4 没有倒置依赖，也没有跳过桥接层直接切换真相源。
- 测试入口一致：每个 phase 都写清新增测试和复用测试，不依赖实现者自行猜测。
- BL 双轨一致：`business_logic_recon` / `business_logic_analysis` 在 phase、profile、worker、checkpoint 中都被纳入一等契约。
- 技能目录一致：unified catalog、`SKILLS.md` 快照、`shared.md` 工具目录摘要、`/skills` API 与 `/config.skillAvailability` 不再各说各话。
- 恢复边界一致：thread checkpoint 只恢复 runtime state，不回灌 finding/risk/todo 实体，不覆盖 queue 真相源。

## 推荐跳转

- 要统一术语和边界：先读 [phase0-runtime-contracts-and-guardrails.md](./phase0-runtime-contracts-and-guardrails.md)。
- 要按实施顺序推进：从 [phase1-session-runtime-and-middleware.md](./phase1-session-runtime-and-middleware.md) 开始往后读。
- 要回到系统级和智能扫描背景：读 [../architecture.md](../architecture.md) 和 [../agentic_scan_core/workflow_overview.md](../agentic_scan_core/workflow_overview.md)。
