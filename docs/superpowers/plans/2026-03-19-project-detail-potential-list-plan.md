# Project Detail Potential List Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the recursive potential-vulnerability tree on the project detail page with a paginated flat list that only shows medium/high confidence and medium+ severity findings.

**Architecture:** Keep the existing filtering/normalization pipeline in `potentialVulnerabilities.ts`, add a flatten helper returning list-ready records, and refactor `ProjectPotentialVulnerabilitiesSection` into a paginated table fed from `ProjectDetail.tsx` state. Preserve existing data sources and filtering rules, only changing presentation and organization.

**Tech Stack:** React + TypeScript (Vite setup), shadcn/ui table components, Vitest/react-testing-library for frontend tests.

---

## File Structure & Responsibilities

- `frontend/src/pages/project-detail/potentialVulnerabilities.ts`
  - Continue exporting the tree builder.
  - Add `flattenProjectDetailPotentialFindings` (or similarly named) that consumes the tree result, normalizes metadata (task info, severity/confidence labels), and returns a flat `ProjectDetailPotentialListItem[]` array sorted via shared helper.
  - Export shared sort utility so UI/tests reuse identical ordering logic.

- `frontend/src/pages/ProjectDetail.tsx`
  - Maintain `potentialTree` only if still needed for other UI; introduce `potentialFindings` state storing flattened list and `potentialSortKey` as memoized (if needed).
  - After building `nextTree`, compute `nextList = flatten(...)`, update new state, and derive `totalFindings` from the list length.
  - Reset pagination defaults (e.g., initial expanded keys removal) now that only a list exists.

- `frontend/src/pages/project-detail/components/ProjectPotentialVulnerabilitiesSection.tsx`
  - Rewrite component to render loading/empty/failure placeholders plus a table-only happy path.
  - Props should provide `findings: ProjectDetailPotentialListItem[]` (+ `pageSize`, `status`, `currentRoute`).
  - Manage internal pagination state (page number, derived slice). Render severity/confidence badges, CWE label subtitle, task badge+name, and keep the “详情” button.
  - Remove tree-specific UI (Chevron toggles, nested branches) and unused imports.

- Tests
  - Update `frontend/tests/projectDetailPotentialVulnerabilities.test.ts` to cover the new flatten helper & ordering (ensuring critical/high precedence, retention of medium severity when confidence high enough).
  - Update `frontend/tests/projectDetailPotentialVulnerabilitiesSection.test.tsx` to render the table version, covering loading/empty states, page switching, column presence, and “详情” link wiring.

---

## Tasks

### Task 1: Extend potential data module with flat list helpers

**Files:**
- Modify: `frontend/src/pages/project-detail/potentialVulnerabilities.ts`
- Modify: `frontend/tests/projectDetailPotentialVulnerabilities.test.ts`

- [ ] **Step 1:** In `potentialVulnerabilities.ts`, define `export interface ProjectDetailPotentialListItem` with fields required by UI (id/title/cweLabel/cweTooltip/severity/confidence/task metadata/route/source/createdAt).
- [ ] **Step 2:** Implement `flattenProjectDetailPotentialFindings(tree: ProjectDetailPotentialTree): ProjectDetailPotentialListItem[]` by walking each task->file->finding, copying metadata, stamping task info, and sorting via shared comparator (severity desc → confidence desc → taskCreatedAt desc → title asc).
- [ ] **Step 3:** Export `sortProjectDetailPotentialFindings` helper so UI/tests reuse identical ordering.
- [ ] **Step 4:** Update/extend `projectDetailPotentialVulnerabilities.test.ts` with cases covering: (a) flattened array length equals total filtered findings, (b) ordering honours severity/confidence/time, (c) records include expected task metadata (badge label, route, etc.). Tests should import and use the new helper directly.

### Task 2: Wire ProjectDetail page to store and pass flat list

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

- [ ] **Step 1:** Introduce `const [potentialFindings, setPotentialFindings] = useState<ProjectDetailPotentialListItem[]>([])` and remove now-unused tree-based props (e.g., `initialExpandedKeys`).
- [ ] **Step 2:** In `fetchProjectPotentialVulnerabilities`, after building `nextTree`, call `flattenProjectDetailPotentialFindings(nextTree)`; set `potentialFindings`, `potentialTotalFindings`, and drop `setPotentialTree` (or keep only if other areas still need it). Ensure `potentialStatus` transitions still rely on list length.
- [ ] **Step 3:** Update JSX to render `<ProjectPotentialVulnerabilitiesSection findings={potentialFindings} status={...} currentRoute={...} pageSize={10} />` and remove tree props (like `tree`, `initialExpandedKeys`).
- [ ] **Step 4:** Clean up unused imports/state (tree-specific) and adjust memo/derived values accordingly.

### Task 3: Rebuild ProjectPotentialVulnerabilitiesSection as paginated table

**Files:**
- Modify: `frontend/src/pages/project-detail/components/ProjectPotentialVulnerabilitiesSection.tsx`
- Modify: `frontend/tests/projectDetailPotentialVulnerabilitiesSection.test.tsx`

- [ ] **Step 1:** Refactor props to `{ status, findings, currentRoute, pageSize }`; remove tree types/imports.
- [ ] **Step 2:** Inside component, maintain `const [page, setPage] = useState(1)` and reset via `useEffect` when `findings` length or status changes.
- [ ] **Step 3:** Render header with total count badge + rule description; reuse existing status placeholder block for loading/empty/failure.
- [ ] **Step 4:** For ready state, render a `<Table>` with columns: “漏洞” (title + cwe label subtitle), “任务” (task badge + task name/ID), “严重度” (badge), “置信度” (badge), “操作” (详情 button linking with `appendReturnTo`). Map `currentSlice = findings.slice((page-1)*pageSize, page*pageSize)`.
- [ ] **Step 5:** Add pagination controls (Prev/Next buttons + page info). Disable Prev on page 1, Next on last page. Use `Button` components or minimal styled controls consistent with page.
- [ ] **Step 6:** Update `projectDetailPotentialVulnerabilitiesSection.test.tsx` to verify: (a) ready state renders rows & columns, (b) “仅显示…” text persists, (c) pagination buttons work (simulate click to move next page), (d) loading/empty/failure states show correct messages.

### Task 4: Regression + lint/tests

**Files/Commands:**
- Run: `cd frontend && pnpm test projectDetailPotentialVulnerabilities.test.ts projectDetailPotentialVulnerabilitiesSection.test.tsx`
- Run (optional broader check): `cd frontend && pnpm test` if time permits.

- [ ] **Step 1:** Execute targeted tests listed above; ensure new assertions pass.
- [ ] **Step 2:** If failures, fix code/tests accordingly.
- [ ] **Step 3:** Summarize verification results for the user.

---

Plan ready once spec doc (if any) is referenced alongside implementation. After execution, follow verification-before-completion skill before claiming success.
