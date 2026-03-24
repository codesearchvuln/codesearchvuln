# Log Detail Refactor Overview

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智能扫描详情页与混合扫描详情页中的工具型事件，从“旧协议 JSON + 不可展示提示”迁移为“时间线主视图 + 原始 JSON 附录”的统一结构化证据体验，并兼容历史旧日志。

**Architecture:** 后端负责把缺口工具统一输出为稳定的 evidence metadata；前端先严格解析原生新协议，再按工具类型对历史旧 `tool_output`、`metadata` 和日志文本做兼容提炼。详情弹窗采用统一时间线骨架承载所有工具证据，不再让“旧版工具结果协议，无法在新版证据视图中展示”成为分析类、验证类和报告类工具的常见状态。

**Tech Stack:** FastAPI / Python, React / TypeScript, 现有 AgentAudit evidence parser 与测试体系

---

## Summary

本次改造只处理智能扫描详情页与混合扫描详情页里的“工具”类型事件，以及与之复用同一 parser / preview 的相关页面。

经代码与测试现状核对后，本次方案已确认可行，但需要先显式纳入以下实施前提：

- 后端 evidence 基座不只在 `backend/app/services/agent/tools/evidence_protocol.py`，`backend/app/services/agent/tools/file_tool.py` 里还有一套本地 `_validate_evidence_metadata` / command helper，必须一起收口，不能只改一处
- 前端当前只有 `ToolEvidencePayload | null` 两态，无法稳定承载 `native` / `legacy-derived` / `partial` / `raw-only` 四种兼容状态，必须先补一层 envelope type
- `TaskDetailPage` 已经使用 `parseToolEvidenceFromLog(...)`，但 `ScanConfigExternalToolDetail` 与 `SkillTestEventLog` 目前只调用 `parseToolEvidence(...)`；若要共享 legacy 提炼能力，必须改成事件级 parser，而不是继续只传 `metadata`
- 文档中的测试命令需要按当前仓库实际运行方式修正：后端测试需从 `backend/` 目录执行并显式设置 `PYTHONPATH=.`, 前端 `pnpm test:node` 需传真实测试文件路径
- `backend/tests/test_locate_enclosing_function_tool.py` 当前对 `resolution.method == "python_tree_sitter"` 的断言受 tree-sitter 运行环境影响；在推进 `locator_result` 改造前，需先将该测试收敛为对功能事实的断言，而不是对单一引擎字符串做硬绑定

本次方案已锁定以下决策：

- 主阅读路径采用时间线
- 后端补全缺失的 evidence 协议
- 前端兼容历史旧日志
- 覆盖全部 runtime-visible scan-core 工具
- 共享到复用同一 parser 的相关页面
- 历史不完整数据采用“部分时间线 + 明确标注”，而不是直接回退 raw JSON
- 配置页 skill metadata 真相源收口不纳入本次执行范围；本次只处理 evidence 消费链及其复用页对齐

时间线统一采用 4 段骨架：

1. 输入与目标
2. 关键证据
3. 结论与判断
4. 原始数据

不同工具只在第 2、3 段做局部扩展，避免每类工具各自长出完全独立的详情布局。

## Scope and Boundaries

### In Scope

- 智能扫描详情页与混合扫描详情页中的工具事件详情弹窗
- AgentAudit 工具证据 parser、preview、detail、列表摘要
- 复用同一 parser / preview 的外部工具详情页与 skill test 事件流预览
- 全部 runtime-visible scan-core 工具的 evidence render 覆盖
- 历史旧日志的前端兼容提炼

### Out of Scope

- workflow 写回工具的展示改造
- scan-core 之外的通用任务日志系统重构
- 数据库回填或批量迁移历史事件数据
- 非 evidence 相关的页面视觉重构

## Evidence Model

### Existing Supported Render Types

- `code_window`
- `search_hits`
- `execution_result`
- `outline_summary`
- `function_summary`
- `symbol_body`

### New Render Types To Add

- `file_list`
- `locator_result`
- `analysis_summary`
- `flow_analysis`
- `verification_summary`
- `report_summary`

### Tool Mapping

