# Phase 0：Runtime Contracts And Guardrails

## 阅读定位

- **文档类型**：Reference-heavy design spec。
- **目标读者**：负责 DeerFlow runtime 改造总体设计、需要冻结术语和边界的人。
- **阅读目标**：先把“哪些词不能改、哪些边界不能破、后续 phase 该依赖什么”定下来。
- **建议前置**：先读 [README.md](./README.md) 了解 5 个 phase 的整体依赖顺序。
- **术语入口**：相关核心词可在 [../glossary.md](../glossary.md) 中快速查阅。

## 目标与边界

### 目标

本阶段不引入新的运行时能力，而是先冻结 DeerFlow runtime 改造必须共用的术语、对象、稳定命名、事件 taxonomy 和不可破坏边界。Phase 1 到 Phase 4 只能建立在本文件定义过的契约之上，避免各阶段再次发明新的 `session / thread / worker / checkpoint / skill` 词表。

### 范围

- 冻结完整 runtime phase / profile 词表。
- 定义统一 runtime 分层模型。
- 定义共享对象模型与依赖方向。
- 定义 runtime event taxonomy 与兼容承载规则。
- 定义 `WorkflowPhase` / `AgentType` / runtime profile 的映射关系。
- 明确哪些模块语义不可替换，哪些模块允许做 adapter 接线改动。

### 非目标

- 不替换 `WorkflowOrchestratorAgent`。
- 不替换 `AuditWorkflowEngine`。
- 不把主流程退回 lead-agent 自由编排。
- 不改变 `WorkflowEngine` 当前确定性的阶段顺序与队列主权：
  - `recon`
  - `business_logic_recon`
  - `analysis`
  - `business_logic_analysis`
  - `verification`
  - `report`
- 不弱化 queue-authoritative model。
- 不绕过 `TaskWriteScopeGuard`、`ToolExecutionCoordinator`、现有 finding/queue 归一化规则。
- 不在本阶段定义新的外部 orchestrator API。

### 哪些模块语义不动，但允许 adapter 接线改动

以下模块的领域语义和主责保持不变：

- `backend/app/services/agent/workflow/engine.py`
- `backend/app/services/agent/workflow/workflow_orchestrator.py`
- `backend/app/services/agent/workflow/parallel_executor.py`
- `backend/app/services/agent/mcp/write_scope.py`
- `backend/app/services/agent/tools/runtime/coordinator.py`
- 现有队列服务及其对 task/finding/risk/todo 的真相源地位

允许的改动边界：

- 可以给上述模块增加 runtime adapter、profile 解析、事件补发、checkpoint 触发点、worker bridge。
- 不允许借接线改动改变 phase 语义、queue 真相源、tool contract 或写保护语义。

## 当前代码锚点

- `backend/app/services/agent/workflow/models.py`
  - 当前 `WorkflowPhase` 已包含 `business_logic_recon` 和 `business_logic_analysis`，Phase 0 必须与此对齐。
- `backend/app/services/agent/agents/base.py`
  - 当前 `AgentType` 只有 `orchestrator / recon / analysis / verification / report` 五类，需要在 runtime 契约层补上 BL 兼容映射。
- `backend/app/services/agent/workflow/engine.py`
  - 当前 workflow 是确定性推进，BL 双轨已接入真实执行路径。
- `backend/app/services/agent/core/context.py`
  - 当前 `ExecutionContext` 只适合承载 trace/correlation，不适合继续扩展 handoff payload。
- `backend/app/services/agent/core/persistence.py` 与 `backend/app/models/agent_task.py`
  - 当前 checkpoint 以 `AgentState` / `AgentCheckpoint` 为中心，尚未定义 thread runtime envelope。
- `backend/app/api/v1/endpoints/skills.py` 与 `backend/app/api/v1/endpoints/config.py`
  - 当前 skills API 与 `skillAvailability` 仍是 scan-core 单源视图。

## 现状与缺口

### 当前已经做对的部分

- 审计主流程由 workflow 和队列驱动，不依赖大模型自由拆解。
- `WorkflowPhase` 已经真实表达了 BL 双轨的存在。
- `MarkdownMemoryStore` 已具备项目级长期沉淀能力。
- `ToolExecutionCoordinator` 已经形成工具输入输出契约、稳定错误码和 hook 链。
- `scan_core`、`backend/docs/agent-tools`、`backend/scripts/build_skill_registry.py` 已具备构建 skills runtime 的材料。
- `AgentStatePersistence` 与 `AgentCheckpoint` 已具备恢复雏形。

