# 文件审计实现规划（参考 Chat2Rule，MVP）

## 1. 目标

先不要把“文件审计”做成一套新的独立任务体系，首版只做一个最短闭环：

- 在 `ProjectCodeBrowser` 页面增加“文件审计”入口
- 用户在代码浏览过程中，手动把若干文件加入“风险文件”列表
- 用户确认后，前端直接创建一个 `AgentTask`
- 后端把这些“手动选中的文件”转换成初始风险点 seed
- 任务继续走现有智能审计主链路：`Recon -> Analysis -> Verification -> Report`
- 详情页、任务管理页把这类任务识别为“文件审计”而不是普通智能扫描

一句话概括：

> 先做“代码浏览选文件 + 创建文件审计任务 + 手动风险点种子注入 AgentTask”的 MVP，不新增独立工作流，也不新增复杂会话表。

---

## 2. 为什么不能只复用 `target_files`

当前系统已经有 `AgentTask.target_files`，看起来和“文件审计”很像，但它还不够支撑这次需求。

### 2.1 现状能力

当前 `target_files` 已经有这些效果：

- 工具层会限制可读取文件范围
- 代码结构构建（AST / flow / authz）会按 `target_files` 裁剪
- Recon / Analysis prompt 会感知“部分文件审计模式”
- 详情页阶段进度已经把 `target_files` 非空任务视作文件审计子集

相关位置：

- `backend/app/models/agent_task.py`
- `backend/app/api/v1/endpoints/agent_tasks_routes_tasks.py`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `backend/app/services/agent/tools/file_tool.py`
- `frontend/src/pages/AgentAudit/stageProgress.ts`

### 2.2 不足点

但如果只传 `target_files`，仍有两个关键缺口：

1. **用户手动选择的文件并不会自动成为下游 Analysis 的显式输入**  
   当前 Analysis 的权威输入仍然是 Recon 风险点队列或 bootstrap findings；只有 `target_files` 并不等于“已经产出风险点”。

2. **当前执行层在 `target_files` 全部失效时会回退为全量扫描**  
   这对普通智能扫描是可接受的兜底，但对“文件审计”是错误行为。用户明确选了文件，结果却 silently 变成全仓扫描，会违背产品语义。

所以首版文件审计不能只是“前端把 `target_files` 塞进去”，而应该是：

- `target_files` 负责**约束范围**
- `manual file seeds` 负责**明确把这些文件送入后续 Analysis / Verification 链路**

---

## 3. MVP 范围

### 3.1 要做

- `ProjectCodeBrowser` 增加“文件审计”入口
- 支持在代码浏览时，把当前文件加入“风险文件”列表
- 支持查看、移除、清空已选风险文件
- 点击后创建文件审计任务
- 后端把已选文件转换成手动 seed 风险点并注入工作流
- 继续复用现有 `AgentTask`、SSE、详情页、Analysis、Verification、报告链路
- 任务管理页 / 详情页能识别并展示“文件审计”

### 3.2 先不做

- 不做独立的“文件审计任务创建页面”
- 不做新的数据库表（如 file_audit_sessions / file_audit_seeds）
- 不做文件级批注、备注、标签系统
- 不做 snippet 级 risk point（首版先只到文件级）
- 不做代码浏览器外的全局文件批量勾选弹窗
- 不做与静态扫描结果的混合 seed 合流 UI
- 不做历史风险文件模板 / 收藏夹

---

## 4. 交互流程

首版推荐交互如下：

1. 用户进入 `ProjectCodeBrowser`
2. 用户浏览代码，切换到某个文件
3. 在右侧预览区点击“添加当前文件为风险点”
4. 页面下方出现“已选风险文件栏”
5. 用户继续浏览并添加多个文件
6. 点击顶部“开始文件审计”按钮
7. 弹出确认对话框，展示：
   - 项目名
   - 已选文件列表
   - 文件数
   - 审计说明（基于智能审计继续 Analysis / Verification）
8. 用户确认后，前端创建 `AgentTask`
9. 后端将这些文件转换为初始 seed 风险点，注入工作流
10. 页面跳转到 `/agent-audit/:taskId`
11. 后续流程继续走 `Recon -> Analysis -> Verification -> Report`

这里的关键不是“跳过 Recon”，而是：

- **先把用户手动标记的文件变成初始 seed**
- **再允许现有流程继续补充上下文、分析和验证**

这样既不破坏现有工作流，也能保证用户指定文件一定进入下游。

