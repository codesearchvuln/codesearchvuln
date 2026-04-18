# 前端扫描详情阶段进度改造规划（2026-04-17）

## 0. 后续增补（实时队列计数）

智能/混合扫描详情页的“事件日志”标题行已补充实时队列计数展示：

- 风险队列：`recon / blrecon`
- 漏洞队列：`finding / blfinding`
- 结果队列：`current_size`（已验证但尚未生成漏洞报告）

实现链路：

- 后端：`GET /api/v1/agent-tasks/{taskId}/progress` 新增 `queue_overview` 与 `result_queue` 统计，并在 `analysis_queue` 中补充 `finding_current_size` / `blfinding_current_size`。
- 前端：`frontend/src/pages/AgentAudit/TaskDetailPage.tsx` 轮询 progress 接口并实时渲染。

## 1. 背景

当前智能扫描 / 混合扫描详情页顶部仍使用“百分比进度”表达任务推进情况，但这套百分比并不是来自真实 workflow 阶段，而是前端基于运行时长做的估算。

当前相关实现位置：

- 详情页入口：`frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- 顶部统计卡片：`frontend/src/pages/AgentAudit/components/StatsPanel.tsx`
- 详情页统计汇总：`frontend/src/pages/AgentAudit/detailViewModel.ts`
- 百分比估算：`frontend/src/features/tasks/services/taskProgress.ts`
- 任务阶段标签：`frontend/src/pages/AgentAudit/constants.tsx`
- 阶段归一化：`frontend/src/pages/AgentAudit/localization.ts`
- 流式事件：`frontend/src/shared/api/agentStream.ts`
- 混合扫描内嵌静态预扫：`backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`

结合现有文档，当前产品心智应当是：

- 文件审计 / 智能扫描：`侦查 -> 分析 -> 验证 -> 完成`
- 混合扫描：`静态扫描 -> 侦查 -> 分析 -> 验证 -> 完成`

这和现在的“35%、47%、63%”并不一致，尤其是混合扫描最关键的“静态预扫”阶段目前在前端不可见。

---

## 2. 当前问题

### 2.1 百分比不是实际业务阶段

`detailViewModel.ts` 当前通过 `getEstimatedTaskProgressPercent(...)` 生成 `summary.progressPercent`，而这个函数只看：

- `status`
- `created_at`
- `started_at`

它并不知道：

- 当前是不是还在 bootstrap
- 当前是不是已经进入 Analysis
- 当前是不是已经完成 Verification、只是在收尾 report

所以它更像“时间型占位进度”，不是“阶段型真实进度”。

### 2.2 混合扫描的静态预扫阶段没有产品级可见性

后端混合扫描会先进入 embedded static bootstrap，并持续发出带 `metadata.bootstrap = true` 的事件，例如：

- `OpenGrep 内嵌预扫开始`
- `Bandit 内嵌预扫开始`
- `内嵌静态预扫完成`

但前端详情页当前没有把这段流程提升成独立阶段，只能在日志里零散看到信息。

### 2.3 文件审计 / 智能扫描 / 混合扫描的详情页缺少统一口径

从任务模型上看，文件审计本质上仍是 `AgentTask + target_files` 的智能扫描子集；智能扫描和混合扫描也都统一落在 `AgentTask` 上。

因此详情页展示层应该有一套统一的“阶段进度视图”，而不是：

- 一部分地方显示百分比
- 一部分地方显示 `current_phase`
- 混合扫描的 bootstrap 还要靠读日志自行理解

### 2.4 当前内部 phase 与用户要看的阶段不是一一对应关系

后端当前真实 phase 仍然是：

- `planning`
- `indexing`
- `reconnaissance`
- `analysis`
- `verification`
- `reporting`

但用户想看的是更粗粒度的产品阶段：

- `侦查`
- `分析`
- `验证`
- `完成`
- 混合扫描额外增加 `静态扫描`

也就是说，这次改造不是简单把 label 文案改一下，而是要做一层“内部 phase -> 产品阶段”的前端映射。

---

## 3. 改造目标

1. 智能扫描 / 文件审计详情页，把顶部百分比进度改成四段式阶段进度：`侦查 -> 分析 -> 验证 -> 完成`。
2. 混合扫描详情页，把顶部百分比进度改成五段式阶段进度：`静态扫描 -> 侦查 -> 分析 -> 验证 -> 完成`。
3. 阶段状态要能同时覆盖：
   - 历史回放打开详情页
   - SSE 实时推进
   - 任务终态（completed / failed / cancelled / interrupted）
4. 运行中阶段必须和真实 workflow 一一对应；若现有字段不足，则允许补充响应字段，但不要求新增数据库列。
5. 保持现有日志列表、findings 面板、导出功能不回退。
6. 任务管理页运行中任务不再显示百分比，而显示同口径阶段标签。

---

## 4. 范围与非目标

## 4.1 本轮范围

本轮覆盖两类前端展示：

- 扫描详情页的阶段进度表达
- 任务管理页运行中任务的阶段标签表达

重点文件包括：

- `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`
- `frontend/src/pages/AgentAudit/detailViewModel.ts`
- `frontend/src/features/tasks/components/TaskActivitiesListTable.tsx`
- `frontend/src/features/tasks/services/taskActivities.ts`

## 4.2 明确不在本轮处理

以下内容先不纳入这次改造：

- 后端 `AgentTask.progress_percentage` 的字段定义与计算
- 静态扫描详情页自己的百分比卡片
- workflow 真正新增 `static_bootstrap` phase 枚举

换句话说，本轮是 **详情页 + 任务管理页展示层重构**；允许补充 API 响应字段，但不引入新的持久化 phase 列。

---

## 5. 方案总览

### 5.1 新的展示真相源

详情页新增一层“阶段进度派生模型”，作为产品展示真相源：

- 输入：`task + historical events + realtime events + bootstrap metadata`
- 输出：`StageProgressSummary`

建议新增独立 helper，例如：

- `frontend/src/pages/AgentAudit/stageProgress.ts`

避免把阶段判断规则继续散落在：

- `TaskDetailPage.tsx`
- `StatsPanel.tsx`
- `localization.ts`

### 5.1.1 现有接口可行性分析

实际排查后，原接口链路存在两个问题：

1. `task.current_phase` 在进入 `orchestrator.run(...)` 前就被提前写成了 `analysis`，因此真实还在 Recon 时，前端拿到的却已经是 `analysis`。
2. 任务列表接口只有 `current_phase/current_step`，没有稳定暴露运行中的真实 workflow phase；detail 页还能结合日志兜底，但列表页做不到稳定一比一。

因此本轮结论是：

- **仅复用原始 `current_phase` 不足以保证一比一对应。**
- 需要两步一起做：
  - 后端把 `current_phase/current_step` 改成跟随 workflow 实时同步；
  - 任务响应补充只读字段：
    - `workflow_phase`：后端真实 workflow phase
    - `display_phase`：后端归一后的产品阶段

这样详情页和任务列表都可以直接消费同一口径，而不是各自猜测。

### 5.2 展示阶段定义

建议统一阶段 key：

- `static_scan`
- `recon`
- `analysis`
- `verification`
- `complete`

其中：

- 文件审计 / 智能扫描只使用：`recon -> analysis -> verification -> complete`
- 混合扫描使用完整五段：`static_scan -> recon -> analysis -> verification -> complete`

### 5.3 阶段状态定义

每个阶段建议统一三态或四态：

- `pending`：尚未到达
- `active`：当前阶段
- `completed`：已经走完
- `failed`：任务在该阶段终止（仅当前阶段需要）

这样就能覆盖：

- 运行中任务
- 失败 / 取消 / 中断任务
- 历史任务回放

---

## 6. 阶段映射设计

## 6.1 智能扫描 / 文件审计映射

| 后端状态 / 事件 | 前端展示阶段 |
| --- | --- |
| `planning` | `侦查` |
| `indexing` | `侦查` |
| `reconnaissance` | `侦查` |
| `analysis` | `分析` |
| `verification` | `验证` |
| `reporting` | `完成`（收尾中） |
| `completed` | `完成` |
| `failed/cancelled/interrupted` | 当前活动阶段标记为失败 |

这里最关键的决策是：

- `planning/indexing` 不单独向用户暴露，而是折叠进第一段 `侦查`
- `reporting` 不再独立展示，而是折叠进最后一段 `完成`

这样可以和用户提出的四阶段口径保持一致。

## 6.2 混合扫描映射

混合扫描不能只看 `task.current_phase`，因为后端在 bootstrap 前后都可能仍停留在：

- `reconnaissance`

因此混合扫描必须额外结合 bootstrap 事件元数据判断。

建议规则：

1. 如果任务是 hybrid，且已经观察到 bootstrap 开始/进行中的事件，但还没有观察到“内嵌静态预扫完成”，则当前阶段为 `静态扫描`。
2. 如果任务是 hybrid，且已经观察到 bootstrap 完成事件，再根据 `current_phase` 决定是否进入 `侦查 / 分析 / 验证 / 完成`。
3. 如果是历史老任务，缺少 bootstrap 事件，则降级为直接从 `侦查` 开始展示。

建议识别的 bootstrap 事件信号：

- `metadata.bootstrap === true`
- `metadata.bootstrap_source` 以 `embedded_` 开头
- `message` 包含：
  - `内嵌静态预扫开始`
  - `OpenGrep 内嵌预扫开始`
  - `Bandit 内嵌预扫开始`
  - `Gitleaks 内嵌预扫开始`
  - `PHPStan 内嵌预扫开始`
  - `YASA 内嵌预扫开始`
  - `内嵌静态预扫完成`

## 6.3 `完成` 阶段的特殊处理

用户要看的最后一步是“完成”，但真实运行里 `reporting` 仍然是未结束状态。

因此建议把 `完成` 分成两种展示文案：

- `active`：`完成（收尾中）`
- `completed`：`已完成`

这样既不额外增加“报告”阶段，又不会让用户误解“已经完成但其实还没结束”。

---

## 7. 前端数据模型建议

建议新增类型：

```ts
export type AgentDisplayStageKey =
  | "static_scan"
  | "recon"
  | "analysis"
  | "verification"
  | "complete";

