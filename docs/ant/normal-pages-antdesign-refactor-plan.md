# 普通页面 Ant Design 重构规划（排除 Nexus 页面）

## 1. 目标与范围

**目标**
- 将主前端普通业务页面重构为 Ant Design 风格。
- 保留明暗两种主题（`light` / `dark`）。
- 不改变后端接口与核心业务语义（`Project`、`AgentTask`、静态/智能/混合扫描流程）。

**明确排除（不在本次范围）**
- `nexus-web` 页面及其服务。
- `nexus-itemDetail` 页面及其服务。
- `/nexus/`、`/nexus-item-detail/` 的构建与部署链路。

---

## 2. 页面分组（仅普通页面）

基于 `frontend/src/app/routes.tsx`，本次重构覆盖以下普通页面：

1. 首页与任务详情外壳
   - `/`（AgentAudit 首页外层）
   - `/agent-audit/:taskId`
2. 仪表盘与项目域
   - `/dashboard`、`/dashboard/mock-preview`
   - `/projects`、`/projects/:id`、`/projects/:id/code-browser`
3. 任务管理与结果页
   - `/tasks/static`、`/tasks/intelligent`、`/tasks/hybrid`
   - `/static-analysis/:taskId`
   - `/finding-detail/:source/:taskId/:findingId`
   - `/static-analysis/:taskId/findings/:findingId`
4. 配置与管理页
   - `/scan-config/engines`
   - `/scan-config/intelligent-engine`
   - `/scan-config/external-tools`
   - `/scan-config/external-tools/:toolType/:toolId`
   - `/data-management`

---

## 3. 总体方案

采用“**设计系统先行 + 页面分批迁移**”策略：

1. 先建立 Ant Design 全局底座（主题、布局、组件规范）。
2. 再按页面域逐步替换旧 UI（优先高频页面）。
3. 最后做统一视觉收口与回归。

迁移期间允许 Tailwind 与 Ant Design 并存，但新增页面优先使用 Ant 组件，不再新增自定义视觉体系。

---

## 4. Ant Design 设计规范

### 4.1 主题规范（必须）

- 主题模式：`light`、`dark`。
- 通过 `ConfigProvider` + `theme.algorithm` 切换：
  - 亮色：`theme.defaultAlgorithm`
  - 暗色：`theme.darkAlgorithm`
- 建议统一 token：
  - `colorPrimary: #1677ff`
  - `borderRadius: 8`
  - `fontSize: 14`

### 4.2 组件选型规范

| 场景 | Ant Design 组件 |
|---|---|
| 页面框架 | `Layout`、`Grid`、`Flex` |
| 导航切换 | `Menu`、`Tabs`、`Segmented`、`Breadcrumb` |
| 列表表格 | `Table`、`List`、`Card`、`Descriptions`、`Tag`、`Badge` |
| 筛选表单 | `Form`、`Input`、`Select`、`DatePicker`、`Switch` |
| 反馈状态 | `Spin`、`Skeleton`、`Result`、`Alert`、`Empty` |
| 弹层交互 | `Drawer`、`Modal`、`Popover`、`Tooltip` |

---

## 5. 分阶段实施清单

## Phase 0：基础设施
- [ ] 引入 Ant Design 依赖并建立全局 `ConfigProvider`（普通页面生效）。
- [ ] 建立统一页面骨架（侧边栏、头部、内容区、面包屑规范）。
- [ ] 定义浅色/深色 token 映射表，保证主题切换可复用。

## Phase 1：高频入口页
- [ ] 重构任务管理页（`/tasks/static`、`/tasks/intelligent`、`/tasks/hybrid`）。
- [ ] 重构项目管理页（`/projects`）与项目详情页除 Nexus iframe 区域外的普通内容。
- [ ] 统一搜索、筛选、分页、状态 Tag 的视觉风格与交互。

## Phase 2：结果与详情页
- [ ] 重构静态分析结果页与漏洞详情页。
- [ ] 重构 Agent 任务详情页中的普通列表/卡片/日志展示容器（不改 Nexus 服务）。
- [ ] 统一空态、加载态、失败态组件。

## Phase 3：配置与管理页
- [ ] 重构扫描配置三个页面与外部工具详情页。
- [ ] 重构数据管理页。
- [ ] 统一表单校验、按钮层级、危险操作确认模式。

## Phase 4：收口与回归
- [ ] 清理重复样式与废弃 UI 组件封装。
- [ ] 补齐页面级测试（快照/结构断言/关键交互）。
- [ ] 完成 light/dark 双主题走查并修复对比度问题。

---

## 6. 预期改动文件（参考）

| 文件/目录 | 变更类型 | 说明 |
|---|---|---|
| `frontend/src/app/**` | 修改 | 全局主题与布局底座 |
| `frontend/src/pages/**`（普通页面） | 大量修改 | 页面组件 Ant 化 |
| `frontend/src/components/**` | 修改/新增 | 通用 Ant 封装组件 |
| `frontend/src/features/**` | 修改 | 列表、筛选、状态展示组件迁移 |
| `frontend/tests/**` | 修改 | 对应 UI 结构与交互测试更新 |
| `nexus-web/**` | **不改** | 明确排除 |
| `nexus-itemDetail/**` | **不改** | 明确排除 |

---

## 7. 验收标准（DoD）

1. 普通页面完成 Ant Design 重构，视觉一致性明显提升。
2. 明暗主题切换在普通页面完整生效，无明显样式错乱。
3. 关键高频流程（任务管理、项目管理、结果查看、配置修改）无功能回退。
4. Nexus 页面服务与部署链路保持不变，可继续正常嵌入访问。

---

## 8. 风险与应对

- **风险：迁移期间 UI 风格混用导致页面割裂。**  
  应对：先做全局 token 与通用组件，页面按域批量迁移，避免零散替换。

- **风险：深色主题下可读性不足。**  
  应对：统一走 token 调优，不在页面散落硬编码颜色。

- **风险：重构范围过大影响节奏。**  
  应对：按“任务页 -> 项目页 -> 结果页 -> 配置页”分批交付，每批可独立回归。
