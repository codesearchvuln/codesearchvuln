# Agent Audit Verified-Only Detail Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make intelligent scan and hybrid scan detail pages show only verified, non-false-positive vulnerabilities, remove verification-status UI, remove the processing-status column, and make the stats card count only verified vulnerabilities.

**Architecture:** Keep backend/API behavior unchanged and normalize the display contract in the frontend detail-page flow. Centralize "verified vulnerability" predicates in the AgentAudit view-model layer, derive one `visibleVerifiedFindings` collection in the page container, and feed that same collection into the findings table, stats summary, and finding-detail routing decisions.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Table, node:test, server-side static markup tests

---

## File Map

**Modify**
- `frontend/src/pages/AgentAudit/detailViewModel.ts`
- `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- `frontend/src/pages/AgentAudit/types.ts`
- `frontend/src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx`
- `frontend/tests/agentAuditDetailViewModel.test.ts`
- `frontend/tests/realtimeFindingsPanelHeaders.test.ts`

**Delete**
- `frontend/src/pages/AgentAudit/findingsFilterUtils.ts`
- `frontend/tests/agentAuditVerifiedFilter.test.tsx`

**Create**
- `frontend/tests/agentAuditTaskDetailVerifiedOnly.test.ts`

**Do not modify in this task**
- `frontend/src/pages/ProjectDetail.tsx`
- `frontend/src/pages/project-detail/components/ProjectPotentialVulnerabilitiesSection.tsx`
- `frontend/src/pages/AgentAudit/report-export/components.tsx`

## Implementation Notes

- "Verified vulnerability" must mean: verified and not false positive.
- Use these signals only:
  - verified: `is_verified === true` or `verification_progress === "verified"`
  - false positive: `status === "false_positive"` or `authenticity === "false_positive"` or `detailMode === "false_positive_reason"` or `display_severity === "invalid"`
- The page-level source of truth must be a single derived array named `visibleVerifiedFindings` inside `TaskDetailPage.tsx`.
- `RealtimeFindingsPanel` remains a presentational component. Do not let it re-introduce business filtering logic.
- Keep `getAgentFindings(taskId, { include_false_positive: true })` unchanged. Filter only in frontend view-model/page state.

---

### Task 1: Centralize verified-vulnerability predicates in the view model

**Files:**
- Modify: `frontend/src/pages/AgentAudit/detailViewModel.ts`
- Test: `frontend/tests/agentAuditDetailViewModel.test.ts`

- [ ] **Step 1: Add predicate helpers to the view model**

Add and export these functions in `frontend/src/pages/AgentAudit/detailViewModel.ts` near the existing finding helper logic:

```ts
export function isFalsePositiveFinding(item: RealtimeFindingLike): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  const authenticity = String(item.authenticity || "").trim().toLowerCase();
  const detailMode = String(item.detailMode || "").trim().toLowerCase();
  const displaySeverity = String(item.display_severity || "").trim().toLowerCase();

  return (
    status === "false_positive" ||
    authenticity === "false_positive" ||
    detailMode === "false_positive_reason" ||
    displaySeverity === "invalid"
  );
}

export function isVerifiedFinding(item: RealtimeFindingLike): boolean {
  if (item.is_verified) return true;
  return String(item.verification_progress || "").trim().toLowerCase() === "verified";
}

export function isVisibleVerifiedVulnerability(item: RealtimeFindingLike): boolean {
  return isVerifiedFinding(item) && !isFalsePositiveFinding(item);
}
```

- [ ] **Step 2: Remove duplicate non-exported false-positive helper if possible**

If `detailViewModel.ts` currently has a private `isFalsePositiveFinding`, replace it with the exported version rather than keeping two copies.

- [ ] **Step 3: Update stats-summary logic to use verified-only semantics**

Replace the current `countDisplayFindings()` / fallback logic in `buildStatsSummary()` with verified-only counting:

```ts
const verifiedTotal = displayFindings.length
  ? displayFindings.filter((item) => isVisibleVerifiedVulnerability(item)).length
  : Math.max(toFiniteNumber(task?.verified_count), 0);