---

## 5. 前端方案

## 5.1 总体原则

参考 Chat2Rule 的接入方式，首版仍然放在 `ProjectCodeBrowser` 内完成闭环，不单开新页面。

Chat2Rule 当前模式是：

- 在代码浏览页面收集上下文
- 在页面内部维护选择状态
- 点击入口后再打开具体动作弹窗

文件审计也建议采用同样思路：

- 在代码浏览页面维护“已选风险文件”状态
- 在当前页面完成增删改查
- 最后通过确认弹窗创建任务

### 5.2 推荐入口与组件拆分

建议改动：

- `frontend/src/pages/ProjectCodeBrowser.tsx`
  - 增加文件审计状态
  - 增加“添加当前文件为风险点”按钮
  - 增加“开始文件审计”按钮
  - 增加“已选风险文件栏”
- 新增 API 封装（如仅复用 `createAgentTask`，不必新增独立文件）
- 新增确认弹窗组件，例如：
  - `frontend/src/pages/file-audit/FileAuditStartDialog.tsx`

### 5.3 为什么首版不做树节点 checkbox

代码树和搜索结果里直接加 checkbox 虽然更“完整”，但首版实现成本更高：

- 目录树节点要处理展开/折叠/点击选中文件/勾选文件三种交互冲突
- 搜索结果也要同步勾选状态
- 需要处理同一路径在 tree / search / preview 三处状态一致性

首版更稳妥的方案是：

- 用户先像现在一样浏览文件
- 在预览区点击“添加当前文件为风险点”

这与 Chat2Rule 的“添加当前片段”一致，学习成本最低，后续再补 tree/search 快捷勾选即可。

### 5.4 页面状态设计

建议新增最少状态：

- `selectedAuditFiles: string[]`
- `isFileAuditDialogOpen: boolean`
- `creatingFileAudit: boolean`

首版不需要额外引入全局 store，继续在 `ProjectCodeBrowser.tsx` 组件内维护即可。

### 5.5 UI 建议

#### 顶部操作区

在当前顶部按钮区，新增：

- `开始文件审计`

与现有 `对话生成规则` 并列，但两者是不同流程：

- Chat2Rule 面向“规则生成”
- File Audit 面向“安全审计任务创建”

#### 预览区操作

在当前“添加当前片段”区域旁，新增类似按钮：

- `添加当前文件为风险点`

按钮行为：

- 若当前没有选中文件，则禁用
- 若当前文件已在列表中，则按钮显示“已添加”或点击后 toast 提示

#### 已选列表

新增一个与 `ProjectCodeBrowserSelectedSnippetsPanel` 类似的列表，例如：

- `ProjectCodeBrowserSelectedAuditFilesPanel`

支持：

- 展示文件路径
- 定位回文件
- 移除单个文件
- 清空全部

首版不必支持排序；如果实现顺手，也可以保留“顺序即优先级”的能力，但不是 MVP 硬要求。

### 5.6 创建任务的前端 payload

建议直接复用 `createAgentTask(...)`，但扩展 `audit_scope` 类型定义：

```ts
{
  project_id: project.id,
  name: `文件审计-${project.name}`,
  description: `${FILE_AUDIT_TASK_NAME_MARKER}文件审计任务`,
  target_files: selectedAuditFiles,
  audit_scope: {
    static_bootstrap: {
      mode: "disabled",
      opengrep_enabled: false,
      bandit_enabled: false,
      gitleaks_enabled: false,
      phpstan_enabled: false,
      yasa_enabled: false,
      yasa_language: "auto",
    },
    manual_file_bootstrap: {
      mode: "selected_files",
      source: "code_browser",
      selected_files: selectedAuditFiles,
    },
  },
  use_prompt_skills: true,
  verification_level: "analysis_with_poc_plan",
}
```

建议新增 marker 常量：

- `FILE_AUDIT_TASK_NAME_MARKER = "[FILE_AUDIT]"`

相关文件：

- `frontend/src/shared/api/agentTasks.ts`
- `frontend/src/features/tasks/services/taskActivities.ts`
- `frontend/src/components/scan/CreateProjectScanDialog.tsx`（如需统一 marker 常量来源）
- `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`
- `backend/app/services/project_metrics.py`
- `backend/app/api/v1/endpoints/projects_shared.py`

### 5.7 前端展示层改造

除了创建任务，还建议同步改三处识别逻辑：