### 当前缺口

- runtime 概念分散在 `BaseAgent`、agent 子类、memory、MCP runtime、tool hooks、workflow executor 中，没有共享中心对象。
- 文档词表没有覆盖当前代码里已经存在的 `business_logic_recon` / `business_logic_analysis`。
- “线程”“会话”“worker”“handoff”“checkpoint” 目前没有统一边界，容易在不同 phase 被重复定义。
- 子 agent / worker 派发仍依赖自由 `dict` 透传，缺少结构化 handoff envelope。
- 技能体系同时存在 `scan_core`、registry manifest、`SKILLS_INDEX`、`skills.md`、`shared.md` 工具目录摘要，多源但没有统一协议。
- checkpoint 仍以 `AgentState` 为中心，而不是以 “thread runtime + latest agent checkpoint ref” 为中心。

## 目标状态

### 统一分层

后续 runtime 重构必须遵守以下五层结构：

1. **Domain Kernel**
   - `WorkflowOrchestratorAgent`
   - `AuditWorkflowEngine`
   - `ParallelPhaseExecutor`
   - 队列服务
   - finding/risk/verification/report 领域归一化逻辑
2. **Runtime Session Layer**
   - 会话历史、summary、todo、turn counters、runtime policy、cancel/interrupt flags
3. **Skills Runtime Layer**
   - unified skill catalog、摘要注入、正文加载、deferred tool exposure
4. **Worker Runtime Layer**
   - phase 内隔离 worker、handoff envelope、tool allow/deny、parallel quota、worker result merge
5. **Thread Checkpoint Layer**
   - thread envelope 持久化、恢复、agent checkpoint 引用、queue fingerprint 校验

### 依赖方向

- Domain Kernel 不依赖后 4 层新增实现细节。
- Skills Runtime 依赖 Runtime Session，但不依赖 Worker Runtime。
- Worker Runtime 依赖 Runtime Session 与 Skills Runtime。
- Thread Checkpoint 依赖前 3 层暴露出的稳定对象，不反向修改 queue 真相源。

### 冻结 runtime phase 词表

以下 phase 名称一旦落地后不得在后续 phase 中改名：

- `orchestrator`
- `recon`
- `business_logic_recon`
- `analysis`
- `business_logic_analysis`
- `verification`
- `report`

### 冻结 stable profile 名称

#### Host profiles

- `orchestrator_host`
- `recon_host`
- `business_logic_recon_host`
- `analysis_host`
- `business_logic_analysis_host`
- `verification_host`
- `report_host`

#### Worker profiles

- `analysis_worker`
- `business_logic_analysis_worker`
- `verification_worker`
- `report_worker`

说明：

- `business_logic_recon` 是 host-only phase，不定义独立 worker profile。
- `business_logic_analysis_worker` 是一等 profile，不再把 BL analysis 简化成 `analysis_worker` 的文档别名。

## 接口/类型定义

### `WorkflowPhase` / `AgentType` / runtime profile 映射

| 运行时 phase | 当前 `WorkflowPhase` | 当前 `AgentType` 兼容映射 | host profile | worker profile |
| --- | --- | --- | --- | --- |
| `orchestrator` | 不直接出现在 `WorkflowPhase`，由 orchestrator 宿主生命周期承载 | `orchestrator` | `orchestrator_host` | 无 |
| `recon` | `RECON` | `recon` | `recon_host` | 无 |
| `business_logic_recon` | `BUSINESS_LOGIC_RECON` | `recon` | `business_logic_recon_host` | 无 |
| `analysis` | `ANALYSIS` | `analysis` | `analysis_host` | `analysis_worker` |
| `business_logic_analysis` | `BUSINESS_LOGIC_ANALYSIS` | `analysis` | `business_logic_analysis_host` | `business_logic_analysis_worker` |
| `verification` | `VERIFICATION` | `verification` | `verification_host` | `verification_worker` |
| `report` | `REPORT` | `report` | `report_host` | `report_worker` |