return {
  progressPercent: ...,
  durationMs,
  totalFindings: verifiedTotal,
  effectiveFindings: verifiedTotal,
  falsePositiveFindings: 0,
  ...
};
```

If `countDisplayFindings()` becomes unused after this change, delete it.

- [ ] **Step 4: Run the focused view-model test file**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- agentAuditDetailViewModel.test.ts
```

Expected:
- Existing progress-related tests still pass or fail only because the test file still needs updated assertions for removed `verification` filters.

- [ ] **Step 5: Add the failing/updated predicate and stats tests**

In `frontend/tests/agentAuditDetailViewModel.test.ts`, add cases that assert:
- `isVerifiedFinding` returns `true` for `is_verified: true`
- `isVerifiedFinding` returns `true` for `verification_progress: "verified"`
- `isVisibleVerifiedVulnerability` returns `false` for:
  - `authenticity: "false_positive"`
  - `status: "false_positive"`
  - `detailMode: "false_positive_reason"`
  - `display_severity: "invalid"`
- `buildStatsSummary` counts only verified, non-false-positive items from `displayFindings`
- `buildStatsSummary` falls back to `task.verified_count`, not `task.findings_count`

- [ ] **Step 6: Re-run the same focused test file**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- agentAuditDetailViewModel.test.ts
```

Expected:
- PASS for the updated view-model test file

---

### Task 2: Remove verification filter from the shared filter model

**Files:**
- Modify: `frontend/src/pages/AgentAudit/types.ts`
- Modify: `frontend/src/pages/AgentAudit/detailViewModel.ts`
- Test: `frontend/tests/agentAuditDetailViewModel.test.ts`

- [ ] **Step 1: Remove verification from the shared types**

In `frontend/src/pages/AgentAudit/types.ts`, change:

```ts
export interface FindingsViewFilters {
  keyword: string;
  severity: string;
  verification: string;
  showFiltered?: boolean;
}
```

to:

```ts
export interface FindingsViewFilters {
  keyword: string;
  severity: string;
  showFiltered?: boolean;
}
```

- [ ] **Step 2: Remove verification-specific filter types from the view model**

In `frontend/src/pages/AgentAudit/detailViewModel.ts`:
- delete `FindingVerificationFilter`
- remove `verification` from `AgentAuditFindingFilters`
- remove `verification` and `verificationLabel` from `FindingTableRow`

- [ ] **Step 3: Remove verification filtering from buildFindingTableState**

Delete:
- `const verificationFilter = ...`
- `matchedVerification`
- keyword matching against `row.verificationLabel`

The filter should only consider:
- keyword
- severity

Keep sort behavior unchanged.

- [ ] **Step 4: Update the existing buildFindingTableState tests**

In `frontend/tests/agentAuditDetailViewModel.test.ts`, remove `verification: "all"` from all filter objects.

- [ ] **Step 5: Run the focused view-model tests again**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- agentAuditDetailViewModel.test.ts
```

Expected:
- PASS with no remaining references to `verification` in the tested filter objects

---

### Task 3: Delete the old auto-apply verified-filter flow

**Files:**
- Modify: `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- Delete: `frontend/src/pages/AgentAudit/findingsFilterUtils.ts`
- Delete: `frontend/tests/agentAuditVerifiedFilter.test.tsx`

- [ ] **Step 1: Remove findingsFilterUtils imports**

Delete this import block from `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`:

```ts
import {
  hasAnyVerifiedFinding,
  shouldAutoApplyVerifiedFilter,
} from "./findingsFilterUtils";
```

- [ ] **Step 2: Remove verification-specific local state**

Delete from `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`:
- `hasAutoAppliedVerifiedFilter`
- `userOverrideVerificationFilter`
- the `useEffect` that resets those states on task change
- the `useEffect` that auto-applies `verification: "verified"`

- [ ] **Step 3: Simplify createDefaultFindingsFilters**

Change:

```ts
const createDefaultFindingsFilters = (): FindingsViewFilters => ({
  keyword: "",
  severity: "all",
  verification: "all",
});
```

to:

```ts
const createDefaultFindingsFilters = (): FindingsViewFilters => ({
  keyword: "",
  severity: "all",
});
```

- [ ] **Step 4: Simplify handleFindingsFiltersChange**

Replace the current implementation with:

```ts
const handleFindingsFiltersChange = useCallback(
  (nextFilters: FindingsViewFilters) => {
    setFindingsFilters(nextFilters);
  },
  [],
);
```

Keep the existing function signature if needed by callers, but do not preserve any verification override behavior.

- [ ] **Step 5: Delete the obsolete helper file and its dedicated tests**

Delete:
- `frontend/src/pages/AgentAudit/findingsFilterUtils.ts`
- `frontend/tests/agentAuditVerifiedFilter.test.tsx`

- [ ] **Step 6: Run type-check to expose any remaining references**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend type-check
```

