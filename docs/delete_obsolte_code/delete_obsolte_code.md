# delete_obsolte_code Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy early-scan chain (`AuditTask` / `AuditIssue`, `/api/v1/tasks/*`, `/api/v1/scan/*`) without affecting the currently active static, intelligent, and hybrid scan flows.

**Architecture:** Treat the removal as a two-phase decommission. Phase 1 removes product-facing and API-facing entrypoints while protecting the current static, intelligent, and hybrid scan flows. Phase 2 removes the remaining model, metrics, recovery, and database artifacts once the active paths no longer depend on the legacy chain.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, TypeScript, Vite, pytest, frontend node tests

---

## Core Constraints

- The only supported scan modes after this work are static, intelligent, and hybrid.
- Hybrid scan must preserve its current behavior: `AgentTask` remains the main task model, and static bootstrap results remain vulnerability entry-point reconnaissance input.
- Do not break these active interfaces:
  - `/api/v1/static-tasks/*`
  - `/api/v1/agent-tasks/*`
  - `/tasks/static`
- `/tasks/intelligent`
- `/tasks/hybrid`
- `frontend/src/components/scan/CreateProjectScanDialog.tsx`
- `frontend/src/features/projects/services/repoZipScan.ts` cannot be deleted wholesale because `validateZipFile` is still used by current flows.

## Definition of Done

This plan is only considered complete when all of the following are true:

- No user-facing or API-facing path can create, list, update, or cancel legacy audit tasks.
- Static, intelligent, and hybrid scans still pass creation and result-display verification.
- No production code depends on `AuditTask`, `AuditIssue`, `/api/v1/tasks/*`, or `/api/v1/scan/*`.
- Startup recovery, project metrics, and insight responses no longer model legacy audit tasks.
- Database schema no longer contains `audit_tasks` or `audit_issues`.
- Repo-wide residual search is clean except for intentional historical notes in migration history or archived references.

## Phase Gates

### Gate A: Before Phase 1

Must be true before deleting any runtime entrypoint:

- All live scan entrypoints are explicitly recorded.
- `repoZipScan.ts` dependency split plan is decided.
- Legacy references are frozen by search output and linked in the work log or PR.

### Gate B: After Phase 1

Must be true before touching models or database tables:

- Frontend no longer calls `/tasks/*` or `/scan/*`.
- Backend no longer exposes `/tasks/*` or `/scan/*`.
- Static, intelligent, and hybrid scans still work end-to-end.
- No current UI behavior depends on `AuditTask` or `AuditIssue`.

### Gate C: After Phase 2

Must be true before closing the work:

- Audit models, metrics, recovery, and migration artifacts are removed.
- Database tables are dropped through Alembic.
- Residual search and focused test suites pass.
- Docs are updated to describe only the active three-scan architecture.

## Deletion Boundary

**Remove**

- `backend/app/models/audit.py`
- `backend/app/api/v1/endpoints/tasks.py`
- `backend/app/api/v1/endpoints/scan.py`
- Audit-related methods in `frontend/src/shared/api/database.ts`
- Frontend audit types and audit-only aggregation logic
- Metrics, startup recovery, and database objects that still model audit tasks

**Keep**

- Static scan flows and all `static-tasks` engines
- Intelligent scan flow based on `AgentTask`
- Hybrid scan flow based on `AgentTask + static_bootstrap`
- ZIP validation support currently used by scan creation UI

## Current Residual Surface

### Backend

- Models and relationships:
  - `backend/app/models/audit.py`
  - `backend/app/models/project.py`
  - `backend/app/models/__init__.py`
- API exposure:
  - `backend/app/api/v1/api.py`
  - `backend/app/api/v1/endpoints/tasks.py`
  - `backend/app/api/v1/endpoints/scan.py`
- Runtime and orchestration:
  - `backend/app/main.py`
  - `backend/app/services/scanner.py`
  - `backend/app/api/v1/endpoints/projects_crud.py`
- Metrics and serialization:
  - `backend/app/services/project_metrics.py`
  - `backend/app/api/v1/endpoints/projects_insights.py`
  - `backend/app/api/v1/endpoints/projects_shared.py`
  - `backend/app/models/project_management_metrics.py`

### Frontend

- Types:
  - `frontend/src/shared/types/index.ts`
- API surface:
  - `frontend/src/shared/api/database.ts`