1. 任务管理页 sourceMode 识别
2. 详情页标题 / 文案识别
3. 项目统计口径识别

当前很多地方只有：

- `hybrid`
- `intelligent`

首版建议补成：

- `hybrid`
- `file`
- `intelligent`

否则文件审计虽然能创建成功，但在任务栏仍会被展示成普通智能扫描。

---

## 6. 后端方案

## 6.1 总体原则

后端首版也不要新建独立任务模型，继续复用：

- `AgentTask`
- `audit_scope`
- `target_files`
- 现有工作流引擎

核心只补一层“手动文件 seed bootstrap”：

- 用户选中的文件先进入 seed 阶段
- 然后继续跑现有智能审计主流程

### 6.2 推荐建模方式

首版建议在 `audit_scope` 中增加一个轻量配置块：

```json
{
  "manual_file_bootstrap": {
    "mode": "selected_files",
    "source": "code_browser",
    "selected_files": [
      "src/auth/login.py",
      "src/payment/callback.py"
    ]
  }
}
```

这样有几个好处：

- 不需要数据库迁移，`audit_scope` 本来就是 JSON
- 不需要新增请求 schema 字段，后端已接受 `dict`
- 可以和现有 `static_bootstrap` 并列，语义一致
- 后续如果要支持“从 finding 发起文件审计”“从搜索结果发起文件审计”，只需扩展 `source`

### 6.3 推荐新增 helper

建议在 `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py` 增加：

1. `_resolve_manual_file_bootstrap_config(task)`
   - 解析 `audit_scope.manual_file_bootstrap`
   - 归一化 `mode`
   - 合并 / 校验 `selected_files`
   - 在必要时回退到 `task.target_files`

2. `_build_manual_file_seed_findings(...)`
   - 把文件路径转成初始风险点列表
   - 返回结构化 seed findings

### 6.4 seed finding 推荐结构

每个手动文件 seed 可以先做成“文件级候选风险点”：

```json
{
  "title": "用户标记高风险文件",
  "description": "用户在代码浏览器中手动选择该文件作为风险点，请优先做文件级深度审计。",
  "file_path": "src/auth/login.py",
  "line_start": 1,
  "line_end": 1,
  "severity": "medium",
  "confidence": 0.95,
  "vulnerability_type": "manual_file_audit",
  "source": "manual_file_bootstrap",
  "needs_verification": true,
  "target_files": ["src/auth/login.py"]
}
```

这里故意不伪造具体漏洞类型，只表达：

- 这是一个**人工指定的高优先级审计入口**
- 真正漏洞结论仍然由 Analysis / Verification 产出

### 6.5 为什么 seed 到 Recon 队列，而不是直接跳 Analysis

首版有两种实现方向：

#### 方案 A：直接跳过 Recon，把文件 seed 直接送 Analysis

优点：

- 理论上更直接

缺点：

- 需要改更多流程判断
- 会和现有 `Recon -> Analysis` 队列语义不一致
- 任务详情阶段展示也更难统一

#### 方案 B：仍保留 Recon 阶段，但先把手动文件 seed 注入队列

优点：

- 与现有 hybrid bootstrap 更一致
- 不需要打断工作流主顺序
- 详情页阶段口径不变
- Recon 仍可补充上下文 / entrypoint / related symbols

**首版建议选方案 B。**

### 6.6 工作流引擎建议改法

当前 `WorkflowEngine.run(...)` 只会在 hybrid 场景下注入 `bootstrap_findings`。首版建议不要单独再造一套 file-audit 分支，而是把“初始 seeds”泛化。

建议从：

- `bootstrap_findings`（静态预扫候选）

扩展到：

- `initial_seed_findings = static_bootstrap_findings + manual_file_seed_findings`

也就是说，工作流关心的是“有没有初始 seed”，而不是“这个 seed 一定来自静态扫描”。

可选实现方式：

1. 在执行层计算：
   - `bootstrap_findings`
   - `manual_file_seed_findings`
2. 合并成：
   - `initial_seed_findings`
   - `initial_seed_count`
3. `WorkflowEngine.run(...)` 优先根据 `initial_seed_findings` 注入 Recon 队列
4. `source` 字段保留来源：
   - `opengrep_bootstrap`
   - `bandit_bootstrap`
   - `manual_file_bootstrap`

这样后续日志、调试、统计都更容易统一。

### 6.7 执行层关键改造点

建议关注：