Expected:
- Type errors only where `verification` references still remain in AgentAudit files/tests

---

### Task 4: Derive one page-level visibleVerifiedFindings collection

**Files:**
- Modify: `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
- Modify: `frontend/src/pages/AgentAudit/detailViewModel.ts`

- [ ] **Step 1: Import the new predicates from the view model**

In `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`, extend the `detailViewModel` imports to include:

```ts
isVisibleVerifiedVulnerability,
```

- [ ] **Step 2: Derive verified persisted and realtime collections**

Immediately after `persistedDisplayFindings`, add:

```ts
const verifiedPersistedDisplayFindings = useMemo(
  () => persistedDisplayFindings.filter((item) => isVisibleVerifiedVulnerability(item)),
  [persistedDisplayFindings],
);

const verifiedRealtimeFindings = useMemo(
  () => realtimeFindings.filter((item) => isVisibleVerifiedVulnerability(item)),
  [realtimeFindings],
);
```

- [ ] **Step 3: Create the single page-level source of truth**

Add:

```ts
const visibleVerifiedFindings = useMemo(
  () =>
    mergeRealtimeFindingsBatch(verifiedRealtimeFindings, verifiedPersistedDisplayFindings, {
      source: "db",
    }),
  [verifiedPersistedDisplayFindings, verifiedRealtimeFindings],
);
```

This variable name is required for consistency with the tests and future maintenance.

- [ ] **Step 4: Feed stats from visibleVerifiedFindings**

Change the `buildStatsSummary()` call from:

```ts
displayFindings: persistedDisplayFindings,
```

to:

```ts
displayFindings: visibleVerifiedFindings,
```

- [ ] **Step 5: Feed RealtimeFindingsPanel from visibleVerifiedFindings**

Change:

```tsx
items={persistedDisplayFindings}
```

to:

```tsx
items={visibleVerifiedFindings}
```

- [ ] **Step 6: Use visibleVerifiedFindings for finding-detail routing lookups**

Update these `TaskDetailPage.tsx` lookup sites:
- route redirection check around the `detailType === "finding"` branch
- `selectedFinding` realtime fallback branch

Use `visibleVerifiedFindings` instead of bare `realtimeFindings`.

Do not change persisted DB finding priority when both DB and realtime versions exist.

- [ ] **Step 7: Re-run type-check**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend type-check
```

Expected:
- No remaining `verification` field errors in `TaskDetailPage.tsx`
- No missing symbol errors related to removed helper imports

---

### Task 5: Simplify the findings panel UI

**Files:**
- Modify: `frontend/src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx`
- Test: `frontend/tests/realtimeFindingsPanelHeaders.test.ts`

- [ ] **Step 1: Remove the verification Select from the toolbar**

Delete the `Select` block that uses:
- `value={props.filters.verification}`
- `placeholder="验证状态"`
- `全部验证状态`
- `待验证`
- `已验证`

Keep the keyword input and severity filter unchanged.

- [ ] **Step 2: Update the search placeholder**

Change:

```tsx
placeholder="搜索漏洞类型 / 危害 / 状态"
```

to:

```tsx
placeholder="搜索漏洞类型 / 危害"
```

- [ ] **Step 3: Delete processing-status table UI**

Remove:
- the `处理状态` header cell
- the `processingStatus` badge cell in each row

- [ ] **Step 4: Delete the now-dead processing-status helpers**

Delete from `RealtimeFindingsPanel.tsx`:
- `ProcessingStatusKey`
- `getProcessingStatusClassName`
- `normalizeProcessingToken`
- `resolveStatusKeyFromBackendToken`
- `defaultStatusLabel`
- `resolveBackendProcessingStatus`
- `getProcessingStatus`

Keep `isFalsePositiveFinding()` and `getActionLabel()` because they still drive the "查看判定依据" behavior.

