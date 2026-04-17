# 扫描详情与任务栏漏洞统计不一致修复规划

## 问题定义

现象：

- 混合/智能扫描详情页已经能看到漏洞列表，甚至顶部卡片已经显示出漏洞数量。
- 任务管理页同一条任务的“缺陷摘要”仍然显示 `严重 0 / 高危 0 / 中危 0 / 低危 0`。

这不是单点的前端展示问题，而是 **Verification 阶段产出 -> 持久化 -> AgentTask 汇总字段** 这一段链路没有在运行中及时同步。

## 当前链路分析

### 1. 扫描详情页为什么能先看到漏洞

详情页的数据来源并不完全依赖 `agent_tasks` 表上的汇总字段：

- `frontend/src/pages/AgentAudit/TaskDetailPage.tsx` 会把实时事件、已落库 findings、本地状态合并展示。
- `frontend/src/pages/AgentAudit/detailViewModel.ts` 会根据 findings 列表重新计算 `findings_count / verified_count / defect_summary`。

也就是说，只要 Verification 阶段已经把 finding 保存下来，详情页就能先“看见”漏洞。

### 2. 任务栏为什么还是 0

任务管理页的“缺陷摘要”直接取 `AgentTask` 上的聚合字段：

- `frontend/src/features/tasks/services/taskActivities.ts`
  - `getAgentTaskDefectSummaryStats()` 只读 `critical_count / high_count / medium_count / low_count / findings_count`
- `backend/app/api/v1/endpoints/agent_tasks_routes_tasks.py`
  - `list_agent_tasks()` 返回的是 `AgentTaskResponse`
- `backend/app/api/v1/endpoints/agent_tasks_access.py`
  - `build_agent_task_response()` 直接把 `AgentTask` 的统计字段序列化出去

因此，只要 `agent_tasks` 表上的计数没更新，任务栏就一定还是 0。

### 3. Verification 阶段真正的断点在哪里

Verification 阶段里，finding 的保存路径是通的，但 **任务汇总没有跟着刷新**：

1. `backend/app/services/agent/workflow/engine.py`
   - `_run_verification_phase()` 跑完整个验证队列
   - `_sync_verification_tool_buffer_to_db()` 会在阶段结束后再补一次持久化
2. `backend/app/api/v1/endpoints/agent_tasks_execution.py`
   - `_persist_findings_callback()` 调 `_save_findings()` 真正写入 `AgentFinding`
3. `backend/app/api/v1/endpoints/agent_tasks_findings.py`
   - `_save_findings()` 已经能把 Verification finding 落到库里
4. 但 `AgentTask.findings_count / critical_count / high_count / medium_count / low_count` 主要是在
   `backend/app/api/v1/endpoints/agent_tasks_execution.py` 的任务收尾阶段统一计算

结果就是：

- 运行中：详情页基于实时/已落库 findings 能看到漏洞
- 运行中：任务栏仍读旧的 `AgentTask` 汇总字段，所以显示 0
- 任务结束后：大概率才会被最终收尾逻辑补齐

## 结论

你的判断方向是对的：问题确实出在 Verification 这一段。

但更准确地说，这不是 `engine.py` 里“验证没跑到”的问题，而是：

**Verification 已经产出并持久化了 finding，但没有把增量结果同步回 AgentTask 汇总字段。**

`engine.py` 需要参与补偿，但主修复点应该落在 **Verification 持久化回调和任务统计刷新机制**，不能只改前端。

## 次级问题

详情页顶部卡片当前也有误导性命名：

- `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`
  - 标题写的是“已验证漏洞”
  - 实际显示的是 `summary.totalFindings`

而 `summary.totalFindings` 在 `frontend/src/pages/AgentAudit/detailViewModel.ts` 中对应的是有效漏洞总数/当前展示漏洞数，并不等于严格意义上的 `verifiedCount`。

这会放大“详情页有 6 个已验证漏洞，但任务栏是 0”这种错觉。

## 修复目标

1. 运行中的任务，只要 Verification 已经把 finding 持久化，任务栏就能看到非零缺陷摘要。
2. false positive 不进入有效漏洞统计。
3. 最终收尾统计与运行中增量统计口径一致，避免完成前后数字跳变。
4. 详情页与任务栏对“已验证 / 待确认 / 有效漏洞”的文案口径一致。

## 修复方案

### 方案 A：抽一个统一的任务漏洞统计刷新器（主方案）

新增一个共享 helper，例如：

- `backend/app/api/v1/endpoints/agent_tasks_runtime.py`
- 或单独提到 `backend/app/services/agent/task_summary_sync.py`

职责：

- 从 `AgentFinding` 重新计算：
  - `findings_count`
  - `verified_count`
  - `false_positive_count`
  - `critical_count / high_count / medium_count / low_count`
- 统计口径与 `list_agent_tasks()` / `get_agent_task()` / 详情页保持一致
- 支持单任务调用，便于 Verification 阶段增量刷新