- Pages and aggregation:
  - `frontend/src/pages/ProjectDetail.tsx`
  - `frontend/src/features/projects/services/projectCardPreview.ts`
  - `frontend/src/pages/projects/data/createApiProjectsPageDataSource.ts`
  - `frontend/src/components/scan/hooks/useTaskForm.ts`
  - `frontend/src/pages/projects/types.ts`
- Shared utility with mixed legacy/live responsibilities:
  - `frontend/src/features/projects/services/repoZipScan.ts`

### Tests, scripts, and docs

- Backend tests referencing `AuditTask`, `AuditIssue`, startup recovery, project metrics, migrations, and transfer
- Frontend tests referencing audit APIs, audit types, and old scan calls
- Scripts or docs still describing `/scan/*` or old task flows

## Execution Order and Dependency Rules

The work must proceed in this order. Do not reorder these groups:

1. Freeze references and protect live scan flows.
2. Split live ZIP validation away from legacy `/scan/*` helpers.
3. Remove frontend audit types and API usage.
4. Remove frontend aggregation and display dependencies.
5. Remove backend `/tasks` and `/scan` routes and old task creation/runtime.
6. Verify active three-mode product behavior.
7. Remove backend models, metrics, and startup recovery logic.
8. Add and verify the Alembic drop-table migration.
9. Clean residual tests, scripts, and docs.
10. Run final repo-wide verification and close the loop.

If any verification step fails, stop and fix that phase before proceeding to the next one.

## Risks and Protections

- `repoZipScan.ts` mixes legacy `/scan/*` calls with still-live ZIP validation logic.
  Protection: move or keep `validateZipFile` first, then remove only `scanZipFile` and `scanStoredZipFile`.
- `ProjectDetail` and project card preview aggregate audit and active scan results together.
  Protection: remove audit aggregation only after replacing totals, recent task lists, and issue summaries with current three-mode logic.
- Metrics still count `audit_tasks`.
  Protection: update backend rollups and frontend consumers in the same change set so dashboards do not request removed fields.
- Startup recovery still handles `AuditTask`.
  Protection: remove audit recovery logic in the same phase as model cleanup, not earlier.
- Alembic and schema snapshot tests will fail if code cleanup lands without migration updates.
  Protection: pair drop-table migration work with migration tests and snapshot expectation updates.

## Work Log Template

Each execution phase should produce a short log entry with:

- changed files
- commands run
- failures encountered
- unresolved follow-ups
- decision that the next gate is open

Recommended format:

```markdown
### Phase X Log
- Changed:
- Verified:
- Remaining:
- Gate decision:
```

### Task 1: Freeze the Legacy Surface and Protect Live Flows

**Files:**
- Modify: `docs/delete_obsolte_code/delete_obsolte_code.md`
- Inspect during implementation: `frontend/src/components/scan/CreateProjectScanDialog.tsx`
- Inspect during implementation: `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`

**Entry criteria:**
- No deletion work has started yet.
- Current live scan behavior is still available for manual verification.

- [ ] **Step 1: Confirm live scan entrypoints that must remain untouched**

Record these active flows before deleting anything:

- static scan via `static-tasks`
- intelligent scan via `agent-tasks`
- hybrid scan via `agent-tasks` with `static_bootstrap.mode = embedded`

- [ ] **Step 2: Freeze the deletion scope**

Run:

```bash
rg -n "AuditTask|AuditIssue|audit_tasks|audit_issues|/tasks/|/scan/" backend frontend
```

Expected: all remaining references are cataloged before deletion starts.

- [ ] **Step 3: Capture the non-regression rule**

Write into the implementation notes and PR description that no change may break:

- `/api/v1/static-tasks/*`
- `/api/v1/agent-tasks/*`
- `/tasks/static`
- `/tasks/intelligent`
- `/tasks/hybrid`

**Exit criteria:**
- A frozen inventory exists for the legacy surface.
- The team has a written non-regression rule for the active three scan modes.
- Gate A is satisfied.

### Task 2: Remove Frontend Legacy Types and API Calls

**Files:**
- Modify: `frontend/src/shared/types/index.ts`
- Modify: `frontend/src/shared/api/database.ts`
- Modify: `frontend/src/components/scan/hooks/useTaskForm.ts`
- Modify: `frontend/src/pages/projects/types.ts`
- Test: `frontend/tests/remoteRepositoryScanRemoval.test.ts`