export type AgentDisplayStageStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed";

export interface AgentDisplayStageItem {
  key: AgentDisplayStageKey;
  label: string;
  status: AgentDisplayStageStatus;
  description?: string | null;
}

export interface AgentDisplayStageSummary {
  mode: "file" | "intelligent" | "hybrid";
  currentStageKey: AgentDisplayStageKey | null;
  stages: AgentDisplayStageItem[];
  headline: string;
  hint?: string | null;
}
```

额外建议派生一份 bootstrap 摘要，方便混合扫描在“静态扫描”阶段展示更有解释力的提示：

```ts
export interface HybridBootstrapProgressSnapshot {
  started: boolean;
  completed: boolean;
  source?: string | null;
  totalFindings?: number | null;
  candidateCount?: number | null;
  enginesStarted?: string[];
}
```

---

## 8. UI 改造建议

## 8.1 顶部统计卡片替换为阶段 Stepper

当前 `StatsPanel.tsx` 里第二张卡片是：

- 标题：`进度比例`
- 内容：`xx%`
- 展示：细进度条

建议改成：

- 标题：`当前进度`
- 内容：阶段 Stepper
- 主文案：当前阶段，例如 `分析` / `静态扫描` / `完成（收尾中）`
- 次文案：`task.current_step` 或 bootstrap 摘要

建议交互：

- 已完成阶段：高亮 + 对勾
- 当前阶段：高亮 + 呼吸动画 / 脉冲点
- 未开始阶段：弱化
- 失败阶段：当前阶段标红

## 8.1.1 阶段前彩色圆点规范

这次实现里，每个阶段标签前都应带一个稳定的彩色圆点，颜色本身就是阶段识别的一部分，不能只靠文字。

建议固定配色如下：

- `静态扫描`：天蓝色圆点
- `侦查`：青绿色圆点
- `分析`：琥珀色圆点
- `验证`：翠绿色圆点
- `完成`：紫罗兰色圆点

状态上的处理建议如下：

- `pending`：保留原阶段颜色，但降透明度显示
- `active`：原色圆点 + 轻微脉冲动画
- `completed`：原色圆点 + 阶段容器高亮
- `failed`：保留该阶段主色，但外层容器切换为失败态红色边框/底色

实现要求：

- 彩色圆点必须始终出现在阶段文案前面，而不是只在 hover 或 active 时显示
- 同一个阶段在不同任务模式下颜色保持不变，避免用户重新学习
- 混合扫描比智能扫描多出的仅是 `静态扫描` 这一段，不改变后四段颜色
- 颜色是辅助识别，不应替代当前阶段文案和状态文案

## 8.2 混合扫描的静态扫描阶段补充摘要

混合扫描在 `静态扫描` 阶段，可以在当前阶段下方展示简短摘要，例如：

- `已启动引擎：OpenGrep / Bandit / Gitleaks`
- `候选：12 / 命中：84`
- `静态预扫完成，已生成 12 条候选`

这些信息都可以从现有 bootstrap event metadata 派生，无需额外后端字段。

## 8.3 Header 的 phaseHint 保持，但口径统一

当前 Header 已接收：

- `phaseLabel`
- `phaseHint`

本轮建议：

- Header 继续保留“当前阶段：xxx”这种简短摘要
- 具体 stepper 视觉放在 `StatsPanel`
- Header 和 StatsPanel 都使用同一份 `StageProgressSummary`，避免一处显示 `分析`、另一处还显示 `47%`

---

## 9. 实现拆分建议

### Phase 1：抽离阶段派生逻辑

新增：

- `frontend/src/pages/AgentAudit/stageProgress.ts`

职责：

1. 识别详情页模式：文件审计 / 智能扫描 / 混合扫描
2. 从历史事件 + 实时事件中提取 bootstrap 进度快照
3. 将 `task.current_phase` / `task.status` 映射为产品阶段
4. 输出 `AgentDisplayStageSummary`

### Phase 2：改造详情页统计区

修改：

- `frontend/src/pages/AgentAudit/detailViewModel.ts`
- `frontend/src/pages/AgentAudit/components/StatsPanel.tsx`
- `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`

动作：

1. 从 `statsSummary` 中移除“必须依赖百分比进度”的展示假设
2. 将 `StatsPanel` 接口改为接收 `stageSummary`
3. 替换 `进度比例` 卡片为 stepper 卡片

### Phase 3：清理旧百分比依赖

动作：

- 详情页不再显示 `summary.progressPercent`
- `detailViewModel.ts` 中 `progressPercent` 可先保留给其他未改页面使用，但 `AgentAudit` 详情页不再消费
- 如果后续没有其他消费者，再考虑删掉 `AgentAuditStatsSummary.progressPercent`

---

## 10. 风险与对策

### 风险 1：历史任务没有完整 bootstrap 事件

现象：老任务可能只有 `current_phase`，没有完整的 `metadata.bootstrap` 事件。

对策：

- hybrid 任务若缺少 bootstrap 事件，降级为直接从 `侦查` 开始展示
- 不因为缺少历史事件阻塞页面渲染

### 风险 2：`reporting` 被折叠进 `完成` 后，用户误以为已经完全结束

对策：

- 运行中且 phase=`reporting` 时，文案明确写成 `完成（收尾中）`
- 只有 `task.status === completed` 才展示 `已完成`

### 风险 3：realtime stream 重连期间丢失 bootstrap 阶段状态

对策：

- 详情页保持“先加载历史事件，再连接 SSE”的现有策略
- `stageProgress.ts` 以“历史事件 + 实时事件合并结果”派生阶段，不只依赖最后一条 stream event

### 风险 4：文件审计模式识别口径不稳定

对策：

- v1 不强行新增独立 route / model
- 先按“`target_files` 非空且非 hybrid 时，展示四阶段智能扫描模型”处理
- 若后续产品要把“文件审计”作为独立模式命名，再补文案层改造

---

## 11. 测试建议

## 11.1 单元测试

建议新增：

- `frontend/src/pages/AgentAudit/stageProgress.test.ts`

覆盖场景：

1. 智能扫描：`planning -> indexing -> reconnaissance` 都映射到 `侦查`
2. 智能扫描：`analysis` 映射到 `分析`
3. 智能扫描：`verification` 映射到 `验证`
4. 智能扫描：`reporting` 映射到 `完成（收尾中）`
5. 混合扫描：bootstrap 进行中时显示 `静态扫描`
6. 混合扫描：bootstrap 完成后进入 `侦查`
7. hybrid 老任务缺少 bootstrap 事件时降级为 `侦查`
8. failed / cancelled / interrupted 时，当前阶段标记为失败

## 11.2 组件测试

建议补充：

- `frontend/src/pages/AgentAudit/components/StatsPanel.test.tsx`

覆盖点：

- 四阶段 stepper 渲染正确
- 五阶段 stepper 渲染正确
- 当前阶段样式正确
- 终态样式正确

## 11.3 手工回归

至少验证以下场景：

1. 普通智能扫描运行中，阶段从 `侦查 -> 分析 -> 验证 -> 完成（收尾中）` 正常推进
2. 混合扫描运行中，先看到 `静态扫描`，完成后再进入 `侦查`
3. 混合扫描静态预扫命中为 0 时，也能正确从 `静态扫描` 进入 `侦查`
4. 已完成历史任务打开详情页时，stepper 状态正确回放
5. 失败任务打开详情页时，失败落在正确阶段

---

## 12. 文档联动建议

本轮先把规划文档落在 `docs/progress`，代码落地时再同步更新以下文档：

### `docs/todo.md`

建议把这条任务补上文档链接，例如：

- `前端文件/智能/混合扫描日志详情展示进度 ...（规划见 docs/progress/agent-detail-stage-progress-plan.md）`

### `docs/architecture.md`

建议在“结果如何回到前端”或“智能扫描详情页”相关位置补一句：

- 智能扫描 / 混合扫描详情页使用产品阶段进度，而不是时间估算百分比

### `docs/glossary.md`

建议补充一个展示层术语，避免后续文档再混用：

- `展示阶段（display stage）`
  - 是什么：前端把内部 phase 折叠后的产品级进度阶段
  - 不是什么：后端 workflow 的真实 phase 枚举

---

## 13. 验收标准（DoD）

1. 智能扫描 / 文件审计详情页不再显示百分比进度条，而显示四阶段 stepper。
2. 混合扫描详情页不再显示百分比进度条，而显示五阶段 stepper，且首段为 `静态扫描`。
3. `planning/indexing/reconnaissance/analysis/verification/reporting` 能稳定映射到产品阶段。
4. 历史任务回放与实时 SSE 推进的阶段表现一致。
5. 缺少 bootstrap 历史事件时，hybrid 任务有可接受的降级行为，不出现空白阶段。
6. 现有 findings、日志、导出链路无功能回退。
