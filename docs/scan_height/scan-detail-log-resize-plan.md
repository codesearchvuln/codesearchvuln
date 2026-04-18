# 扫描详情页日志高度拖动改造规划（2026-04-18）

## 1. 背景

`docs/todo.md` 当前有一项待办：

- [ ] 重构扫描详情页，时间日志改为拖动控制高度

结合现有实现，这里的“扫描详情页”实际对应的是统一的 `AgentTask` 详情页：

- 文件审计
- 智能扫描
- 混合扫描

它们共用前端入口：`frontend/src/pages/AgentAudit/TaskDetailPage.tsx`。

也就是说，这次改造不是只改某一个模式的页面，而是要把 **共享详情页里的事件日志区域** 从“自动计算固定高度”改成“用户可拖动调整高度”。

---

## 2. 当前实现梳理

### 2.1 当前日志区域如何定高

当前详情页里，顶部是：

- 失败原因卡片（可选）
- 统计区 `StatsPanel`

中下部是两块主内容：

- 漏洞列表 `RealtimeFindingsPanel`
- 事件日志 `EventLogVirtualList`

相关实现主要在：

- 页面入口：`frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- 日志虚拟列表：`frontend/src/pages/AgentAudit/components/EventLogVirtualList.tsx`
- 漏洞面板：`frontend/src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx`
- 可复用拖拽组件：`frontend/src/components/ui/resizable.tsx`

当前日志高度由这几个状态 / 常量共同决定：

- `logViewportHeight`
- `LOG_VIEWPORT_DEFAULT_HEIGHT_PX = 200`
- `LOG_VIEWPORT_MIN_HEIGHT_PX = 96`
- `FINDINGS_PANEL_MIN_HEIGHT_PX = 320`
- `syncEventLogsLayout()`

`syncEventLogsLayout()` 会根据页面总高度、统计区高度、失败卡片高度和日志面板 chrome 高度，自动算出日志区应该占多少像素。

### 2.2 当前方案的问题

当前自动定高方案能工作，但它更像“布局兜底”，而不是“用户可控布局”。主要问题有：

1. 用户无法按任务场景调节比例
   - 看长日志时，200px 很容易不够。
   - 看漏洞列表时，又可能觉得日志区占太多。
2. 高度完全由页面重算控制
   - 窗口 resize
   - 失败卡片出现 / 消失
   - 统计区高度变化
   都可能触发 `syncEventLogsLayout()`，用户无法保留自己的阅读偏好。
3. 现有逻辑比较重
   - `TaskDetailPage.tsx` 里有较多和“日志高度计算”相关的 `ResizeObserver`、ref、breakpoint、兜底分支。
4. 现有仓库其实已经有可复用方案
   - `frontend/src/components/ui/resizable.tsx` 已封装了 `react-resizable-panels`
   - 当前详情页却还在手动维护像素高度

### 2.3 当前实现里哪些部分可以直接复用

这次改造不需要推翻整个详情页，以下能力都可以保留：

- 日志流与历史回放逻辑不变
- `EventLogVirtualList` 的虚拟滚动逻辑不变
- 自动滚动开关 `isAutoScroll` 不变
- 漏洞面板自己的 `ResizeObserver` 和分页自适应逻辑不变
- 详情弹窗 / 导出 / SSE / 阶段进度逻辑不变

换句话说，这次主要是 **布局层重构**，不是数据层重构。

---

## 3. 改造目标

### 3.1 本轮目标

1. 扫描详情页中的“事件日志”区域支持拖动调整高度。
2. 文件审计 / 智能扫描 / 混合扫描共用同一套拖动布局。
3. 日志拖动后不影响：
   - 日志虚拟列表
   - 自动滚动
   - 漏洞列表筛选 / 分页
   - 日志导出
4. 用户调整后的高度可以被记住，避免每次打开页面都回到默认值。
5. 小屏场景不要因为引入拖拽而明显损害可用性（首版以稳定优先）。

### 3.2 非目标

以下内容不在本轮处理：

- 后端接口或事件协议改造
- 日志内容结构改造
- 阶段进度展示改造
- 静态扫描详情页（非 `AgentTask` 路由）的布局统一
- 右侧新增第三栏 / 多面板复杂布局

---

## 4. 推荐方案

### 4.1 总体思路

推荐把“漏洞列表 + 事件日志”这一段，改造成一个纵向可拖拽分栏：

- 上半部分：`RealtimeFindingsPanel`
- 下半部分：事件日志区
- 中间：拖拽分隔条

推荐直接复用仓库里现成的：

- `frontend/src/components/ui/resizable.tsx`

而不是继续手写 `mousemove + clientHeight` 方案。原因很明确：

1. 仓库已引入 `react-resizable-panels`
2. 可减少自定义拖拽计算与边界条件
3. 可直接获得更稳定的键盘 / pointer 交互基础能力
4. 布局职责能从 `TaskDetailPage.tsx` 的大量高度计算逻辑中抽离出来

### 4.2 布局形态

建议保持详情页整体结构不变，只替换中下部内容区：

```text
Header
└─ Main Content
   ├─ Failed Banner（可选）
   ├─ StatsPanel
   └─ Vertical Resizable Group
      ├─ Findings Panel
      ├─ Resize Handle
      └─ Event Logs Panel
