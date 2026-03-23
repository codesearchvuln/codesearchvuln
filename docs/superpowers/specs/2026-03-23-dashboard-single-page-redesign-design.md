# Dashboard Single-Page Redesign Design

**Goal**

将真实 `/dashboard` 重构为单页指挥中心布局，复用已确认的 mock 交互结构，并通过扩展 `/projects/dashboard-snapshot` 提供统一后端数据，避免前端多接口拼接导致的统计口径分裂。

**Scope**

- 前端真实仪表盘重构为单页布局
- 后端仪表盘快照接口扩展
- 新增任务最近 5 条、累计 token、项目风险分级统计、漏洞类型 Top10、静态引擎规则统计、语言代码行数 Top10
- 保持现有 `/dashboard` 路由不变

**Architecture**

真实仪表盘继续以 `Dashboard.tsx` 作为页面入口，数据层仍通过 `dashboardSnapshotStore` 拉取 `/projects/dashboard-snapshot`。后端扩展快照响应结构，把顶部卡片、趋势图、各类横向条状图、任务状态面板所需字段统一返回。前端在 `DashboardCommandCenter.tsx` 内引入一个面向展示的 view model 映射层，将 live snapshot 映射为与 mock 画布一致的结构，从而实现“样式层稳定、数据层可演进”。

**Key UI Decisions**

- 顶部仅展示 5 张统计卡片，不再包裹透明背景板
- 主体区域为左侧统计图切换边栏 + 中部主图 + 右侧任务状态
- 主图默认展示漏洞态势趋势，其他视图均为水平横向条状统计图
- 横纵坐标说明左对齐，图例右对齐
- 最近任务展示最近创建的 5 条，包含任务类型、执行进度、查看详情按钮

**Data Contract Changes**

扩展 `DashboardSnapshotResponse`，新增：

- `summary.total_model_tokens`
- `recent_tasks`
- `project_risk_distribution`
- `verified_vulnerability_types`
- `static_engine_rule_totals`
- `language_loc_distribution`

同时扩展：

- `engine_breakdown` 纳入 `yasa` 与 `llm`
- 任务状态统计不展示 `pending`

**Testing Strategy**

- 后端先补快照接口测试，验证新增字段与排序逻辑
- 前端补真实仪表盘渲染测试，确保单页结构和关键文案由 live snapshot 驱动
- 最后运行前端 `type-check` 与相关测试，后端运行 dashboard snapshot 测试