- `backend/app/api/v1/endpoints/agent_tasks_routes_tasks.py`
  - 创建任务时保留 `manual_file_bootstrap`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
  - 项目根目录准备后，对 `selected_files` 做路径归一化与存在性校验
  - 构造 `manual_file_seed_findings`
  - 写入 runtime config
- `backend/app/services/agent/workflow/engine.py`
  - 将 manual seed 注入 Recon 队列

### 6.8 文件不存在时的处理策略

这是首版必须明确的产品语义。

当前普通智能扫描里，如果 `target_files` 全部失效，会自动回退到全量扫描。文件审计模式不能这样做。

建议规则：

- **全部文件失效**：任务直接失败，明确提示“文件审计目标文件不存在或已失效”
- **部分文件失效**：告警 + 继续扫描剩余有效文件
- **路径可自动修正**：沿用现有修正逻辑，并发事件提示

否则用户在代码浏览器明明选了 3 个文件，最后后台跑成全仓扫描，体验会非常混乱。

### 6.9 prompt 建议小修

当前 Recon prompt 在 `target_files` 模式下仍写着：

- 重点分析指定文件
- 发现并标记所有高风险区域（不限于目标文件）

这更像“范围缩小的智能扫描”，不完全像“文件审计”。

首版建议对 `manual_file_bootstrap` 模式追加更明确指令：

- 用户已明确指定这些文件为高优先级审计入口
- 优先围绕这些文件建立证据链
- 不需要扩展到全仓做开放式探索
- 如需补上下文，只能在与这些文件直接相关的近邻代码内扩展

这样更符合文件审计的用户预期。

---

## 7. 前后端接口与模式识别建议

## 7.1 前端类型定义

建议在 `frontend/src/shared/api/agentTasks.ts` 扩展：

```ts
export interface AgentManualFileBootstrapScope {
  mode?: "selected_files" | "disabled";
  source?: "code_browser" | string;
  selected_files?: string[];
}

export interface AgentAuditScope extends Record<string, unknown> {
  static_bootstrap?: AgentStaticBootstrapScope;
  manual_file_bootstrap?: AgentManualFileBootstrapScope;
}
```

## 7.2 模式识别

建议新增统一 marker：

- `FILE_AUDIT_TASK_NAME_MARKER = "[FILE_AUDIT]"`

并改造以下解析函数：

- `frontend/src/features/tasks/services/taskActivities.ts`
- `frontend/src/pages/AgentAudit/stageProgress.ts`
- `backend/app/services/project_metrics.py`
- `backend/app/api/v1/endpoints/projects_shared.py`
- `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`

推荐解析优先级：

1. `FILE_AUDIT_TASK_NAME_MARKER`
2. `HYBRID_TASK_NAME_MARKER`
3. `INTELLIGENT_TASK_NAME_MARKER`
4. 历史兼容兜底

虽然 `target_files` 非空也可以辅助判断，但 marker 更稳定，后续不会被“普通智能扫描恰好传了 target_files”干扰。

---

## 8. 需要改动的文件

### 前端

- `frontend/src/pages/ProjectCodeBrowser.tsx`
  - 增加文件审计状态
  - 增加“添加当前文件为风险点”按钮
  - 增加“开始文件审计”按钮
  - 增加“已选风险文件栏”
- `frontend/src/pages/file-audit/FileAuditStartDialog.tsx`
  - 新增确认弹窗
- `frontend/src/shared/api/agentTasks.ts`
  - 扩展 `audit_scope` 类型
- `frontend/src/features/tasks/services/taskActivities.ts`
  - 增加 file audit marker / sourceMode 识别
- `frontend/src/pages/AgentAudit/stageProgress.ts`
  - 明确 file mode 识别优先级

### 后端

- `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`
  - 增加 `manual_file_bootstrap` 解析与 seed 构造 helper
- `backend/app/api/v1/endpoints/agent_tasks_routes_tasks.py`
  - 创建任务时保留与校验配置
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
  - 准备项目根目录后归一化 selected files
  - 构造 manual file seed findings
- `backend/app/services/agent/workflow/engine.py`
  - 支持注入 manual seeds / unified initial seeds
- `backend/app/services/agent/agents/recon.py`
  - 根据文件审计模式调整提示语
- `backend/app/services/project_metrics.py`
  - 文件审计任务模式识别
- `backend/app/api/v1/endpoints/projects_shared.py`
  - 项目维度聚合口径识别

---

## 9. 实施步骤

### Phase 1：前端收集文件

