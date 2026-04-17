# 静态扫描详情页分页查询改造规划（2026-04-17）

## 1. 背景

`静态扫描详情` 页面当前打开慢，核心原因不是单次 SQL 慢，而是前端首屏会把多引擎结果“全量拉取 + 本地聚合 + 本地分页”后再渲染。

当前相关实现位置：

- 前端页面：`frontend/src/pages/StaticAnalysis.tsx`
- 数据加载：`frontend/src/pages/static-analysis/useStaticAnalysisData.ts`
- 统一行模型：`frontend/src/pages/static-analysis/viewModel.ts`
- 表格组件：`frontend/src/pages/static-analysis/StaticAnalysisFindingsTable.tsx`
- 各引擎 findings 接口：`backend/app/api/v1/endpoints/static_tasks_*.py`

---

## 2. 现状问题定位

### 2.1 详情页首屏会全量读取 findings

`useStaticAnalysisData.ts` 中的 `fetchAll*Findings` 会循环调用 `skip/limit` 直到读完（每引擎 batch=200，最多 500 页），然后一次性 `setState`。

影响：

- 首屏等待时间随漏洞量线性增长。
- 多引擎并发时，网络请求数量和 payload 体积过大。
- 前端内存占用高（统一数组 + DataTable 过滤/排序副本）。

### 2.2 表格是“本地分页”，不是真正后端分页

`StaticAnalysisFindingsTable.tsx` 使用 `DataTable` 的本地分页，意味着必须先拿到全量数据才能正确分页、筛选、排序。

### 2.3 后端已有分页参数，但缺统一聚合分页能力

各引擎接口（opengrep/gitleaks/bandit/phpstan/yasa/pmd）支持 `skip/limit`，但返回结构是 `List[...]`，没有统一 `total`，且没有跨引擎聚合查询能力。

---

## 3. 改造目标

1. 静态扫描详情页首屏改为“只请求当前页数据”。
2. 前端不再全量拉取 findings；分页、筛选、排序在后端执行。
3. 保持现有功能体验：
   - 多引擎统一列表；
   - 规则/路径/状态/危害/置信度筛选；
   - 状态更新（判真/判假）；
   - URL 状态可回放（页码、筛选、排序）。
4. 与现有详情跳转链路兼容（`finding detail` 链路不变）。

---

## 4. 方案选型

### 方案 A（不推荐）：前端继续聚合，仅降低预取量

- 做法：首屏每引擎只拉 N 条，翻页再增量补拉。
- 问题：跨引擎全局排序/筛选不准确，逻辑复杂且边界多。

### 方案 B（推荐）：新增“后端统一分页接口”

- 做法：后端返回统一 `items + total + page + page_size`，前端按表格查询状态请求当前页。
- 优点：语义清晰，性能和一致性最好，后续可扩展导出/批处理。

本次采用 **方案 B**。

---

## 5. 详细设计

## 5.1 后端接口设计（新增）

建议新增路由（挂在 `static-tasks` 体系下）：

- `GET /api/v1/static-tasks/findings/unified`

建议查询参数：

- 任务范围：
  - `opengrep_task_id?`
  - `gitleaks_task_id?`
  - `bandit_task_id?`
  - `phpstan_task_id?`
  - `yasa_task_id?`
  - `pmd_task_id?`
- 分页：
  - `page`（默认 1）
  - `page_size`（默认 20，建议上限 100）
- 筛选：
  - `engine?`
  - `status?`
  - `severity?`
  - `confidence?`
  - `keyword?`（规则名/文件路径）
- 排序：
  - `sort_by`（`severity|confidence|file_path|line|created_at`）
  - `sort_order`（`asc|desc`）

建议响应结构：

```json
{
  "items": [
    {
      "engine": "opengrep",
      "id": "finding_id",
      "task_id": "task_id",
      "rule": "xxx",
      "file_path": "a/b/c.py",
      "line": 120,
      "severity": "HIGH",
      "confidence": "MEDIUM",
      "status": "open"
    }
  ],
  "total": 1234,
  "page": 1,
  "page_size": 20
}
```

## 5.2 后端实现建议

1. 新增统一查询模块（建议文件）：
   - `backend/app/api/v1/endpoints/static_tasks_unified_findings.py`