- `list_files` -> `file_list`
- `locate_enclosing_function` -> `locator_result`
- `smart_scan` / `quick_audit` / `pattern_match` -> `analysis_summary`
- `dataflow_analysis` / `controlflow_analysis_light` / `logic_authz_analysis` -> `flow_analysis`
- `verify_vulnerability` -> `verification_summary`
- `create_vulnerability_report` -> `report_summary`

### Compatibility States

前端不能继续只用 `ToolEvidencePayload | null` 表达所有情况，需要新增一层兼容状态 envelope。内部区分以下来源/完整度状态：

- `native`
- `legacy-derived`
- `partial`
- `raw-only`

推荐类型形态：

```ts
type ToolEvidenceCompatibilityState =
  | "native"
  | "legacy-derived"
  | "partial"
  | "raw-only";

interface ParsedToolEvidence {
  state: ToolEvidenceCompatibilityState;
  payload: ToolEvidencePayload | null;
  rawOutput: unknown;
  notices?: string[];
}
```

显示策略固定为：

- `native`：直接展示标准时间线
- `legacy-derived`：展示时间线，并标注来源为旧协议提炼
- `partial`：展示部分时间线，并显式提示信息不完整
- `raw-only`：仅在无法安全结构化时回退为原始 JSON

## File Structure

### Backend Files

- `backend/app/services/agent/tools/evidence_protocol.py`
  - 统一新增 render type 校验与 builder
  - 收口新 evidence metadata 约束
- `backend/app/services/agent/tools/file_tool.py`
  - 删除/收口本地 evidence 校验重复实现
  - 为 `list_files` 与 `locate_enclosing_function` 输出原生结构化 metadata
- `backend/app/services/agent/tools/smart_scan_tool.py`
  - 为 `smart_scan` 与 `quick_audit` 输出 `analysis_summary`
- `backend/app/services/agent/tools/pattern_tool.py`
  - 为 `pattern_match` 输出 `analysis_summary`
- `backend/app/services/agent/tools/code_analysis_tool.py`
  - 为 `dataflow_analysis` 输出 `flow_analysis`
- `backend/app/services/agent/tools/control_flow_tool.py`
  - 为 `controlflow_analysis_light` 输出 `flow_analysis`
- `backend/app/services/agent/tools/logic_authz_tool.py`
  - 为 `logic_authz_analysis` 输出 `flow_analysis`
- `backend/app/services/agent/tools/sandbox_tool.py`
  - 为 `verify_vulnerability` 输出 `verification_summary`
- `backend/app/services/agent/tools/reporting_tool.py`
  - 为 `create_vulnerability_report` 输出 `report_summary`

### Frontend Files

- `frontend/src/pages/AgentAudit/toolEvidence.ts`
  - 扩 render type/type unions
  - 新增 `ParsedToolEvidence` envelope
  - 增强严格解析、事件级 parser 与 legacy 兼容提炼
- `frontend/src/pages/AgentAudit/types.ts`
  - 将 `LogItem.toolEvidence` 从 `ToolEvidencePayload | null` 升级为 `ParsedToolEvidence | null`
- `frontend/src/pages/AgentAudit/components/ToolEvidenceDetail.tsx`
  - 改为统一时间线主视图
- `frontend/src/pages/AgentAudit/components/AuditDetailDialog.tsx`
  - 调整结构化证据区的整体容器与摘要口径
- `frontend/src/pages/AgentAudit/components/ToolEvidencePreview.tsx`
  - 调整为时间线首屏摘要风格
- `frontend/src/pages/AgentAudit/components/LogEntry.tsx`
  - 保持列表紧凑摘要，不展开完整时间线