**Entry criteria:**
- Task 1 is complete.
- No active UI contract still needs `AuditTask` for current product behavior.

- [ ] **Step 1: Remove audit-only types from shared frontend contracts**

Delete:

- `AuditTask`
- `AuditIssue`
- `CreateAuditTaskForm`
- audit-only derived types no longer used after page cleanup

- [ ] **Step 2: Remove audit-only methods from `database.ts`**

Delete:

- `getAuditTasks`
- `getAuditTaskById`
- `createAuditTask`
- `updateAuditTask`
- `cancelAuditTask`
- `getAuditIssues`
- `createAuditIssue`
- `updateAuditIssue`
- old `/scan/instant/*` helpers if still only serving the removed chain

- [ ] **Step 3: Remove form state that exists only for the deleted audit chain**

Clean `useTaskForm.ts` and dependent types so no component still expects `CreateAuditTaskForm`.

- [ ] **Step 4: Run frontend type and unit verification**

Run:

```bash
cd frontend && pnpm type-check
cd frontend && pnpm test:node
```

Expected: no TypeScript reference remains to audit types or deleted database API methods.

**Exit criteria:**
- Frontend shared contracts no longer export audit types or methods.
- Type-check passes.
- Remaining audit references are limited to still-pending UI aggregation, tests, or backend code.