### `RuntimeSessionSpec`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `session_id` | `str` | 单次 agent runtime session 的唯一标识 |
| `thread_id` | `str` | 所属 thread 标识；host/worker 都必须有 |
| `parent_thread_id` | `str \| None` | worker thread 才允许填写 |
| `task_id` | `str` | 所属审计任务 ID |
| `phase` | `Literal["orchestrator","recon","business_logic_recon","analysis","business_logic_analysis","verification","report"]` | 当前 runtime phase |
| `agent_type` | `str` | 当前 agent 类型；允许与 phase 存在兼容映射 |
| `profile_name` | `str` | 必须来自稳定 profile 名称集合 |
| `history_budget` | `dict` | 历史保留、压缩阈值、summary provider 配置 |
| `skill_policy` | `dict` | skill 摘要注入、正文加载、deferred schema 策略 |
| `worker_policy` | `dict` | 并发配额、递归派生策略、handoff 裁剪策略 |
| `checkpoint_policy` | `dict` | checkpoint 触发点与恢复策略 |
| `trace_context` | `dict` | correlation_id、trace_path、parent_agent_id 等 |

### `RuntimeSessionState`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `messages_tail` | `list[dict]` | 当前 session 持有的短历史 |
| `summary_blocks` | `list[dict]` | 历史压缩后保留的结构化 summary 块 |
| `todo_state` | `dict` | 当前 session 可恢复的 todo/verification 子状态 |
| `loop_counters` | `dict` | llm turns、tool calls、retry streak、repeat streak |
| `loaded_skill_ids` | `list[str]` | 已加载 skill 正文的集合 |
| `last_tool_failures` | `list[dict]` | 最近结构化工具失败摘要 |
| `last_checkpoint_id` | `str \| None` | 最近 thread checkpoint 引用 |
| `runtime_flags` | `dict` | cancelled、interrupted、degraded 等运行标志 |

### `RuntimePolicyProfile`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `str` | profile 稳定名称 |
| `tool_allowlist` | `list[str] \| None` | 显式允许工具；`None` 表示由 denylist + family policy 决定 |
| `tool_denylist` | `list[str]` | 必须稳定生效的禁止工具 |
| `max_turns` | `int` | 单 session 或单 worker 最大轮次 |
| `max_parallel_workers` | `int` | phase 内并发 worker 上限 |
| `allow_recursive_worker` | `bool` | 默认必须为 `False` |
| `history_mode` | `Literal["host","isolated_worker"]` | 是否继承长历史 |
| `write_scope_profile` | `str` | 写权限策略名，必须映射到现有写保护体系 |
| `skill_load_policy` | `str` | `summary_only` / `progressive` 等 |

### `HandoffEnvelope`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `handoff_id` | `str` | 唯一交接 ID |
| `parent_session_id` | `str` | 来源 session |
| `target_profile` | `str` | 目标 worker profile |
| `task` | `str` | 子任务自然语言描述 |
| `goal` | `str` | 必须完成的结果目标 |
| `evidence_refs` | `list[dict]` | 文件、函数、行号、queue item 等证据引用 |
| `queue_refs` | `list[dict]` | risk/finding/todo 引用，不存实体副本 |
| `memory_refs` | `list[dict]` | shared/agent memory 节点引用 |
| `selected_context` | `dict` | 从父线程裁剪出的最小必要上下文 |
| `trace_context` | `dict` | trace、correlation、parent agent 元信息 |

## 上下游文档

- 总览入口：[README.md](./README.md)
- 下一篇：[phase1-session-runtime-and-middleware.md](./phase1-session-runtime-and-middleware.md)
- 术语对照：[../glossary.md](../glossary.md)

### `ThreadCheckpointEnvelope`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `checkpoint_id` | `str` | thread checkpoint 唯一标识 |
| `task_id` | `str` | 审计任务 ID |
| `thread_id` | `str` | thread 标识 |
| `parent_thread_id` | `str \| None` | worker thread 才允许出现 |
| `phase` | `str` | 当前 thread 所属 runtime phase |
| `title` | `str` | thread 标题 |
| `summary` | `dict` | thread 层 summary，不保存原始长历史 |
| `todos` | `dict` | 可恢复的 todo 状态 |
| `runtime_counters` | `dict` | llm/tool/worker 相关计数器 |
| `active_skill_ids` | `list[str]` | 当前 thread 已加载的 skill |
| `latest_agent_checkpoint_ref` | `str \| None` | 指向现有 `AgentCheckpoint` |
| `workflow_refs` | `dict` | `phase_cursor`、`queue_fingerprints`、`worker_thread_refs`、`workflow_state_digest` |
| `created_at` | `str` | UTC 时间 |

### Runtime Event Taxonomy