- `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
  - 确保工具事件进入统一 parser 与 evidence fallback 流程
- `frontend/src/pages/ScanConfigExternalToolDetail.tsx`
  - 共用新 parser 与轻量摘要规则
- `frontend/src/pages/skill-test/components/SkillTestEventLog.tsx`
  - 共用新 parser 与轻量摘要规则

### Reference Files

- `docs/agentic_scan_core/skill-evidence-alignment/README.md`
  - 作为本轮 render type 矩阵与边界真相源

## Feasibility Validation Notes

已完成的非侵入式验证结论如下：

- 前端现有 evidence 相关测试在修正命令后可以稳定运行：
  - `cd frontend && pnpm test:node tests/toolEvidenceRendering.test.tsx`
  - `cd frontend && pnpm test:node tests/agentAuditToolEvidenceDialog.test.tsx tests/agentAuditLogEntry.test.tsx tests/scanConfigExternalToolDetail.test.tsx`
- 后端现有 `locate_enclosing_function` 测试在当前环境下存在 tree-sitter fallback 差异，表现为功能正确但 `resolution.method` 不是固定值
- 后端测试需在 `backend/` 目录下通过 `PYTHONPATH=. uv run pytest ...` 运行；若直接在仓库根目录执行当前文档原命令，容易触发 `ModuleNotFoundError: app`
- 共享消费页当前只对 `metadata` 做严格解析，因此若不升级为事件级 parser，历史兼容能力无法真正复用到这些页面

## Implementation Plan

## Chunk 1: Backend Evidence Protocol Expansion

### Task 1: 扩展后端 evidence 协议基座

**Files:**
- Modify: `backend/app/services/agent/tools/evidence_protocol.py`
- Modify: `backend/app/services/agent/tools/file_tool.py`
- Test: `backend/tests/agent/test_file_tool_evidence_protocol.py`

- [ ] **Step 1: 为新 render type 写失败测试**

在 `backend/tests/agent/test_file_tool_evidence_protocol.py` 或相邻测试文件中新增 validator 用例，断言以下 render type 能通过校验：

- `file_list`
- `locator_result`
- `analysis_summary`
- `flow_analysis`
- `verification_summary`
- `report_summary`

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_file_tool_evidence_protocol.py -q
```

Expected:

- 新增 render type 相关测试失败
- 失败原因为 unsupported render_type 或缺少 entry 校验逻辑

- [ ] **Step 3: 在 `evidence_protocol.py` 中新增 render type / builder / entry 校验，并收口 `file_tool.py` 的重复实现**

要求：

- `_RENDER_TYPES` 包含全部新增类型
- 每类 entry 的必需字段明确校验
- 新旧工具统一复用同一套 builder / validator，不再保留第二套 render type 白名单
- 保持现有 `code_window` / `search_hits` / `execution_result` 行为不回归

- [ ] **Step 4: 重新运行协议测试**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_file_tool_evidence_protocol.py -q
```

Expected:

- 通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent/tools/evidence_protocol.py backend/app/services/agent/tools/file_tool.py backend/tests/agent/test_file_tool_evidence_protocol.py
git commit -m "feat: unify evidence protocol validation"
```

### Task 2: 让文件与定位工具输出原生 evidence metadata

**Files:**
- Modify: `backend/app/services/agent/tools/file_tool.py`
- Test: `backend/tests/agent/test_file_tool_evidence_protocol.py`
- Test: `backend/tests/test_locate_enclosing_function_tool.py`

- [ ] **Step 1: 为 `list_files` 与 `locate_enclosing_function` 写失败测试**

覆盖点：

- `list_files` 返回 `file_list`
- `locate_enclosing_function` 返回 `locator_result`
- `locate_enclosing_function` 测试先去掉对单一 `resolution.method` 的硬编码依赖，改为断言：
  - `symbol` 结构完整
  - `resolution.engine/method/confidence/degraded` 存在且彼此一致

- [ ] **Step 2: 运行相关测试确认失败**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_file_tool_evidence_protocol.py tests/test_locate_enclosing_function_tool.py -q
```

Expected:

- 当前 metadata 不含目标 render type

- [ ] **Step 3: 在 `file_tool.py` 中补结构化 metadata**

`file_list` 要包含：

- directory
- pattern
- recursive
- files
- directories
- file_count
- dir_count
- truncated
- recommended_next_directories

`locator_result` 要包含：

- file_path
- target line
- symbol name
- start_line / end_line
- signature
- parameters
- return_type
- engine
- confidence
- degraded

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_file_tool_evidence_protocol.py tests/test_locate_enclosing_function_tool.py -q
```

Expected:

- 通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent/tools/file_tool.py backend/tests/agent/test_file_tool_evidence_protocol.py backend/tests/test_locate_enclosing_function_tool.py
git commit -m "feat: add structured evidence for file and locator tools"
```

## Chunk 2: Backend Analysis / Verification / Report Tool Migration

### Task 3: 为分析类工具输出结构化摘要协议

**Files:**
- Modify: `backend/app/services/agent/tools/smart_scan_tool.py`
- Modify: `backend/app/services/agent/tools/pattern_tool.py`
- Modify: `backend/app/services/agent/tools/code_analysis_tool.py`
- Modify: `backend/app/services/agent/tools/control_flow_tool.py`
- Modify: `backend/app/services/agent/tools/logic_authz_tool.py`
- Test: `backend/tests/agent/test_tools.py`

- [ ] **Step 1: 为分析类工具新增失败测试**

覆盖点：

- `smart_scan` / `quick_audit` -> `analysis_summary`
- `pattern_match` -> `analysis_summary`
- `dataflow_analysis` / `controlflow_analysis_light` / `logic_authz_analysis` -> `flow_analysis`
- 现有 `test_tools.py` 中已经覆盖了 `pattern_match`、`dataflow_analysis`、`controlflow_analysis_light`、`create_vulnerability_report` 的行为事实；新增测试应优先在现有用例上追加 evidence 断言，避免重复造一套平行测试

- [ ] **Step 2: 运行分析类工具测试确认失败**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_tools.py -q
```

Expected:

- 现有测试通过，但新增 evidence metadata 用例失败

- [ ] **Step 3: 为每类工具补原生 metadata**

`analysis_summary` 至少包含：

- title / summary
- severity stats
- hit_count
- key_files
- highlights
- next_actions

`flow_analysis` 至少包含：

- source_nodes
- sink_nodes
- taint_steps / call_chain
- blocked_reasons
- reachability / path_found / path_score
- confidence
- engine
- next_actions

统一约束：

- 继续沿用标准 evidence 顶层结构：`render_type + command_chain + display_command + entries`
- summary 类 render type 不引入第二套顶层 `body` / `summary` 协议，统一放进单 entry `entries[0]`

- [ ] **Step 4: 重新运行分析类测试**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_tools.py -q
```

Expected:

- 分析类 evidence metadata 断言通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent/tools/smart_scan_tool.py backend/app/services/agent/tools/pattern_tool.py backend/app/services/agent/tools/code_analysis_tool.py backend/app/services/agent/tools/control_flow_tool.py backend/app/services/agent/tools/logic_authz_tool.py backend/tests/agent/test_tools.py
git commit -m "feat: add structured evidence for analysis tools"
```

### Task 4: 为验证与报告工具输出结构化协议

**Files:**
- Modify: `backend/app/services/agent/tools/sandbox_tool.py`
- Modify: `backend/app/services/agent/tools/reporting_tool.py`
- Test: `backend/tests/agent/test_tools.py`

- [ ] **Step 1: 为验证与报告工具新增失败测试**

覆盖点：

- `verify_vulnerability` -> `verification_summary`
- `create_vulnerability_report` -> `report_summary`

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_tools.py -q
```

Expected:

- 新增 evidence metadata 断言失败

- [ ] **Step 3: 在验证与报告工具中补 metadata**

`verification_summary` 至少包含：

- vulnerability_type
- target
- payload
- verdict
- evidence
- response_status / runtime_status
- error

`report_summary` 至少包含：

- report_id
- title
- severity
- vulnerability_type
- location
- verified state
- recommendation
- confidence
- cvss_score

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_tools.py -q
```

Expected:

- 通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent/tools/sandbox_tool.py backend/app/services/agent/tools/reporting_tool.py backend/tests/agent/test_tools.py
git commit -m "feat: add structured evidence for verification and report tools"
```

## Chunk 3: Frontend Parser and Compatibility Layer

### Task 5: 扩展前端 evidence types 与严格协议解析

**Files:**
- Modify: `frontend/src/pages/AgentAudit/toolEvidence.ts`
- Modify: `frontend/src/pages/AgentAudit/types.ts`
- Test: `frontend/tests/toolEvidenceRendering.test.tsx`

- [ ] **Step 1: 为 6 个新 render type 写失败测试**

在 `frontend/tests/toolEvidenceRendering.test.tsx` 中新增 parse / render 输入样本：

- `file_list`
- `locator_result`
- `analysis_summary`
- `flow_analysis`
- `verification_summary`
- `report_summary`

- [ ] **Step 2: 运行 Node 测试确认失败**

Run:

```bash
cd frontend
pnpm test:node tests/toolEvidenceRendering.test.tsx
```

Expected:

- 解析返回 `null` 或渲染缺失

- [ ] **Step 3: 扩展 `toolEvidence.ts` 的 types、兼容 envelope 与严格 parser**

要求：

- `ToolEvidenceRenderType` 与 `ToolEvidencePayload` 新增 6 个 union 分支
- 新增 `ToolEvidenceCompatibilityState` 与 `ParsedToolEvidence`
- `parseToolEvidence(...)` 保持只做严格原生协议解析
- `parseToolEvidence(...)` 能严格解析全部 12 类协议

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd frontend
pnpm test:node tests/toolEvidenceRendering.test.tsx
```

Expected:

- 新增类型 parse / render 基础测试通过

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AgentAudit/toolEvidence.ts frontend/src/pages/AgentAudit/types.ts frontend/tests/toolEvidenceRendering.test.tsx
git commit -m "feat: extend frontend evidence parser model"
```

### Task 6: 增加历史旧日志兼容提炼与能力工具全集

**Files:**
- Modify: `frontend/src/pages/AgentAudit/toolEvidence.ts`
- Modify: `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- Modify: `frontend/src/pages/ScanConfigExternalToolDetail.tsx`
- Modify: `frontend/src/pages/skill-test/components/SkillTestEventLog.tsx`
- Test: `frontend/tests/toolEvidenceRendering.test.tsx`
- Test: `frontend/tests/agentAuditToolEvidenceDialog.test.tsx`
- Test: `frontend/tests/scanConfigExternalToolDetail.test.tsx`

- [ ] **Step 1: 为 legacy-derived / partial / raw-only 写失败测试**

覆盖点：

- 旧分析类 blob 能被提炼成时间线 payload
- 提炼不完整时状态为 `partial`
- 只有完全无法结构化时才走 `raw-only`

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend
pnpm test:node tests/toolEvidenceRendering.test.tsx tests/agentAuditToolEvidenceDialog.test.tsx tests/scanConfigExternalToolDetail.test.tsx
```

Expected:

- 当前仍大量掉回旧协议提示

- [ ] **Step 3: 实现 legacy adapter**

要求：

- `isToolEvidenceCapableTool(...)` 覆盖全部 17 个 scan-core 工具
- `read_file` / `extract_function` 仅保留为 legacy-compatible 工具，不回流到 runtime-visible scan-core 展示集合
- `parseToolEvidenceFromLog(...)` 返回 `ParsedToolEvidence | null`，根据工具类型从旧 `tool_output` / `metadata` / 日志文本尽力提炼
- 新增事件级 parser，供 `ScanConfigExternalToolDetail` 与 `SkillTestEventLog` 直接消费完整 event，而不是仅消费 `metadata`
- capable tool 在无法结构化时返回 `raw-only` envelope，而不是直接 `null`
- 内部标注来源与完整度

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd frontend
pnpm test:node tests/toolEvidenceRendering.test.tsx tests/agentAuditToolEvidenceDialog.test.tsx tests/scanConfigExternalToolDetail.test.tsx
```

Expected:

- 旧日志兼容断言通过

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AgentAudit/toolEvidence.ts frontend/src/pages/AgentAudit/types.ts frontend/src/pages/AgentAudit/TaskDetailPage.tsx frontend/src/pages/ScanConfigExternalToolDetail.tsx frontend/src/pages/skill-test/components/SkillTestEventLog.tsx frontend/tests/toolEvidenceRendering.test.tsx frontend/tests/agentAuditToolEvidenceDialog.test.tsx frontend/tests/scanConfigExternalToolDetail.test.tsx
git commit -m "feat: add legacy evidence compatibility states"
```

## Chunk 4: Frontend Timeline UI Refactor

### Task 7: 将详情弹窗改为统一时间线主视图

**Files:**
- Modify: `frontend/src/pages/AgentAudit/components/ToolEvidenceDetail.tsx`
- Modify: `frontend/src/pages/AgentAudit/components/AuditDetailDialog.tsx`
- Test: `frontend/tests/agentAuditToolEvidenceDialog.test.tsx`

- [ ] **Step 1: 为统一 4 段时间线骨架写失败测试**

覆盖点：

- 输入与目标
- 关键证据
- 结论与判断
- 原始数据

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend
pnpm test:node tests/agentAuditToolEvidenceDialog.test.tsx
```

Expected:

- 当前渲染还是散装分支，不满足统一骨架断言

- [ ] **Step 3: 改造 `ToolEvidenceDetail.tsx` 为统一时间线容器**

要求：

- 所有 render type 进入同一时间线骨架
- 各工具只在第 2、3 段补局部扩展内容
- `legacy-derived` 必须显示来源标识
- `partial` 必须有显式标注
- `raw-only` 仍保留旧协议提示与原始 JSON

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd frontend
pnpm test:node tests/agentAuditToolEvidenceDialog.test.tsx
```

Expected:

- 详情时间线测试通过

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AgentAudit/components/ToolEvidenceDetail.tsx frontend/src/pages/AgentAudit/components/AuditDetailDialog.tsx frontend/tests/agentAuditToolEvidenceDialog.test.tsx
git commit -m "feat: render tool evidence as timeline detail"
```

### Task 8: 收口列表摘要与轻量预览

**Files:**
- Modify: `frontend/src/pages/AgentAudit/components/ToolEvidencePreview.tsx`
- Modify: `frontend/src/pages/AgentAudit/components/LogEntry.tsx`
- Test: `frontend/tests/agentAuditLogEntry.test.tsx`
- Test: `frontend/tests/toolEvidenceRendering.test.tsx`

- [ ] **Step 1: 为新摘要策略写失败测试**

覆盖点：

- 列表只显示紧凑摘要
- 不展开完整时间线
- 不再把分析类工具强行投射成代码窗/执行窗

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend
pnpm test:node tests/agentAuditLogEntry.test.tsx tests/toolEvidenceRendering.test.tsx
```

Expected:

- 当前摘要规则不足

- [ ] **Step 3: 调整 preview 与列表摘要逻辑**

要求：

- 列表负责扫读
- 详情弹窗负责顺序阅读
- 摘要与详情对同一 `ParsedToolEvidence.payload` 口径一致
- `AuditDetailDialog.tsx` 的 log summary badge 需补上 6 个新 render type 的摘要规则，避免详情页头部仍只有旧类型摘要

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd frontend
pnpm test:node tests/agentAuditLogEntry.test.tsx tests/toolEvidenceRendering.test.tsx
```

Expected:

- 通过

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AgentAudit/components/ToolEvidencePreview.tsx frontend/src/pages/AgentAudit/components/LogEntry.tsx frontend/tests/agentAuditLogEntry.test.tsx frontend/tests/toolEvidenceRendering.test.tsx
git commit -m "feat: tighten tool evidence summaries for logs and previews"
```

## Chunk 5: Shared Consumer Alignment and Final Verification

### Task 9: 统一复用页 parser 与轻量摘要

**Files:**
- Modify: `frontend/src/pages/ScanConfigExternalToolDetail.tsx`
- Modify: `frontend/src/pages/skill-test/components/SkillTestEventLog.tsx`
- Test: `frontend/tests/scanConfigExternalToolDetail.test.tsx`

- [ ] **Step 1: 为共享页一致性写失败测试**

覆盖点：

- 同一 tool metadata 在复用页能被一致解析
- 不再出现一个页面能结构化、另一个页面掉回旧协议提示
- 同一条 legacy event 在主详情页与复用页得到相同的 `state`

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend
pnpm test:node tests/scanConfigExternalToolDetail.test.tsx
```

Expected:

- 当前共享页对新类型支持不完整