- [ ] **Step 5: Replace the empty-state behavior**

Delete:
- `showVerifiedOnlyHint`
- the hint text about switching back to all vulnerabilities
- the `查看全部漏洞` button

Set the final empty-state message behavior to:
- if running: `getEmptyStateMessage(props.currentPhase)`
- if not running: `暂无已验证漏洞`

- [ ] **Step 6: Update component tests**

In `frontend/tests/realtimeFindingsPanelHeaders.test.ts`:
- remove `verification` from the shared `filters` object
- remove the test that expects `查看全部漏洞`
- add assertions that the markup does not contain:
  - `验证状态`
  - `全部验证状态`
  - `待验证`
  - `处理状态`
  - `查看全部漏洞`
- update the placeholder assertion to match the new search text
- add or update the empty-state assertion to match `暂无已验证漏洞`

- [ ] **Step 7: Run the focused findings-panel test file**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- realtimeFindingsPanelHeaders.test.ts
```

Expected:
- PASS for the updated panel behavior

---

### Task 6: Add a source-level regression test for TaskDetailPage wiring

**Files:**
- Create: `frontend/tests/agentAuditTaskDetailVerifiedOnly.test.ts`
- Test target: `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`

- [ ] **Step 1: Create a source-based test matching the repo's existing style**

Use the style of `frontend/tests/taskDetailPageScrollbars.test.ts`. Read the source file and assert the new wiring contract.

- [ ] **Step 2: Add required assertions**

In `frontend/tests/agentAuditTaskDetailVerifiedOnly.test.ts`, assert that `TaskDetailPage.tsx` source:
- contains `const visibleVerifiedFindings = useMemo(`
- contains `items={visibleVerifiedFindings}`
- contains `displayFindings: visibleVerifiedFindings`
- does not import `hasAnyVerifiedFinding`
- does not import `shouldAutoApplyVerifiedFilter`
- does not contain `verification: "all"`

- [ ] **Step 3: Run the new test file**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- agentAuditTaskDetailVerifiedOnly.test.ts
```

Expected:
- PASS

---

### Task 7: Final verification

**Files:**
- All modified AgentAudit files

- [ ] **Step 1: Run the three focused regression files**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node -- agentAuditDetailViewModel.test.ts realtimeFindingsPanelHeaders.test.ts agentAuditTaskDetailVerifiedOnly.test.ts
```

Expected:
- PASS for all three files

- [ ] **Step 2: Run full node tests**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend test:node
```

Expected:
- PASS, or only failures unrelated to these files that already existed before implementation

- [ ] **Step 3: Run full type-check**

Run:

```bash
pnpm --dir /home/xyf/AuditTool/frontend type-check
```

Expected:
- PASS

- [ ] **Step 4: Commit**

Run:

```bash
git add \
  frontend/src/pages/AgentAudit/detailViewModel.ts \
  frontend/src/pages/AgentAudit/TaskDetailPage.tsx \
  frontend/src/pages/AgentAudit/types.ts \
  frontend/src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx \
  frontend/tests/agentAuditDetailViewModel.test.ts \
  frontend/tests/realtimeFindingsPanelHeaders.test.ts \
  frontend/tests/agentAuditTaskDetailVerifiedOnly.test.ts \
  docs/superpowers/plans/2026-03-23-agent-audit-verified-only-detail-page.md
git rm -f \
  frontend/src/pages/AgentAudit/findingsFilterUtils.ts \
  frontend/tests/agentAuditVerifiedFilter.test.tsx
git commit -m "feat: show only verified vulnerabilities in agent detail views"
```

Expected:
- A single commit containing the verified-only detail-page refactor and regression coverage

---

## Acceptance Criteria

- Intelligent scan and hybrid scan detail pages no longer show a verification-status filter.
- The findings table no longer shows a processing-status column.
- The detail-page findings table only contains verified, non-false-positive vulnerabilities.
- The stats card labeled `漏洞数量` reflects only verified, non-false-positive vulnerabilities.
- No page-level behavior depends on auto-switching a verification filter.
- Realtime findings and DB findings are merged into one page-level `visibleVerifiedFindings` collection before rendering.
- Project detail potential-vulnerability tables remain unchanged.
