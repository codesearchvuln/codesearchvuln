# Global Card/Table UI Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove default internal separators from shared card and table UI while preserving outer borders and readability across the app.

**Architecture:** The change lives at the shared-style layer first: update the shared React primitives in `frontend/src/components/ui/` and align the matching cyber utility rules in `frontend/src/assets/styles/globals.css`. Protect the behavior with source-based node tests, then manually verify the most representative pages (`ProjectDetail`, `Projects`, `Dashboard`) and add page-local exceptions only if visual QA proves they are necessary.

**Tech Stack:** React 18, TypeScript, Tailwind utility classes, global CSS, Node `node:test`, Vite, pnpm

---

### Task 1: Capture the shared-style regression in a focused node test

**Files:**
- Create: `frontend/tests/cardTableUiSimplification.test.ts`
- Read: `frontend/src/components/ui/table.tsx`
- Read: `frontend/src/components/ui/card.tsx`
- Read: `frontend/src/assets/styles/globals.css`

**Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("shared table and card defaults use spacing instead of internal borders", () => {
  const table = read("src/components/ui/table.tsx");
  const card = read("src/components/ui/card.tsx");
  const globals = read("src/assets/styles/globals.css");

  assert.match(table, /hover:bg-muted\/50/);
  assert.match(table, /px-4 py-4 align-middle/);
  assert.doesNotMatch(table, /TableRow[\s\S]*border-b border-border/);
  assert.doesNotMatch(table, /TableHeader[\s\S]*\[_tr\]:border-b/);

  assert.match(card, /flex flex-col gap-2 pb-6/);
  assert.match(card, /flex items-center gap-3 pt-6/);
  assert.doesNotMatch(card, /CardHeader[\s\S]*border-b border-border/);
  assert.doesNotMatch(card, /CardFooter[\s\S]*border-t border-border/);

  assert.match(globals, /\.cyber-card-header\s*\{[\s\S]*padding:\s*0\.75rem 1rem 1\.5rem 1rem;/);
  assert.doesNotMatch(globals, /\.cyber-card-header\s*\{[\s\S]*border-bottom:/);
  assert.match(globals, /\.cyber-table td\s*\{[\s\S]*padding:\s*1rem 1rem;/);
  assert.doesNotMatch(globals, /\.cyber-table td\s*\{[\s\S]*border-bottom:/);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:node cardTableUiSimplification.test.ts`
Expected: FAIL because the shared table/card files still contain the old divider classes and spacing values.

**Step 3: Commit the failing-test checkpoint**

```bash
git add frontend/tests/cardTableUiSimplification.test.ts
git commit -m "test: capture shared card table simplification expectations"
```

### Task 2: Simplify the shared table primitive

**Files:**
- Modify: `frontend/src/components/ui/table.tsx`
- Test: `frontend/tests/cardTableUiSimplification.test.ts`

**Step 1: Write the minimal implementation**

Update the shared table classes to this shape:

```tsx
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/50", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-4 align-middle text-foreground text-base [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}
```

Also remove the now-obsolete `"[&_tr:last-child]:border-0"` rule from
`TableBody`, because rows no longer own a default bottom border.

**Step 2: Run the focused test**

Run: `pnpm test:node cardTableUiSimplification.test.ts`
Expected: still FAIL, but now only on the card/global CSS assertions.

**Step 3: Commit**

```bash
git add frontend/src/components/ui/table.tsx frontend/tests/cardTableUiSimplification.test.ts
git commit -m "refactor: simplify shared table separators"
```

### Task 3: Simplify the shared card primitive

**Files:**
- Modify: `frontend/src/components/ui/card.tsx`
- Test: `frontend/tests/cardTableUiSimplification.test.ts`

**Step 1: Write the minimal implementation**

Update the card structure to this shape:

```tsx
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-2 pb-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 pt-6", className)}
      {...props}
    />
  );
}
```

Do not change the outer `Card` border or the `CardContent` defaults in this
task.

**Step 2: Run the focused test**

Run: `pnpm test:node cardTableUiSimplification.test.ts`
Expected: still FAIL, but now only on the global CSS assertions.

**Step 3: Commit**

```bash
git add frontend/src/components/ui/card.tsx frontend/tests/cardTableUiSimplification.test.ts
git commit -m "refactor: simplify shared card separators"
```

### Task 4: Align the legacy cyber global styles

**Files:**
- Modify: `frontend/src/assets/styles/globals.css`
- Test: `frontend/tests/cardTableUiSimplification.test.ts`

**Step 1: Write the minimal implementation**

Update the existing cyber utility rules to this shape:

```css
.cyber-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1.5rem 1rem;
  background: var(--cyber-bg-elevated);
}

.cyber-table td {
  padding: 1rem 1rem;
  color: var(--cyber-text);
}

.cyber-table tbody tr:hover {
  background: rgba(15, 23, 42, 0.8);
}
```

Leave the shared outer borders and thead styling intact.

**Step 2: Run the focused test**

Run: `pnpm test:node cardTableUiSimplification.test.ts`
Expected: PASS

**Step 3: Run a broader regression pass**

Run: `pnpm test:node`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/assets/styles/globals.css frontend/tests/cardTableUiSimplification.test.ts
git commit -m "style: align cyber card and table defaults"
```

### Task 5: Verify key pages and add exceptions only if needed

**Files:**
- Inspect: `frontend/src/pages/ProjectDetail.tsx`
- Inspect: `frontend/src/pages/Projects.tsx`
- Inspect: `frontend/src/pages/Dashboard.tsx`
- Optional Modify: `frontend/src/pages/ProjectDetail.tsx`
- Optional Modify: `frontend/src/pages/Projects.tsx`
- Optional Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Run static verification**

Run: `pnpm type-check`
Expected: PASS

**Step 2: Run the app locally**

Run: `pnpm dev`
Expected: Vite dev server starts without compile errors.

**Step 3: Manually inspect the key pages**

Check these routes:

- `/projects`
- `/projects/:id` for a project with recent tasks and potential findings
- `/dashboard`

Confirm all of the following:

- table outer borders remain visible
- no default row separators remain
- hover is strong enough to follow the active row
- card header/footer sections read clearly without divider lines
- the denser project detail tables still scan comfortably

**Step 4: Apply a page-local exception only if QA proves it is necessary**

If one specific page loses too much structure, restore separation in that page
only with an explicit local class, for example:

```tsx
<div className="border-t border-border pt-4">...</div>
```

or

```tsx
<div className="border-b border-border pb-3">...</div>
```

Do not reintroduce the divider on the shared primitives.

**Step 5: Re-run the focused checks after any exception patch**

Run: `pnpm test:node cardTableUiSimplification.test.ts && pnpm type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx frontend/src/pages/Projects.tsx frontend/src/pages/Dashboard.tsx
git commit -m "style: add page-level exceptions for dense layouts"
```

Skip this commit if no page-level exception is needed.