- [ ] **Step 3: 让复用页共用事件级 parser 与摘要规则**

- [ ] **Step 4: 重新运行测试**

Run:

```bash
cd frontend
pnpm test:node tests/scanConfigExternalToolDetail.test.tsx
```

Expected:

- 通过

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ScanConfigExternalToolDetail.tsx frontend/src/pages/skill-test/components/SkillTestEventLog.tsx frontend/tests/scanConfigExternalToolDetail.test.tsx
git commit -m "feat: align shared pages with evidence timeline parser"
```

### Task 10: 全量回归验证

**Files:**
- Verify only

- [ ] **Step 1: 运行后端相关测试**

Run:

```bash
cd backend
PYTHONPATH=. uv run pytest -s tests/agent/test_file_tool_evidence_protocol.py tests/agent/test_tools.py tests/test_locate_enclosing_function_tool.py -q
```

Expected:

- 全部通过
- 如仍存在 tree-sitter fallback 差异，仅允许出现在未调整前的旧断言；完成 Task 2 后应稳定通过

- [ ] **Step 2: 运行前端相关测试**

Run:

```bash
cd frontend
pnpm test:node tests/toolEvidenceRendering.test.tsx tests/agentAuditToolEvidenceDialog.test.tsx tests/agentAuditLogEntry.test.tsx tests/scanConfigExternalToolDetail.test.tsx
```

Expected:

- 全部通过

- [ ] **Step 3: 运行前端类型检查**

Run:

```bash
cd frontend && pnpm type-check
```

Expected:

- 通过

- [ ] **Step 4: 人工验收关键路径**

验证：

- 智能扫描详情页工具事件详情
- 混合扫描详情页工具事件详情
- 分析类 / 验证类 / 报告类工具各 1 条代表事件
- 历史旧日志能显示完整或部分时间线
- “旧版工具结果协议，无法在新版证据视图中展示”只在真正无法结构化时出现
- `ScanConfigExternalToolDetail` 与 `SkillTestEventLog` 对同一事件的摘要结果与主详情页一致

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate log detail evidence to timeline view"
```

## Test Cases and Scenarios

必须覆盖以下场景：

- 新任务中，`list_files` / `locate_enclosing_function` 能直接显示时间线
- 新任务中，`smart_scan` / `quick_audit` / `pattern_match` 不再落回 raw JSON
- 新任务中，`dataflow_analysis` / `controlflow_analysis_light` / `logic_authz_analysis` 展示 source / sink / path / confidence
- 新任务中，`verify_vulnerability` / `create_vulnerability_report` 展示 verdict/report 摘要
- 历史旧日志中，分析类 blob 能被提炼成完整或部分时间线
- 历史 `read_file` / `extract_function` 回归仍可用
- capable tool 在无法结构化时返回 `raw-only`，而不是直接掉成 `null`
- 共享消费页能够基于完整 event 做 legacy 提炼，而不是仅支持原生 metadata
- `raw-only` 兜底仍保留原始 JSON 查看入口

## Acceptance Criteria

- 智能扫描详情页与混合扫描详情页中的工具事件详情，分析类、验证类、报告类工具都能进入时间线主视图
- “旧版工具结果协议，无法在新版证据视图中展示”只在真正无法结构化时出现
- 历史旧日志优先显示时间线或部分时间线，而不是直接把读者扔进原始 JSON
- 列表摘要、详情时间线、原始 JSON 三层信息密度明确分离
- 共享 parser 的页面对同一 tool output 解释一致
- 文档中的测试命令可直接在当前仓库执行，不需要开发者自行猜测路径或 runner 参数

## Assumptions

- 本轮不做数据库回填，只处理新任务原生结构化与旧任务前端兼容
- 原始 JSON 永远保留折叠入口，方便核对与排障
- 详情主视图采用时间线，列表继续保持紧凑摘要
- `docs/agentic_scan_core/skill-evidence-alignment/README.md` 的 render type 矩阵视为实现边界
- `docs/agentic_scan_core/skill-evidence-alignment/README.md` 中更大的“配置页 skill metadata 真相源收口”不作为本次阻塞项
