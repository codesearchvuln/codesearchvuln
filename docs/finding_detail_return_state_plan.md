# 漏洞详情返回分页状态保留改造规划（2026-04-17）

## 1. 问题背景

现象：从列表页进入 `统一漏洞详情` 后点击“返回”，经常回到第一页，导致用户需要重新翻页定位。

当前链路依赖 `returnTo` 参数回跳（`appendReturnTo` + `resolveFindingDetailBackTarget`），但“列表状态是否在 URL 中”不一致：

- 已做 URL 同步的页面：可回跳，但仍有“点击详情瞬间 URL 尚未刷新”的窗口期风险。
- 未做 URL 同步的页面：分页状态仅在内存中，离开页面后必然丢失，回跳默认第一页。

---

## 2. 现状定位（代码位点）

- 回跳工具：`frontend/src/shared/utils/findingRoute.ts`
- 详情页返回：`frontend/src/pages/FindingDetail.tsx`
- 静态扫描详情列表（已有 URL 同步）：`frontend/src/pages/StaticAnalysis.tsx`
- 项目详情-潜在漏洞表（当前未持久化分页）：`frontend/src/pages/project-detail/components/ProjectPotentialVulnerabilitiesSection.tsx`
- DataTable URL 序列化工具：`frontend/src/components/data-table/urlState.ts`

核心根因：

1. `ProjectPotentialVulnerabilitiesSection` 使用 `defaultState`（非受控），没有将分页/筛选/排序写回 URL。  
2. `currentRoute` 来自 `location.search`，如果点击详情时状态尚未落盘到 URL，`returnTo` 可能不含最新页码。

---

## 3. 目标与非目标

## 3.1 目标

1. 从漏洞详情返回时，恢复到跳转前列表页码（至少分页，推荐包含筛选/排序/搜索）。
2. 与现有 `returnTo` 机制兼容，不破坏外部 deep link。
3. 只做前端改造，不修改后端接口。

## 3.2 非目标

- 不在本次改造中重构所有列表页，只优先覆盖“进入漏洞详情”的关键入口。
- 不引入全局状态库（如 Redux）来解决该问题。

---

## 4. 方案设计

## 4.1 总体策略：列表状态 URL 化 + 回跳路径统一从 URL 构造

统一原则：**“能进入漏洞详情的列表，其表格状态必须可序列化到 URL”**。  
这样 `returnTo` 天然携带状态，详情页无需感知业务表格细节。

## 4.2 具体方案

### A. 给 DataTable URL 状态工具增加命名空间能力

在 `frontend/src/components/data-table/urlState.ts` 增加 prefix 版本（或 options 参数）：

- `parseDataTableUrlState(params, { prefix })`
- `serializeDataTableUrlState(state, { prefix })`
- `mergeDataTableUrlState(params, state, { prefix })`

用途：同一页面存在多个表格时避免参数冲突。  
建议前缀：

- 项目潜在漏洞表：`pv_`（如 `pv_page`, `pv_pageSize`, `pv_sort`...）

### B. 项目潜在漏洞表改为受控状态并同步 URL

改造位置：

- `frontend/src/pages/ProjectDetail.tsx`
- `frontend/src/pages/project-detail/components/ProjectPotentialVulnerabilitiesSection.tsx`

改造点：

1. 在 `ProjectDetail` 维护 `potentialTableState`（`DataTableQueryState`）。
2. 初始值从 URL（`pv_` 前缀）解析；状态变更后 `replace` 写回 URL。
3. `ProjectPotentialVulnerabilitiesSection` 从 `defaultState` 改为 `state + onStateChange` 受控模式。
4. “详情”链接继续走 `appendReturnTo(row.route, currentRoute)`，但此时 `currentRoute` 已包含 `pv_*` 状态。

### C. 静态扫描详情页补一层“无窗口期”保护

改造位置：

- `frontend/src/pages/StaticAnalysis.tsx`
- `frontend/src/pages/static-analysis/StaticAnalysisFindingsTable.tsx`

改造点：

1. 不直接使用 `location.pathname + location.search` 作为 `currentRoute`。
2. 基于“当前 `tableState` + 当前非表格查询参数”构造 return route（即时值），用于详情链接。
3. 避免“页码刚切换、URL 还未 replace、立即点详情”导致的回跳丢页。

---

## 5. 实施步骤（建议）

### Phase 1：基础能力

1. 扩展 `urlState.ts` 支持 prefix。
2. 为 prefix 逻辑补单元测试。

### Phase 2：项目潜在漏洞表落地

1. `ProjectDetail` 接管潜在漏洞表状态（初始化/同步 URL）。
2. `ProjectPotentialVulnerabilitiesSection` 改为受控表格。
3. 验证进入详情 -> 返回可恢复页码、筛选、排序。

### Phase 3：静态扫描详情链路兜底

1. 详情链接改为基于即时 `tableState` 计算 `returnTo`。
2. 回归测试“快速切页后立即点详情”的场景。

---

## 6. 测试计划

## 6.1 单元测试

- `frontend/tests/findingRoute.test.ts`
  - 增加回跳路径带命名空间参数的断言。
- `frontend/tests/projectDetailPotentialVulnerabilitiesSection.test.tsx`
  - 增加 `returnTo` 包含 `pv_page/pv_pageSize` 的断言。
- 新增 `frontend/tests/dataTableUrlStatePrefix.test.ts`
  - 验证 prefix 序列化/反序列化/merge。

## 6.2 交互回归（手测）

1. 项目详情潜在漏洞表切到第 N 页 -> 进入漏洞详情 -> 返回，应回到第 N 页。
2. 同场景叠加筛选/排序/搜索，返回后状态保持。
3. 静态扫描详情页快速切页后立即点详情，返回仍在目标页。

---

## 7. 风险与对策

- 风险：URL 参数变长。  
  对策：仅保留必要状态字段（优先分页+筛选+排序），并使用 `replace` 减少历史污染。

- 风险：多表格参数冲突。  
  对策：统一使用 prefix（如 `pv_`）。

- 风险：旧链接不含状态参数。  
  对策：无状态参数时回退默认第一页，保持向后兼容。

---

## 8. 验收标准（DoD）

1. “漏洞详情 -> 返回”不再固定回到第一页。  
2. 至少在 `ProjectPotentialVulnerabilitiesSection` 与 `StaticAnalysis` 两条主链路稳定复现恢复状态。  
3. 相关单元测试通过，且不影响现有 `returnTo` 回跳逻辑。

