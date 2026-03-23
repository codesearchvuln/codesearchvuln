# Dashboard Single-Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展真实仪表盘快照接口，并将 `/dashboard` 重构为基于 live 数据的单页指挥中心。

**Architecture:** 先通过后端快照接口补齐统计字段和任务摘要，再同步更新前端类型、store 与单页展示组件。前端保留页面入口与数据刷新机制，但将展示层统一改为 mock 方案验证过的布局和图表结构。

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TypeScript, Recharts, Vitest/node test

---

### Task 1: 扩展后端 dashboard snapshot 数据契约

**Files:**
- Modify: `backend/app/api/v1/endpoints/projects_shared.py`
- Modify: `backend/app/api/v1/endpoints/projects_insights.py`
- Test: `backend/tests/test_dashboard_snapshot_v2.py`

- [ ] **Step 1: 写后端失败测试**
- [ ] **Step 2: 运行 dashboard snapshot 测试并确认因缺少新字段失败**
- [ ] **Step 3: 扩展 Pydantic 响应模型与聚合逻辑**
- [ ] **Step 4: 重新运行后端测试并确认通过**

### Task 2: 更新前端 dashboard 类型与数据访问层

**Files:**
- Modify: `frontend/src/shared/types/index.ts`
- Modify: `frontend/src/shared/api/database.ts`
- Modify: `frontend/src/features/dashboard/services/dashboardSnapshotStore.ts`

- [ ] **Step 1: 写前端针对 live snapshot 新字段的失败测试或渲染断言**
- [ ] **Step 2: 运行前端测试确认失败**
- [ ] **Step 3: 更新类型与数据映射**
- [ ] **Step 4: 重新运行测试确认通过**

### Task 3: 重构真实 DashboardCommandCenter 为单页布局

**Files:**
- Modify: `frontend/src/features/dashboard/components/DashboardCommandCenter.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Test: `frontend/tests/dashboardLiveDashboard.test.tsx`

- [ ] **Step 1: 写真实仪表盘单页布局失败测试**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 实现单页边栏、趋势图、横向条状图和任务状态面板**
- [ ] **Step 4: 重新运行测试确认通过**

### Task 4: 完成联调与验证

**Files:**
- Modify: `frontend/src/features/dashboard/components/DashboardPageState.tsx`（如需要）

- [ ] **Step 1: 运行后端 dashboard snapshot 测试**
- [ ] **Step 2: 运行前端 dashboard 相关测试**
- [ ] **Step 3: 运行前端 `pnpm type-check`**
- [ ] **Step 4: 检查需求清单，确认新统计图、任务列表、token 卡片和单页布局全部落地**
