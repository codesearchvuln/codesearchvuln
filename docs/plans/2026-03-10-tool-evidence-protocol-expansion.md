# Tool Evidence Protocol Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the new AgentAudit evidence view so `extract_function`, `run_code`, and `sandbox_exec` render as structured evidence alongside the existing `read_file` and `search_code` flows.

**Architecture:** Keep the frontend on three render branches only: `code_window`, `search_hits`, and `execution_result`. Add a shared backend evidence helper so file/code/execution tools emit validated metadata consistently, then extend the existing AgentAudit parser and evidence components to understand the new payloads without adding legacy fallbacks.

**Tech Stack:** Python backend tools, pytest, React, TypeScript, Node test runner, existing AgentAudit evidence components.

---

### Task 1: Shared backend evidence protocol helper

**Files:**
- Create: `/home/xyf/AuditTool/backend/app/services/agent/tools/evidence_protocol.py`
- Modify: `/home/xyf/AuditTool/backend/app/services/agent/tools/file_tool.py`
- Test: `/home/xyf/AuditTool/backend/tests/agent/test_file_tool_evidence_protocol.py`

**Step 1: Write the failing test**
- Add tests that import shared validation/build helpers for `code_window`, `search_hits`, and `execution_result`.

**Step 2: Run test to verify it fails**
- Run: `cd /home/xyf/AuditTool/backend && PYTHONPATH=.venv/lib/python3.12/site-packages python3 -m pytest tests/agent/test_file_tool_evidence_protocol.py -q -s`

**Step 3: Write minimal implementation**
- Move shared evidence validation/build logic into `evidence_protocol.py` and update `file_tool.py` imports.

**Step 4: Run test to verify it passes**
- Re-run the same pytest command.

### Task 2: `extract_function` emits `code_window`

**Files:**
- Modify: `/home/xyf/AuditTool/backend/app/services/agent/tools/run_code.py`
- Modify: `/home/xyf/AuditTool/backend/tests/test_run_code_tool.py`

**Step 1: Write the failing test**
- Add a focused test asserting `ExtractFunctionTool` returns `metadata.render_type == "code_window"` with line metadata and symbol info.

**Step 2: Run test to verify it fails**
- Run: `cd /home/xyf/AuditTool/backend && PYTHONPATH=.venv/lib/python3.12/site-packages python3 -m pytest tests/test_run_code_tool.py -q -s -k extract_function`

**Step 3: Write minimal implementation**
- Build line-based entries from extracted code and attach validated `code_window` metadata.

**Step 4: Run test to verify it passes**
- Re-run the same pytest command.

### Task 3: `run_code` and `sandbox_exec` emit `execution_result`

**Files:**
- Modify: `/home/xyf/AuditTool/backend/app/services/agent/tools/run_code.py`
- Modify: `/home/xyf/AuditTool/backend/app/services/agent/tools/sandbox_tool.py`
- Modify: `/home/xyf/AuditTool/backend/tests/test_run_code_tool.py`
- Modify: `/home/xyf/AuditTool/backend/tests/agent/test_file_tool_evidence_protocol.py`

**Step 1: Write the failing tests**
- Add one test for `run_code` structured execution metadata.
- Add one test for `sandbox_exec` structured execution metadata.

**Step 2: Run tests to verify they fail**
- Run targeted pytest commands for those test names.

**Step 3: Write minimal implementation**
- Emit validated `execution_result` metadata including command chain, display command, status, previews, artifacts, and optional source code lines.

**Step 4: Run tests to verify they pass**
- Re-run the targeted pytest commands.

### Task 4: Frontend evidence types and parser

**Files:**
- Modify: `/home/xyf/AuditTool/frontend/src/pages/AgentAudit/toolEvidence.ts`
- Modify: `/home/xyf/AuditTool/frontend/tests/toolEvidenceRendering.test.tsx`

**Step 1: Write the failing test**
- Add parsing and rendering expectations for `execution_result`, plus capable-tool coverage for `extract_function`, `run_code`, and `sandbox_exec`.

**Step 2: Run test to verify it fails**
- Run: `cd /home/xyf/AuditTool/frontend && node --import tsx --test tests/toolEvidenceRendering.test.tsx`

**Step 3: Write minimal implementation**
- Extend the union types, parser branches, and capable-tool registry.

**Step 4: Run test to verify it passes**
- Re-run the same node test command.

### Task 5: Frontend evidence preview/detail UI

**Files:**
- Modify: `/home/xyf/AuditTool/frontend/src/pages/AgentAudit/components/ToolEvidencePreview.tsx`
- Modify: `/home/xyf/AuditTool/frontend/src/pages/AgentAudit/components/ToolEvidenceDetail.tsx`
- Modify: `/home/xyf/AuditTool/frontend/src/pages/AgentAudit/components/AuditDetailDialog.tsx`
- Modify: `/home/xyf/AuditTool/frontend/tests/agentAuditToolEvidenceDialog.test.tsx`

**Step 1: Write the failing test**
- Add a detail-flow test for `extract_function`, `run_code`, and `sandbox_exec` structured evidence.

**Step 2: Run test to verify it fails**
- Run: `cd /home/xyf/AuditTool/frontend && node --import tsx --test tests/agentAuditToolEvidenceDialog.test.tsx`

**Step 3: Write minimal implementation**
- Add `execution_result` preview/detail cards and enrich `code_window` headers for extracted functions.

**Step 4: Run test to verify it passes**
- Re-run the same node test command.

### Task 6: Final verification

**Files:**
- Modify: `/home/xyf/AuditTool/frontend/src/pages/intelligent-scan/skillToolsCatalog.ts`

**Step 1: Run backend verification**
- `cd /home/xyf/AuditTool/backend && PYTHONPATH=.venv/lib/python3.12/site-packages python3 -m pytest tests/agent/test_file_tool_evidence_protocol.py tests/test_run_code_tool.py -q -s`

**Step 2: Run frontend verification**
- `cd /home/xyf/AuditTool/frontend && pnpm type-check`
- `cd /home/xyf/AuditTool/frontend && node --import tsx --test tests/toolEvidenceRendering.test.tsx tests/agentAuditDetailUi.test.ts tests/agentAuditToolEvidenceDialog.test.tsx`

**Step 3: Update tool catalog copy if needed**
- Align descriptions with the new execution-result evidence behavior.