### Task 3: Remove Frontend Aggregation and UI Dependencies on Audit Tasks

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`
- Modify: `frontend/src/features/projects/services/projectCardPreview.ts`
- Modify: `frontend/src/pages/projects/data/createApiProjectsPageDataSource.ts`
- Modify: `frontend/src/pages/projects/data/createMockProjectsPageDataSource.ts`
- Test: `frontend/tests/projectsPageViewModel.test.ts`
- Test: `frontend/tests/taskActivities*.test.ts`

**Entry criteria:**
- Task 2 is complete.
- Frontend no longer needs audit API calls for compilation.

- [ ] **Step 1: Remove audit task loading from project detail**

Delete all `api.getAuditTasks(...)` usage and remove related local state, summary logic, and recent-task merging tied to `AuditTask`.

- [ ] **Step 2: Rebuild project-level previews around the active three-mode model**

Refactor `projectCardPreview.ts` so totals, recent tasks, and progress only use:

- static scan groups
- agent tasks classified as intelligent
- agent tasks classified as hybrid

- [ ] **Step 3: Remove audit task dependency from project page data source**

Delete `getAuditTasks` from the API surface contract and any mock data that still manufactures audit tasks.

- [ ] **Step 4: Verify that product pages still reflect the active three scan modes**

Run:

```bash
cd frontend && pnpm test:node
```

Expected: project list, project detail, static task view, intelligent task view, and hybrid task view still work without audit data.

**Exit criteria:**
- Project-level pages and previews no longer depend on audit tasks.
- UI still represents only static, intelligent, and hybrid task behavior.

### Task 4: Separate Live ZIP Validation from Legacy `/scan/*` Calls

**Files:**
- Modify: `frontend/src/features/projects/services/repoZipScan.ts`
- Modify: `frontend/src/components/scan/CreateProjectScanDialog.tsx`
- Modify: `frontend/src/components/scan/CreateScanTaskDialog.tsx`
- Modify: `frontend/src/components/scan/hooks/useZipFile.ts`
- Modify: `frontend/src/components/scan/create-scan-task/ZipUploadCard.tsx`
- Test: `frontend/tests/scanDialogUtils.test.ts`

**Entry criteria:**
- Task 1 is complete.
- Implementer has confirmed that `validateZipFile` is still used by active scan creation flows.

- [ ] **Step 1: Preserve `validateZipFile` before deleting old scan helpers**

Either:

- move `validateZipFile` into a new shared ZIP utility file, or
- keep `repoZipScan.ts` but strip it down to validation-only responsibilities

Do not leave live UI code importing deleted `/scan/*` helpers.

- [ ] **Step 2: Delete legacy ZIP-triggered scan API helpers**

Remove:

- `scanZipFile`
- `scanStoredZipFile`

Both hit `/scan/*` and belong to the removed chain.

- [ ] **Step 3: Update all UI imports to use the retained validation utility**

Run:

```bash
rg -n "repoZipScan|scan/upload-zip|scan-stored-zip" frontend
```

Expected: no current UI code calls `/scan/*`; only validation support remains, in its new or reduced home.

**Exit criteria:**
- No active frontend code imports deleted `/scan/*` helper functions.
- ZIP validation remains available to the current scan creation UI.

### Task 5: Remove Backend Legacy Routes and Runtime Implementations

**Files:**
- Modify: `backend/app/api/v1/api.py`
- Delete: `backend/app/api/v1/endpoints/tasks.py`
- Delete: `backend/app/api/v1/endpoints/scan.py`
- Modify: `backend/app/api/v1/endpoints/projects_crud.py`
- Modify: `backend/app/services/scanner.py`
- Test: `backend/tests/test_projects_response_serialization.py`

**Entry criteria:**
- Tasks 2, 3, and 4 are complete, or active frontend code has already been detached from `/tasks/*` and `/scan/*`.

- [ ] **Step 1: Unregister legacy route groups**

Remove route registration for:

- `tasks`
- `scan`

from `backend/app/api/v1/api.py`.

- [ ] **Step 2: Delete endpoint modules that expose the removed chain**

Delete:

- `backend/app/api/v1/endpoints/tasks.py`
- `backend/app/api/v1/endpoints/scan.py`

- [ ] **Step 3: Remove old task creation paths still reachable through projects**

Clean `projects_crud.py` so it no longer creates `AuditTask`.

- [ ] **Step 4: Remove scanner service code used only by the deleted chain**

If `backend/app/services/scanner.py` becomes entirely unused, delete it; otherwise reduce it to only live shared helpers still referenced elsewhere.

- [ ] **Step 5: Verify removed routes are no longer present**

Run:

```bash
cd backend && pytest tests/test_projects_response_serialization.py -v
```

Expected: no backend code path still serializes or exposes old scan tasks.

**Exit criteria:**
- `/api/v1/tasks/*` and `/api/v1/scan/*` are no longer registered.
- No backend runtime path creates `AuditTask`.
- Gate B is satisfied once active three-mode verification also passes.

### Task 6: Remove Metrics, Recovery, and Model-Level Audit Artifacts

**Files:**
- Delete: `backend/app/models/audit.py`
- Modify: `backend/app/models/project.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/project_metrics.py`
- Modify: `backend/app/api/v1/endpoints/projects_insights.py`
- Modify: `backend/app/api/v1/endpoints/projects_shared.py`
- Modify: `backend/app/models/project_management_metrics.py`
- Test: `backend/tests/test_startup_interrupted_recovery.py`
- Test: `backend/tests/test_projects_response_serialization.py`

**Entry criteria:**
- Task 5 is complete.
- The active frontend and backend flows no longer rely on the legacy routes.

- [ ] **Step 1: Remove audit models and project relationships**

Delete `models/audit.py` and remove every import/export/relationship that depends on it.

- [ ] **Step 2: Remove audit task recovery from startup**

Delete `AuditTask` handling from interrupted-task recovery in `main.py`.

- [ ] **Step 3: Remove audit fields from project metrics and insight responses**

Remove:

- audit task counters
- audit-related serialization fields
- audit-based rollup code

Then ensure frontend-facing responses no longer include dead fields.

- [ ] **Step 4: Run focused backend verification**

Run:

```bash
cd backend && pytest tests/test_startup_interrupted_recovery.py tests/test_projects_response_serialization.py -v
```

Expected: startup recovery and project serialization work without audit task models.

**Exit criteria:**
- No production backend code imports `models.audit`.
- Project metrics and insights no longer model audit tasks.
- Startup recovery no longer mentions audit tasks.

### Task 7: Drop Legacy Tables and Repair Migration/Test Expectations

**Files:**
- Add: `backend/alembic/versions/<new_revision>_drop_legacy_audit_tables.py`
- Modify: `backend/tests/test_alembic_project.py`
- Modify: `backend/app/db/schema_snapshots/baseline_5b0f3c9a6d7e.py`
- Modify: any backend tests still expecting `audit_tasks` / `audit_issues`

**Entry criteria:**
- Task 6 is complete.
- Production code no longer depends on legacy tables.
- Any required historical snapshot export plan is ready.

- [ ] **Step 1: Add a migration that drops `audit_issues` and `audit_tasks`**

Drop in dependency-safe order:

1. `audit_issues`
2. `audit_tasks`

- [ ] **Step 2: Update migration and schema snapshot expectations**

Remove the dropped tables from schema assertions and any preserved baseline expectations used in tests.

- [ ] **Step 3: Add a pre-drop data check for real environments**

Before applying the migration outside development, export a one-time snapshot of legacy rows if any still exist.

- [ ] **Step 4: Verify migration integrity**

Run:

```bash
cd backend && pytest tests/test_alembic_project.py -v
```

Expected: migration tests pass and no schema expectations mention the dropped audit tables.

**Exit criteria:**
- Alembic migration cleanly removes both legacy tables.
- Schema and migration tests are updated and passing.

### Task 8: Clean Residual Tests, Scripts, and Docs

**Files:**
- Modify: backend and frontend tests still referencing `AuditTask`, `AuditIssue`, `/tasks`, or `/scan`
- Modify: scripts that still call `/scan/*`
- Modify: docs that still present the deleted chain as active architecture
- Test: full residual search

**Entry criteria:**
- Tasks 1 through 7 are complete.
- Remaining references should now mostly be in tests, scripts, and docs.

- [ ] **Step 1: Remove obsolete tests or rewrite them around active scan modes**

Delete tests that exist only for the removed chain; rewrite shared tests that should now validate only static/intelligent/hybrid behavior.

- [ ] **Step 2: Remove script-level calls to `/scan/*`**

Any script still invoking removed endpoints must be deleted or updated.

- [ ] **Step 3: Refresh docs to reflect the post-removal architecture**

Ensure docs only describe the active three-mode model.

- [ ] **Step 4: Run final residual search**

Run:

```bash
rg -n "AuditTask|AuditIssue|audit_tasks|audit_issues|/api/v1/tasks|/api/v1/scan|getAuditTasks|createAuditTask|cancelAuditTask" backend frontend docs
```

Expected: no remaining product-code references to the removed chain.

**Exit criteria:**
- Residual search is clean.
- Docs only describe static, intelligent, and hybrid scans as active modes.
- Gate C is satisfied.

## Active Flow Regression Suite

Run this suite at the end of Phase 1 and again before final closure:

### Frontend

```bash
cd frontend && pnpm type-check
cd frontend && pnpm test:node
```

### Backend

```bash
cd backend && pytest tests/test_projects_response_serialization.py tests/test_startup_interrupted_recovery.py tests/test_alembic_project.py -v
```

### Residual search

```bash
rg -n "AuditTask|AuditIssue|audit_tasks|audit_issues|/api/v1/tasks|/api/v1/scan|getAuditTasks|createAuditTask|cancelAuditTask" backend frontend docs
```

Expected outcome:

- no regression in active three scan modes
- no route exposure for `/tasks/*` or `/scan/*`
- no product-code dependency on audit task types or tables

## Manual Verification Checklist

The executor must manually verify all three scan modes after Phase 1:

- Create a static scan from the current scan creation UI.
- Create an intelligent scan from the current scan creation UI.
- Create a hybrid scan from the current scan creation UI.
- Confirm hybrid scan still routes through `AgentTask` and still uses static bootstrap results as reconnaissance input.
- Open affected summary pages and confirm they show only static, intelligent, and hybrid task categories.

## Verification Checklist

- [ ] Static scan creation and result display still work
- [ ] Intelligent scan creation, execution, and SSE display still work
- [ ] Hybrid scan creation still works and still injects static bootstrap results
- [ ] `/api/v1/tasks/*` is gone
- [ ] `/api/v1/scan/*` is gone
- [ ] Frontend no longer depends on `AuditTask` / `AuditIssue`
- [ ] Project metrics no longer count audit tasks
- [ ] Startup recovery no longer handles audit tasks
- [ ] Database no longer contains `audit_tasks` / `audit_issues`

## Closeout Checklist

- [ ] Phase logs are recorded for each phase
- [ ] Gate A passed
- [ ] Gate B passed
- [ ] Gate C passed
- [ ] Active flow regression suite passed twice
- [ ] Manual verification completed
- [ ] Final residual search is clean
- [ ] Docs updated to only describe the active three-mode architecture
- [ ] Legacy tables removed through Alembic
- [ ] Work is ready for merge or handoff

## Assumptions

- This plan intentionally keeps the user-provided feature name spelling: `delete_obsolte_code`.
- The active product model is limited to static, intelligent, and hybrid scans.
- Legacy early-scan data, if still present in real environments, can be exported once before table removal.
- No active user-facing workflow should continue to rely on `/scan/*` or `/tasks/*`.