```

这样改动范围最小，也不会影响顶部固定区。

### 4.3 为什么不建议继续用当前 `syncEventLogsLayout()` 扩展

如果继续在现有逻辑上叠加“拖拽”，会出现两个冲突真相源：

- 真相源 A：用户拖动后的高度
- 真相源 B：`syncEventLogsLayout()` 自动重算后的高度

最终容易出现这些问题：

- 用户刚拖完，窗口 resize 一下又被系统改回去
- 失败卡片展开后把用户高度覆盖掉
- 默认值、最小值、自动重算值三套规则互相打架

因此更合理的方向是：

- 把“自动算日志高度”降级为“默认初始化和边界钳制”
- 把“用户拖动结果”提升为主真相源

---

## 5. 详细设计

### 5.1 组件拆分建议

建议把布局状态从 `TaskDetailPage.tsx` 中抽出来，至少新增一个轻量 helper：

- `frontend/src/pages/AgentAudit/detailSplitLayout.ts`

建议职责：

- 读写持久化布局值
- 计算默认比例
- 做最小 / 最大比例钳制
- 根据容器高度完成 `px <-> ratio` 转换

如果希望进一步降复杂度，也可以再抽一个展示组件：

- `frontend/src/pages/AgentAudit/components/DetailResizablePanels.tsx`

但首版不是必须；首版只拆 helper 也够。

### 5.2 新的状态模型

建议不要再直接保存“日志区像素高度”，而是保存“日志区占内容区的比例”。

建议新增概念：

```ts
export interface AgentAuditSplitLayoutState {
  logsPanelRatio: number; // 0 ~ 1
}
```

原因：

1. 比例比像素更适合持久化
2. 窗口尺寸变化时更容易重算
3. 与 `ResizablePanelGroup` 的布局模型更一致

### 5.3 默认值建议

保留当前视觉默认值作为首开体验：

- 默认日志高度仍以 `200px` 为目标体验
- 但在真正写入分栏时，先把 `200px` 转成当前容器的比例

例如：

- 如果当前可分配高度是 `800px`
- 那默认日志比例约为 `200 / 800 = 25%`

这样既延续旧体验，也不会把旧常量白白丢掉。

### 5.4 边界约束

当前已有两条重要约束：

- 日志最小高度：`LOG_VIEWPORT_MIN_HEIGHT_PX = 96`
- 漏洞面板最小高度：`FINDINGS_PANEL_MIN_HEIGHT_PX = 320`

引入可拖动后，这两条约束仍然要保留，只是实现方式从“像素直接算高”变成“先转百分比，再喂给分栏组件”。

建议逻辑：

1. 先拿到“可分栏总高度”
2. 把两个最小像素值转换成最小比例
3. 对用户保存值做 clamp
4. 如果当前视口过矮，导致两个最小值之和已经超过可分配高度，则进入小屏回退策略

### 5.5 持久化策略

建议把布局偏好写入 `localStorage`，而不是写入 URL：

- 这是用户偏好，不是分享态
- URL 已经承载了详情弹窗与漏洞分页状态
- 继续往 URL 里塞布局参数会让链接噪声变大

建议 key 形态：

- `agent-audit:detail-split-layout:v1:desktop`

如果后续确认不同模式需要不同默认值，再扩展为：

- `agent-audit:detail-split-layout:v1:file`
- `agent-audit:detail-split-layout:v1:intelligent`
- `agent-audit:detail-split-layout:v1:hybrid`

但首版建议先用一个统一 key，避免过度设计。

### 5.6 小屏策略

这里建议明确采用“桌面优先、移动端稳态兜底”的方案。

当前页面已经有：

- `SMALL_SCREEN_SPLIT_BREAKPOINT_PX = 1536`
- `SMALL_SCREEN_SPLIT_HEIGHT_BREAKPOINT_PX = 900`

说明现有页面已经把“小视口”当成单独布局分支处理。

首版建议：

1. 大屏 / 桌面：启用可拖动分栏
2. 小屏：保留现有自动二等分或近似策略，不强推拖动

这样做的原因：

- 风险最小
- 不会把移动端可用性一起拖进本轮范围
- 与现有 breakpoint 逻辑兼容

如果后续验收明确要求触屏拖动，再把小屏也切到统一 `ResizablePanelGroup`。

### 5.7 自动滚动与拖动的关系

现有日志区有自动滚动能力，关键逻辑在：

- `handleLogsScroll`
- `scrollLogsToBottom`
- `persistTaskAutoScroll`

拖动改造时要特别注意：

1. 改变日志面板高度不应自动关闭“自动滚动”
2. 如果当前就是自动滚动开启状态，用户把日志区缩小后，仍应尽量保持底部可见
3. 拖动结束后，如果日志容器高度变化导致当前可视区域离底部变远，建议补一次 `scrollLogsToBottom("auto")`

这样体验会更符合“我正在追实时日志”的预期。

### 5.8 对虚拟列表与漏洞面板的影响

这两块其实是本次改造里最容易复用的部分：

- `EventLogVirtualList` 已经通过 `ResizeObserver` 监听容器高度
- `RealtimeFindingsPanel` 也已经通过 `ResizeObserver` 根据高度重算页大小

因此只要新的分栏容器能够提供稳定的 `height: 100%`，这两个组件大概率无需重写。

本轮重点不是改这两个组件，而是保证：

- 外层 panel 高度变化时，它们拿到的容器尺寸是稳定的
- 外层 wrapper 不要把 `min-h-0` / `overflow-hidden` 链路弄断

---

## 6. 代码改动建议

### 6.1 `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`

这是本轮主改文件，建议做以下调整。

### A. 删减或降级现有自动定高状态

以下状态 / ref / 逻辑建议重构或移除：

- `logViewportHeight`
- `isEventLogsVisible`（大屏场景可能不再需要“算不下就直接隐藏”）
- `eventLogsChromeHeightRef`
- `syncEventLogsLayout()`
- 一部分仅服务于日志像素高度计算的 `ResizeObserver`

注意：

- `detailContentRef` / `statsSectionRef` / `failedReasonRef` 这些 ref 不一定都要删
- 但它们的职责应该回到“页面结构定位”，而不是“持续抢日志区高度控制权”

### B. 引入可拖动分栏

建议把当前这段：

- findings 容器
- event logs 容器

替换成一个纵向 `ResizablePanelGroup`。

首版推荐结构：

```tsx
<ResizablePanelGroup direction="vertical">
  <ResizablePanel>
    <RealtimeFindingsPanel ... />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel>
    {event logs}
  </ResizablePanel>