- 在 `ProjectCodeBrowser` 增加“添加当前文件为风险点”按钮
- 增加“已选风险文件栏”
- 增加“开始文件审计”按钮与确认弹窗
- 能在页面内完成添加 / 删除 / 清空 / 跳转

### Phase 2：创建文件审计任务

- 定义 `FILE_AUDIT_TASK_NAME_MARKER`
- 前端创建 `AgentTask`
- 将已选文件同时写入：
  - `target_files`
  - `audit_scope.manual_file_bootstrap.selected_files`

### Phase 3：后端 seed 注入

- 解析 `manual_file_bootstrap`
- 在执行层归一化文件路径
- 构造 `manual_file_seed_findings`
- 注入工作流初始 seed 队列

### Phase 4：任务展示口径补齐

- 任务列表显示“文件审计”
- 详情页顶部口径识别稳定
- 项目聚合统计不把文件审计误判成普通智能扫描或混合扫描

### Phase 5：测试与收口

- 补前端选择与任务创建测试
- 补后端 seed 注入与失效路径测试
- 补模式识别测试

---

## 10. 测试建议

### 10.1 前端测试

建议新增：

- `ProjectCodeBrowser` 文件选择交互测试
  - 添加当前文件
  - 重复添加去重
  - 移除 / 清空
- 文件审计创建 payload 测试
  - `target_files`
  - `audit_scope.manual_file_bootstrap.selected_files`
  - marker 正确
- 任务管理页 mode 识别测试
  - file audit 不再显示成 intelligent / hybrid

### 10.2 后端测试

建议新增：

1. `test_resolve_manual_file_bootstrap_config_normalizes_selected_files`
2. `test_build_manual_file_seed_findings_from_selected_files`
3. `test_agent_task_execution_file_audit_fails_when_all_selected_files_missing`
4. `test_agent_task_execution_file_audit_keeps_valid_subset_when_partial_missing`
5. `test_workflow_engine_seeds_manual_file_bootstrap_findings_before_recon`
6. `test_project_metrics_recognizes_file_audit_marker`

### 10.3 回归点

重点回归：

- 普通智能扫描不受影响
- 混合扫描 bootstrap 不受影响
- `target_files` 的老用法不回退
- 详情页阶段进度不回退

---

## 11. 验收标准

做到下面几点，就可以认为首版完成：

- 用户能在 `ProjectCodeBrowser` 中把当前文件加入风险文件列表
- 用户能查看并管理已选风险文件
- 用户能从代码浏览页直接发起“文件审计”任务
- 前端创建的任务 payload 包含 `target_files + manual_file_bootstrap`
- 后端会把已选文件转换成 seed 风险点并进入现有工作流
- 任务后续能进入 Analysis / Verification，而不是只停留在 Recon
- 文件失效时不会 silently 回退成全量扫描
- 任务管理页 / 详情页能识别“文件审计”

---

## 12. 风险与注意事项

### 风险 1：只做 `target_files`，Analysis 仍然吃不到手动文件

规避：

- 必须补 `manual file seeds`
- 不能把“范围约束”误当成“风险点注入”

### 风险 2：文件不存在时错误回退成全仓扫描

规避：

- 文件审计模式下改成 fail-fast 或部分继续
- 禁止 silently full scan fallback

### 风险 3：模式识别继续依赖历史 hybrid/intelligent 逻辑，导致任务栏文案错误

规避：

- 补 `FILE_AUDIT_TASK_NAME_MARKER`
- 前后端统一解析优先级

### 风险 4：首版把 tree/search checkbox 一起做，导致页面复杂度陡增

规避：

- 首版只做“添加当前文件”
- 后续再扩展 tree/search 快捷勾选

### 风险 5：手动文件 seed 太粗，只给 `line_start = 1`

规避：

- 明确它只是“人工优先审计入口”，不是最终漏洞点
- Analysis 需要结合 `quick_audit`、`get_file_outline`、`get_code_window` 继续细化

---

## 13. 后续扩展方向

等首版跑通后，再考虑：

- 在 tree / search 结果中直接多选文件
- 支持“选中代码片段直接发起文件审计”
- 支持给每个风险文件添加备注 / 风险原因
- 支持从静态 finding 一键加入文件审计
- 支持文件审计模板 / 最近使用列表
- 支持文件级优先级排序
- 支持“文件审计 + Chat2Rule”联动

当前不建议把这些内容一起塞进 MVP。