2. 每引擎构造同构子查询（`UNION ALL`）输出统一列：
   - `engine, finding_id, task_id, rule, file_path, line, severity_norm, confidence_norm, status, created_at`
3. 在统一层做：
   - where 过滤；
   - total count；
   - order by；
   - offset/limit。
4. 返回统一 DTO（Pydantic response model），并在 `static_tasks.py` 注册路由。

备注：

- Opengrep 的 confidence 目前来自规则映射，统一查询层需要保持与现有页面口径一致（无法映射时回退 `MEDIUM`）。
- 排序默认保持当前页面语义：`severity desc -> confidence desc -> file_path asc -> line asc -> id asc`。

## 5.3 前端改造建议

1. 新增统一 API 客户端：
   - `frontend/src/shared/api/staticUnifiedFindings.ts`
2. 改造 `useStaticAnalysisData.ts`：
   - 保留 task 信息加载；
   - 移除 `fetchAll*Findings` 全量拉取；
   - 新增 `loadUnifiedFindings(queryState)`，按页拉取并返回 `items/total`。
3. 改造 `StaticAnalysis.tsx`：
   - 将 `tableState`（分页/筛选/排序）映射为后端查询参数；
   - 查询状态变化时请求当前页；
   - 切页仅触发分页请求，不再重刷全量数据。
4. 改造 `StaticAnalysisFindingsTable.tsx`：
   - 接收服务端 `total`；
   - 使用受控分页信息展示总量。
5. 状态更新逻辑保持：
   - `update*FindingStatus` 成功后刷新当前页（或做当前页局部乐观更新）。

## 5.4 DataTable 组件能力补齐

当前 `DataTable` 主要为本地模式。需要补充一项能力（二选一）：

1. 扩展 `DataTable` 支持“服务端模式”（manual pagination/filter/sort）；或
2. 静态扫描页面暂用轻量封装层，手动驱动分页控件。

建议选 1，避免后续其它页面重复造轮子。

---

## 6. 分阶段实施计划

### Phase 1：后端统一分页接口

- 新增 unified findings endpoint + schema。
- 单元测试覆盖分页/筛选/排序/total。

### Phase 2：前端接入统一分页

- 接入统一 endpoint；
- 移除全量 `fetchAll*Findings`；
- 保持 URL 状态回放。

### Phase 3：清理与收敛

- 删除不再使用的全量拉取逻辑；
- 补充文档与回归测试；
- 观察线上性能指标并调优 page_size 默认值。

---

## 7. 测试计划

## 7.1 后端

- 新增：`backend/tests/test_static_unified_findings_pagination.py`
- 覆盖点：
  - 多引擎联合查询 total 正确；
  - 不同筛选组合结果正确；
  - 排序稳定；
  - `page/page_size` 边界（空页、超页、非法参数）。

## 7.2 前端

- 更新/新增：
  - `frontend/tests/staticAnalysisFindingsTable.test.tsx`
  - `frontend/tests/staticAnalysisTableState.test.ts`
  - 新增 `useStaticAnalysisData` 分页请求测试（验证不再全量循环请求）。
- 覆盖点：
  - 切页发起单次分页请求；
  - 筛选/排序变更重置页码并请求新数据；
  - 判真/判假后当前页数据更新。

---

## 8. 风险与对策

- 风险：跨引擎字段语义差异导致筛选口径不一致。  
  对策：统一层显式做 severity/confidence 归一化，并固化测试样本。

- 风险：Opengrep confidence 映射在 unified 查询中退化。  
  对策：复用现有映射逻辑，缺省值明确为 `MEDIUM`，并增加回归测试。

- 风险：页面状态更新后行移动（排序变化）导致“看起来没刷新”。  
  对策：操作完成后刷新当前页并 toast 提示“列表已按当前排序刷新”。

---

## 9. 验收标准（DoD）

1. 详情页首屏不再等待全量 findings 拉取完成。
2. Network 面板中，进入详情页只看到“当前页”查询请求（无全量循环分页请求）。
3. 分页/筛选/排序行为正确，且与 URL 状态同步。
4. 判真/判假链路可用，无功能回退。
5. 关键回归测试通过。