</ResizablePanelGroup>
```

### C. 把日志列表容器改成 `h-full`

当前日志区在非小屏场景下依赖：

- `style={{ height: logViewportHeight }}`

改造后建议统一改成：

- 外层 panel 控制整体高度
- 内层滚动容器只用 `h-full` / `min-h-0`

这样 `EventLogVirtualList` 与空态容器都可以共享同一套布局语义。

### D. 在布局变更时保留自动滚动体验

建议在 panel layout 变化后做一次轻量处理：

- 如果 `isAutoScroll === true`，则 `requestAnimationFrame(scrollLogsToBottom)`

避免用户拖动后看到“日志突然停在中间”。

### 6.2 `frontend/src/pages/AgentAudit/components/EventLogVirtualList.tsx`

预期只需要确认，不一定要改。

重点确认两点：

1. 父容器高度通过 panel 变化后，`ResizeObserver` 能正确刷新 `viewportHeight`
2. 容器从固定像素高度改成 `h-full` 后，虚拟列表仍能正确计算可见区

如果验证通过，这个文件可以不动。

### 6.3 `frontend/src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx`

同样预期不需要大改。

重点确认：

- panel 高度变化时，当前 `ResizeObserver -> calculateResponsiveFindingsPageSize(...)` 仍能稳定工作
- 页码 / pageSize route sync 不会因为拖动产生抖动

如果拖动过程中 pageSize 变化太频繁导致视觉跳动，可以把 `onLayout` 与分页更新之间再加一个轻量 debounce；但建议先不预设优化，先看真实表现。

### 6.4 `frontend/src/components/ui/resizable.tsx`

这个文件大概率无需修改，直接复用即可。

如果视觉上想让分隔条更符合当前页面风格，可以只加 className 定制，例如：

- hover 高亮
- 行拖拽光标
- 更清晰的 grip

但不建议在这一轮改动它的公共 API。

### 6.5 建议新增 helper 文件

建议新增：

- `frontend/src/pages/AgentAudit/detailSplitLayout.ts`

建议内容：

- `readAgentAuditSplitLayout(storage?)`
- `writeAgentAuditSplitLayout(state, storage?)`
- `clampLogsPanelRatio(input)`
- `resolveDefaultLogsPanelRatio(containerHeight)`
- `resolveSplitConstraints(containerHeight)`

这样可以把布局数学从大页面中剥离，避免 `TaskDetailPage.tsx` 继续膨胀。

---

## 7. 推荐落地步骤

### Phase 1：先把布局能力替换掉

1. 引入 `ResizablePanelGroup`
2. 把 findings / logs 改成可拖动上下分栏
3. 去掉 `style={{ height: logViewportHeight }}` 依赖
4. 保证空日志态和虚拟列表态都能正常铺满 panel

完成标志：

- 大屏下可以拖动日志区高度
- 日志和漏洞面板都不溢出、不塌陷

### Phase 2：补齐持久化与边界约束

1. 新增 `detailSplitLayout.ts`
2. 把默认 `200px` 转为初始比例
3. 按容器高度换算最小 / 最大比例
4. 持久化用户拖动结果到 `localStorage`

完成标志：

- 刷新页面后保留上次日志区高度偏好
- 缩放窗口后比例仍在合理范围内

### Phase 3：联调体验细节

1. 自动滚动开启时，拖动后保持底部日志可见
2. 验证日志导出、详情弹窗、历史回放不回退
3. 校验失败卡片显示 / 隐藏时布局是否稳定
4. 校验文件审计 / 智能扫描 / 混合扫描三种入口

完成标志：

- 拖动逻辑与现有日志工作流兼容
- 无明显布局跳动或状态丢失

### Phase 4：按需要补小屏策略

如果本轮验收需要小屏也支持拖动，再做这一阶段；否则先保留现状。

可选动作：

1. 让小屏也复用同一套分栏组件
2. 调大 handle 触控区域
3. 重新验证页面最小高度边界

---

## 8. 风险与注意点

### 8.1 `react-resizable-panels` 的最小值通常更偏向比例语义

当前页面的约束是像素值：

- 日志区最小 96px
- 漏洞区最小 320px

如果分栏组件使用比例配置，就必须在页面层先完成换算。这个转换逻辑建议统一放进 helper，不要散在 JSX 里。

### 8.2 高度变化会联动漏洞表 pageSize

`RealtimeFindingsPanel` 当前会根据高度自动变更页大小。

这本来是正确行为，但拖动时可能出现：

- findings panel 一边缩放
- table pageSize 一边重算
- 表格行数变化导致感知抖动

建议首版先观察。如果体验不佳，再在 pageSize 更新上做轻量节流。

### 8.3 日志区缩得太小时，虚拟列表与表头可能显得拥挤

虽然已有 `LOG_VIEWPORT_MIN_HEIGHT_PX = 96`，但这个值是在旧布局里定义的。引入拖动后，建议验收时重新确认 96px 是否仍合理。

如果发现日志表头 + 内容在 96px 下过于拥挤，可以把最小值上调到 `120px ~ 144px`。

### 8.4 不要让“失败卡片高度变化”覆盖用户拖动结果

失败卡片是条件渲染的，出现 / 消失会改变可用空间。

正确做法应该是：

- 保持用户 ratio 不变
- 只在越界时 clamp

不应该：

- 因为 banner 高度变了，就把日志区重置回默认高度

---

## 9. 验收清单

### 9.1 功能验收

- [ ] 在智能扫描详情页，大屏下可通过拖拽改变日志区高度
- [ ] 在混合扫描详情页，大屏下可通过拖拽改变日志区高度
- [ ] 在文件审计详情页，大屏下可通过拖拽改变日志区高度
- [ ] 日志为空时，空态区域也能跟随 panel 高度正确撑开
- [ ] 日志非空时，虚拟列表滚动正常
- [ ] 拖动后刷新页面，高度偏好仍保留

### 9.2 兼容性验收

- [ ] 自动滚动开启时，拖动后仍能看到最新日志
- [ ] 自动滚动关闭时，拖动不会强行把用户滚动位置改乱
- [ ] 漏洞表筛选、分页、详情跳转不回退
- [ ] 导出日志功能不受影响
- [ ] 历史已完成任务打开时布局正常
- [ ] 失败任务打开时失败卡片与分栏共存正常

### 9.3 小屏兜底验收

- [ ] 小视口下页面仍可正常查看 findings 与 logs
- [ ] 若首版仍保留自动分屏，小屏行为不回退

---

## 10. 建议的最终落点

如果按“最小风险、最快交付”原则推进，这一项最合适的最终落点是：

1. 详情页顶部结构不动
2. 只把 findings + logs 区域改成纵向 resizable layout
3. 复用 `frontend/src/components/ui/resizable.tsx`
4. 新增 `frontend/src/pages/AgentAudit/detailSplitLayout.ts` 管布局状态
5. 首版先覆盖桌面 / 大屏，保留现有小屏兜底

这样能在不触碰后端、不重写日志列表、不破坏现有详情链路的前提下，把“时间日志改为拖动控制高度”这件事真正落到用户可感知的交互上。
