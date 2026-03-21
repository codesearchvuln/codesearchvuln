# Phase 4：Thread Checkpoint And Recovery

## 目标与边界

### 目标

在保留 `AgentStatePersistence` 与现有 `AgentCheckpoint` 的前提下，引入 thread 级 checkpoint envelope，把恢复中心从“单个 agent snapshot”提升为“会话 runtime + workflow state digest + latest agent checkpoint ref”的双层恢复模型。

### 范围

- thread envelope 存储模型
- 保存点策略
- 恢复顺序
- 与 agent checkpoint 的引用关系
- title / summary / todos / runtime counters / loaded skills 恢复
- `WorkflowState` 摘要与 BL 轨道计数的序列化边界
- queue refs / fingerprint 存储边界
- thread checkpoint 的数据库模型与 API 暴露方式

### 非目标

- 不把 queue 实体副本存入 checkpoint。
- 不让 checkpoint 覆盖 workflow 和 queue 的真相源。
- 不替换现有 `AgentStatePersistence` 文件/数据库能力。
- 不把 checkpoint 触发点扩大到“每次工具调用后都落盘”。

### 哪些模块语义不动

- queue 服务的领域权威地位
- `WorkflowState` 作为领域状态摘要的地位
- `TaskWriteScopeGuard`
- `ToolExecutionCoordinator`

## 当前代码锚点

- `backend/app/services/agent/core/persistence.py`
  - 当前只提供 `AgentStatePersistence` 和 `CheckpointManager`，以 agent state 为中心。
- `backend/app/models/agent_task.py`
  - 当前只定义 `AgentCheckpoint` ORM 模型。
- `backend/app/api/v1/endpoints/agent_tasks_routes_results.py`
  - 当前 `/agent-tasks/{task_id}/checkpoints` 仅查询 `AgentCheckpoint`。
- `backend/app/services/agent/config.py`
  - 当前已有 `checkpoint_enabled`、`checkpoint_interval_iterations`、`checkpoint_on_tool_complete`、`checkpoint_on_phase_complete`。
- `backend/app/services/agent/workflow/engine.py`
  - 当前是真正的 phase 边界与 workflow state 变化点。
- `backend/app/services/agent/workflow/parallel_executor.py`
  - 当前是真正的 worker 完成与结果归并点。
- `backend/app/services/agent/runtime/session.py`
  - Phase 4 需要依赖它导出 thread-level snapshot view。

## 现状与缺口

### 当前现状

- `AgentStatePersistence` 已支持保存和加载 `AgentState`。
- 配置中已有 checkpoint 相关参数。
- 现有 checkpoint 主要围绕 agent 快照组织，而不是 thread runtime。
- 当前 API 也只暴露 agent checkpoint。

### 核心缺口

- 无法统一恢复 title、summary、todos、loop counters、loaded skills 等 thread 级状态。
- `WorkflowState` 的 BL 轨道计数、phase cursor、worker refs 还没有稳定的序列化边界。
- 恢复逻辑没有 thread 层 envelope，导致 UI thread / worker thread / host session 没有共同恢复语义。
- queue 状态与 runtime 状态之间缺少“只保存引用、不保存实体”的边界。
- 当前 API/ORM 没有 thread checkpoint 的查询入口。

## 目标状态

### 双层恢复模型

恢复模型分两层：

1. **Thread Checkpoint Envelope**
   - 恢复 thread 级 runtime
   - 包括 title、summary、todos、runtime counters、loaded skills、workflow refs、workflow state digest
2. **Agent Checkpoint**
   - 恢复最近一次 agent-specific 内部状态
   - 由 thread checkpoint 通过 `latest_agent_checkpoint_ref` 引用

### 存储策略

本阶段明确选择：

- **thread checkpoint：数据库优先**
- **agent checkpoint：继续保留 legacy 文件/数据库能力**
- **API 暴露：新增独立 thread checkpoint 接口，不扩展现有 `/agent-tasks/{task_id}/checkpoints` 为混合视图**

建议新增表：

- `agent_thread_checkpoints`
  - `id`
  - `task_id`
  - `thread_id`
  - `parent_thread_id`
  - `phase`
  - `agent_type`
  - `title`
  - `summary_json`
  - `todos_json`
  - `runtime_counters_json`
  - `active_skill_ids_json`
  - `workflow_refs_json`
  - `latest_agent_checkpoint_ref`
  - `created_at`