建议直接复用/下沉现有逻辑，避免多套实现继续分叉：

- `backend/app/api/v1/endpoints/agent_tasks_routes_results.py:_recompute_task_finding_counters`
- `backend/app/api/v1/endpoints/agent_tasks_routes_tasks.py:_load_defect_summaries`

目标是把“手动改状态”和“Verification 自动保存”统一到同一套计数规则。

### 方案 B：在 Verification 持久化回调后立即刷新 AgentTask（核心落点）

修改：

- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
  - `_persist_findings_callback()`

行为：

1. `_save_findings()` 成功保存后
2. 调用统一统计刷新器
3. 更新 `AgentTask` 汇总字段并提交
4. 仅在本次确实有新增/更新时触发刷新

这样任务管理页下次轮询/刷新任务列表时，就能立刻看到漏洞统计。

建议增加轻量节流，避免高并发验证时每条 finding 都单独重算：

- 例如按 `task_id` 做 1~2 秒 debounce
- 或每累计 N 条保存后刷新一次
- 任务结束前再做一次最终强制刷新

### 方案 C：给 `engine.py` 加 phase-end 补偿钩子（补强，不单独作为主修复）

修改：

- `backend/app/services/agent/workflow/engine.py`

建议点位：

1. `_run_verification_phase()` 结束后
2. `_sync_verification_tool_buffer_to_db()` 成功后

增加一个“任务统计刷新 hook”，由执行层注入，例如：

- `orchestrator._refresh_task_summary_callback`

作用：

- 覆盖 save tool 走缓冲补写、去重补写、phase-end 补写这些路径
- 避免只有逐条 `save_verification_result` 成功时才刷新统计

结论：

- `engine.py` 应该补一个 phase-end 兜底刷新点
- 但主修复仍然必须放在 `agent_tasks_execution.py` 的持久化回调后面

### 方案 D：修正详情页文案，避免误判（前端配套）

修改：

- `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`

二选一：

1. 保持标题“已验证漏洞”，但显示 `summary.verifiedCount`
2. 保持当前数值 `summary.totalFindings`，但把标题改成“有效漏洞”或“漏洞总数”

我更建议第 2 种，因为当前详情列表里明显包含“待确认”项，顶部卡片不应标成“已验证漏洞”。

## 推荐实施顺序

### 第一步：先修后端统计同步

优先改：

- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `backend/app/api/v1/endpoints/agent_tasks_routes_results.py`
- `backend/app/services/agent/workflow/engine.py`

原因：

- 任务栏数据源在后端
- 不先修后端，前端只能继续“各页各算各的”

### 第二步：再修前端文案口径

修改：

- `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`

原因：

- 这是认知层面的修复
- 不影响主链路，但能明显减少误会

## 验收标准

### 场景 1：运行中的混合扫描

预期：

- Verification 已保存 1 条高危 finding 后
- 任务管理页刷新列表
- “缺陷摘要”显示 `高危 1`，不再是全 0

### 场景 2：待确认漏洞

预期：

- 详情页可展示“待确认” finding
- 任务栏应至少反映有效漏洞严重度统计
- 但“已验证”口径不能把待确认算进去

### 场景 3：误报

预期：

- false positive 不计入 `findings_count`
- false positive 不计入严重度摘要
- `false_positive_count` 单独累加

### 场景 4：Verification phase-end 补写

预期：

- 即使某些 finding 只在 `_sync_verification_tool_buffer_to_db()` 阶段补写
- phase-end 之后任务栏统计也能同步到最新值

## 测试建议

后端至少补两类测试：

1. 集成测试：模拟运行中的 task 调用 `save_verification_result`
   - 断言 `AgentFinding` 已落库
   - 断言 `AgentTask` 汇总字段已同步更新
2. 回归测试：模拟 `_sync_verification_tool_buffer_to_db()` 补写路径
   - 断言 phase-end 统计不会漏

前端补一个最小回归：

1. 详情页顶部卡片文案与显示字段一致

## 风险点

1. **频繁重算带来的数据库压力**
   - 需要 debounce / batching
2. **计数口径不一致**
   - 必须统一“有效漏洞”“已验证漏洞”“误报”的定义
3. **运行中与结束态口径不同**
   - 最终收尾逻辑必须复用同一套统计函数，不能再写一份

## 最终建议

如果只允许改一个核心点，我建议先改这里：

- `backend/app/api/v1/endpoints/agent_tasks_execution.py:_persist_findings_callback`

因为这里是 Verification finding 从“结果”进入“任务汇总”的第一落点。

如果要做完整修复，建议组合为：

1. 持久化回调后增量刷新 `AgentTask`
2. `engine.py` phase-end 再做一次兜底刷新
3. 前端把“已验证漏洞”文案改成真实口径

这样才能把“详情页看得到，任务栏看不到”这类问题一次性收敛掉。
