# Global Card/Table UI Simplification Design

## Context

The current frontend uses shared `Card` and `Table` primitives plus matching
`cyber-*` global styles to define much of the project-management UI. The
existing defaults rely heavily on internal borders:

- `frontend/src/components/ui/table.tsx` adds a row separator on every
  `TableRow`
- `frontend/src/components/ui/card.tsx` adds header and footer dividers
- `frontend/src/assets/styles/globals.css` mirrors the same pattern for
  `.cyber-card-header` and `.cyber-table td`

This creates more visual noise than desired in data-heavy screens. The goal is
to keep the overall cyber aesthetic and outer boundaries while removing the
internal divider lines that make cards and tables feel busy.

One implementation detail from the earlier draft changed in the current
workspace: `frontend/src/pages/project-detail/components/ProjectTasksTab.tsx`
is deleted, and the main project task tables now live in
`frontend/src/pages/ProjectDetail.tsx`. Validation should therefore target
`ProjectDetail.tsx` instead of the removed tab component.

## Goals

- Keep outer borders for shared cards and tables
- Remove default internal separators from shared cards and tables
- Preserve readability through spacing, background contrast, and stronger hover
  feedback rather than zebra striping
- Apply the new look globally through the shared primitives first
- Allow page-level exceptions only where a specific dense screen truly needs
  stronger separation

## Non-Goals

- Removing the outer `Card` or `Table` border
- Introducing zebra striping in tables
- Redesigning dialogs, drawers, or unrelated layout systems as part of this
  pass
- Refactoring unrelated page structure outside the minimum needed for any local
  exception

## Approved Direction

The approved implementation approach is to update the shared `Card` and `Table`
components, then align the matching `cyber-*` global styles so the entire app
inherits the simpler visual language by default. Local pages remain unchanged
unless validation shows that a dense view becomes harder to scan without an
explicit divider.

This chooses consistency over piecemeal page fixes. It avoids maintaining a
second "minimal" variant and keeps the default UI language simple: outer
container boundary, internal spacing, subtle surfaces, and hover feedback.

## Component-Level Design

### Shared Table Primitive

File: `frontend/src/components/ui/table.tsx`

Planned changes:

- Keep the outer table container border on `Table`
- Remove the default row-level `border-b border-border` from `TableRow`
- Increase row hover strength from the current subtle state to a more obvious
  `bg-muted/50`
- Slightly increase vertical density on `TableCell` from `py-3.5` to `py-4`
- Remove the default header/content separator from `TableHeader`, leaving the
  header background and typography to carry hierarchy
- Keep the shared table typography and container structure unchanged

Result:

- Tables still read as bounded components because the outer frame remains
- Rows are separated by whitespace and hover feedback instead of permanent rules
- The header remains visually distinct through background tone and text styling
  rather than a line

### Shared Card Primitive

File: `frontend/src/components/ui/card.tsx`

Planned changes:

- Keep the outer card border untouched
- Remove the header divider from `CardHeader`
- Remove the footer divider from `CardFooter`
- Increase the header bottom spacing and footer top spacing to compensate for
  the missing rules
- Keep `CardContent` neutral so internal structure comes from page content,
  not hidden default separators

Result:

- Cards feel cleaner without losing containment
- Title, body, and action sections are separated by whitespace instead of hard
  lines

## Global Style Alignment

File: `frontend/src/assets/styles/globals.css`

The shared primitives are not the whole story. Several pages still rely on the
global cyber classes, so these must be aligned with the new defaults:

- Remove `border-bottom` from `.cyber-card-header`
- Increase `.cyber-card-header` bottom padding to preserve structure
- Remove `border-bottom` from `.cyber-table td`
- Increase `.cyber-table td` vertical padding to match the shared table cell
  rhythm
- Strengthen `.cyber-table tbody tr:hover` so row discovery stays easy without
  zebra striping

Without this alignment, the app would end up with two competing visual systems:
one simplified through the shared React primitives and another still dependent
on legacy divider lines.

## Exception Policy

The default rule after this change is:

- all shared `Card` and `Table` instances lose their internal separators
- pages that genuinely need stronger structural cues add them back explicitly
  at the page level

This keeps the default system simple and makes exceptions intentional. Dense
pages should not silently reintroduce global noise for every other screen.

## Validation Plan

Primary validation targets:

- `frontend/src/pages/ProjectDetail.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Dashboard.tsx`

Validation checklist:

- Outer card borders remain visible
- Outer table borders remain visible
- Table row separator lines are gone
- Card header/footer divider lines are gone
- Hover feedback is strong enough to identify the active row quickly
- Increased spacing keeps rows readable without zebra striping
- Dense pages still scan cleanly on desktop and mobile widths

Validation methods:

1. Add a focused regression test that checks the shared component class strings
   and aligned global CSS tokens
2. Run focused node tests for the new regression coverage
3. Run frontend type-checking to catch accidental syntax regressions
4. Start the dev server and visually inspect the three key pages above

## Risks and Mitigations

### Risk: Dense tables feel visually merged

Mitigation:

- increase cell vertical spacing
- strengthen row hover
- keep table header background and typography strong
- add page-local dividers only if visual QA proves one is necessary

### Risk: Card headers lose hierarchy

Mitigation:

- increase header/footer spacing after removing borders
- rely on title weight, background tone, and preserved outer frame

### Risk: Global blast radius affects screens beyond project management

Mitigation:

- concentrate the default change in three files
- cover the shared tokens with regression tests
- manually inspect representative pages before considering the work complete

## Rollback Plan

The rollback surface is intentionally small:

- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/assets/styles/globals.css`

If the new defaults prove too aggressive, revert those files first. Any later
page-local exception patches can be reverted independently without undoing the
entire design change.