建议新增接口：

- `GET /agent-tasks/{task_id}/thread-checkpoints`
- `GET /agent-tasks/{task_id}/thread-checkpoints/{checkpoint_id}`

兼容要求：

- `GET /agent-tasks/{task_id}/checkpoints` 继续只返回 `AgentCheckpoint`
- 旧客户端不需要一次性理解 thread checkpoint

### `workflow_refs` 与 `WorkflowState` 摘要边界

`ThreadCheckpointEnvelope.workflow_refs` 只允许出现：

- `queue_fingerprints`
- `phase_cursor`
- `worker_thread_refs`
- `last_processed_item_refs`
- `workflow_state_digest`

`workflow_state_digest` 只允许保存 `WorkflowState` 的摘要字段，例如：

- `phase`
- `recon_done`
- `bl_recon_done`
- `analysis_risk_points_total`
- `analysis_risk_points_processed`
- `bl_risk_points_total`
- `bl_risk_points_processed`
- `bl_analysis_confirmed_count`
- `vuln_queue_findings_total`
- `vuln_queue_findings_processed`
- `report_findings_total`
- `report_findings_processed`

禁止出现：

- finding / risk / todo 实体副本
- 原始 queue 全量列表
- `WorkflowState.step_records` 全量深拷贝
- 可直接覆盖领域真相源的冗余快照

### 保存点策略

默认只在以下时机落 thread checkpoint：

- phase 边界
  - 触发位置：`WorkflowEngine`
- history compaction 完成后
  - 触发位置：`AgentRuntimeSession`
- worker 完成并结果归并后
  - 触发位置：`ParallelPhaseExecutor`
- terminal finalization 前
  - 触发位置：workflow/orchestrator 终态收敛路径
- 显式恢复前的安全保存点

默认不在以下时机落盘：

- 每次普通 tool success 后
- 每次普通 llm turn 后
- 每次读取 memory 后

### 恢复顺序

恢复顺序必须固定：

1. 在 orchestrator/workflow 启动前进入 thread restore gate
2. 根据 `task_id + thread_id` 加载最新 `ThreadCheckpointEnvelope`
3. 校验 `workflow_refs.queue_fingerprints`
4. 恢复 `RuntimeSessionState`
5. 恢复 `title / summary / todos / runtime counters / loaded_skill_ids / workflow_state_digest`
6. 若存在 `latest_agent_checkpoint_ref`，加载对应 agent checkpoint 并附着
7. 发出 `thread_checkpoint_restored` 事件
8. 再决定是否继续当前 phase 流程或降级重启 phase

队列一致性规则：

- queue fingerprint 匹配：恢复 runtime state，继续执行
- queue fingerprint 不匹配：只恢复可安全复用的 runtime state，不回写 queue，不重放实体副本，必要时重新进入当前 phase

## 接口/类型定义

### `ThreadCheckpointManager`

建议定义在 `backend/app/services/agent/runtime/checkpoints/manager.py`：

```python
class ThreadCheckpointManager:
    async def save_envelope(self, envelope: ThreadCheckpointEnvelope) -> str: ...
    async def load_latest(self, *, task_id: str, thread_id: str) -> ThreadCheckpointEnvelope | None: ...
    async def list_for_task(self, *, task_id: str) -> list[dict]: ...
    async def restore_runtime_state(self, *, task_id: str, thread_id: str) -> dict: ...
```

### `ThreadCheckpointSerializer`

建议定义在 `backend/app/services/agent/runtime/checkpoints/serializer.py`，职责包括：

- 从 `AgentRuntimeSession` 读取 thread snapshot
- 从 `WorkflowState` 生成 `workflow_state_digest`
- 对 `workflow_refs` 做白名单校验
- 阻止 finding/risk/todo 实体副本进入 envelope

### `ThreadCheckpointRecovery`

建议定义在 `backend/app/services/agent/runtime/checkpoints/recovery.py`，职责包括：

- thread-first / agent-second 的恢复顺序
- queue fingerprint 校验
- mismatch 时的降级恢复策略
- runtime event 发射