以下事件名称必须被冻结，后续 phase 只允许扩展 payload，不允许重命名：

| 事件名 | 触发阶段 | 兼容承载 | 必填 payload |
| --- | --- | --- | --- |
| `runtime_profile_resolved` | Phase 1+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `session_id`, `profile_name`, `phase`, `agent_type` |
| `history_compacted` | Phase 1+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `session_id`, `message_count_before`, `message_count_after`, `summary_block_count` |
| `skill_summary_injected` | Phase 2+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `session_id`, `skill_ids`, `load_mode` |
| `skill_body_loaded` | Phase 2+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `session_id`, `skill_id`, `source`, `resource_count` |
| `worker_spawned` | Phase 3+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `parent_thread_id`, `worker_thread_id`, `target_profile`, `handoff_id` |
| `worker_completed` | Phase 3+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `worker_thread_id`, `parent_thread_id`, `result_class`, `finding_count` |
| `thread_checkpoint_saved` | Phase 4+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `thread_id`, `checkpoint_id`, `phase`, `latest_agent_checkpoint_ref` |
| `thread_checkpoint_restored` | Phase 4+ | 通过现有 `emit_event()` / telemetry metadata 发出 | `thread_id`, `checkpoint_id`, `phase`, `restore_status` |

兼容原则：

- 新 taxonomy 先冻结事件名和 metadata 字段，不要求前端一次性替换现有事件类型文案。
- 任何 phase 不得再创建各自私有的 `skills_*`、`worker_*`、`checkpoint_*` 平行事件命名空间。

## 本 phase 必改文件

- 新增 `backend/app/services/agent/runtime/contracts.py`
  - 收敛 `RuntimeSessionSpec`、`RuntimeSessionState`、`RuntimePolicyProfile`、`HandoffEnvelope`、`ThreadCheckpointEnvelope`
- 新增 `backend/app/services/agent/runtime/profiles.py`
  - 稳定 profile 常量、phase 映射、`WorkflowPhase`/`AgentType` 兼容解析
- 新增 `backend/app/services/agent/runtime/events.py`
  - runtime event name 常量和 payload helper
- 可选新增 `backend/tests/test_agent_runtime_contracts.py`
  - 共享对象、命名、taxonomy 稳定性测试

## 兼容桥接

- `ExecutionContext` 在进入 Phase 3 之前仍可继续使用，但新增 handoff 字段不得继续塞进它。
- `AgentType` 在短期内可以保留五类；BL 双轨通过 `phase -> agent_type` 的兼容映射过渡。
- `emit_event()` / telemetry 继续作为 runtime event 的发射设施；Phase 0 不要求替换前端事件消费层。
- 当前 workflow / queue / tool result / finding 对外结构保持不变。

## 迁移顺序

1. 先冻结本文件里的 phase、profile、event、shared object 词表。
2. 再创建 `runtime/contracts.py`、`runtime/profiles.py`、`runtime/events.py` 作为唯一承载位置。
3. 增加稳定命名与序列化测试。
4. 最后才允许进入 session、skills、worker、checkpoint 四个能力阶段。

## 测试入口

### 新增测试

- `test_agent_runtime_contracts_serialization`
- `test_runtime_profile_name_set_is_stable`
- `test_runtime_phase_agent_type_mapping_covers_business_logic_tracks`
- `test_runtime_event_taxonomy_names_are_stable`

### 复用现有测试资产

- `backend/tests/test_tool_runtime_coordinator.py`
  - 守住 tool runtime contract 和 stable error code，不允许 Phase 0 改写 coordinator 主责。
- `backend/tests/test_parallel_executor.py`
  - 作为 BL 双轨和 phase worker 存量路径的现实校验依据。
- `backend/tests/test_agent_task_terminal_finalization.py`
  - 为后续 checkpoint/finalization 边界提供现状基线。

## 禁止的半成品

- 文档仍只冻结主链路命名，遗漏 `business_logic_recon` / `business_logic_analysis`。
- profile 名称同时混用 `subagent`、`worker_runtime`、`phase_worker` 等平行命名。
- `skills`、`checkpoint`、`worker` 各自维护私有 event taxonomy。
- `engine.py`、`parallel_executor.py`、`workflow_orchestrator.py` 被宣称“不动”，但后续 phase 又不得不在这些位置补接线。
- 继续把 `ExecutionContext` 当作 trace 与 handoff payload 的双重承载体。