## 本 phase 必改文件

- 新增 `backend/app/services/agent/runtime/checkpoints/manager.py`
- 新增 `backend/app/services/agent/runtime/checkpoints/serializer.py`
- 新增 `backend/app/services/agent/runtime/checkpoints/recovery.py`
- 改造 `backend/app/services/agent/core/persistence.py`
  - 继续承担 agent checkpoint 角色，但新增 thread checkpoint ref 辅助方法
- 改造 `backend/app/services/agent/config.py`
  - 新增 thread checkpoint 相关策略配置，保留 legacy checkpoint 配置兼容
- 改造 `backend/app/services/agent/runtime/session.py`
  - 暴露 thread envelope 所需 session 快照视图
- 改造 `backend/app/services/agent/workflow/engine.py`
  - 在 phase 边界和 finalization 前触发保存
- 改造 `backend/app/services/agent/workflow/parallel_executor.py`
  - 在 worker 完成、结果归并后触发保存
- 改造 `backend/app/models/agent_task.py`
  - 新增 `AgentThreadCheckpoint` ORM 模型
- 新增 Alembic migration
- 改造 `backend/app/api/v1/endpoints/agent_tasks_routes_results.py`
  - 新增 thread checkpoint 查询接口，不混改现有 agent checkpoint 接口

## 兼容桥接

- `AgentStatePersistence` 文件存储和 `AgentCheckpoint` 数据库存储继续可单独工作。
- thread checkpoint 不替换 `AgentCheckpoint`，而是引用它。
- 旧的 `/agent-tasks/{task_id}/checkpoints` 保持 agent checkpoint-only，避免现有消费者被混合 schema 破坏。
- 恢复失败时可以降级为仅使用 agent checkpoint 或重新启动当前 phase，而不是破坏 queue 真相源。

## 迁移顺序

1. 定义 `agent_thread_checkpoints` 数据模型与 Alembic migration。
2. 实现 serializer、manager、recovery 三件套。
3. 让 `AgentRuntimeSession` 导出 thread checkpoint 所需快照。
4. 在 `WorkflowEngine` phase 边界接入保存。
5. 在 `ParallelPhaseExecutor` worker 归并点接入保存。
6. 在 `AgentRuntimeSession` history compaction 后接入保存。
7. 最后把恢复入口挂到 orchestrator/workflow 启动前的 thread restore gate。

## 测试入口

### 新增测试

- `test_thread_checkpoint_save_restore_roundtrip`
- `test_thread_checkpoint_restores_loaded_skills_and_counters`
- `test_thread_checkpoint_persists_workflow_state_digest_including_bl_counters`
- `test_thread_checkpoint_never_rewrites_queue_truth`
- `test_thread_checkpoint_attaches_latest_agent_checkpoint_ref`
- `test_thread_checkpoint_restore_emits_stable_event`
- `test_thread_checkpoint_api_is_separate_from_agent_checkpoint_api`
- `test_queue_fingerprint_mismatch_restores_runtime_without_rewriting_entities`

### 复用现有测试资产

- `backend/tests/test_agent_task_terminal_finalization.py`
  - 验证 checkpoint 引入后不会破坏任务终态收敛。
- `backend/tests/test_parallel_executor.py`
  - 验证 worker 完成点新增 checkpoint 后不会破坏并发结果归并。
- `backend/tests/test_tool_catalog_memory_sync.py`
  - 后续可扩展用于验证恢复后 skill 快照与 runtime state 一致。

## 禁止的半成品

- 新增了 thread checkpoint 表，但实际只存一份 agent state 副本。
- 把现有 `/agent-tasks/{task_id}/checkpoints` 直接改成 agent + thread checkpoint 混合列表，却没有清楚区分 schema。
- 恢复时直接用 checkpoint 覆盖 queue 中的 finding/risk/todo 实体。
- 只保存 host 主链路状态，遗漏 `WorkflowState` 的 BL 轨道计数和 worker refs。
- 只有保存逻辑，没有稳定恢复顺序和恢复事件。
- `latest_agent_checkpoint_ref` 存在，但不会真正附着恢复。
- 保存点触发到每次 tool 调用，导致 checkpoint 噪音泛滥。
