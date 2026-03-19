# Project Detail Potential Vulnerability List – Design Spec

## Summary
- Replace the recursive “潜在漏洞” tree on the project detail page with a flat, paginated list.
- Continue showing only findings that meet existing filters: severity ≥ MEDIUM and confidence ≥ MEDIUM (or ≥0.5 for agents), sources limited to intelligent/hybrid agents and opengrep static scans.
- Maintain current visual language while clarifying the rule copy (“仅显示中/高置信度且中危及以上漏洞”).

## Data Rules
1. **Input sources**: same API calls already used in `ProjectDetail.tsx`. No new backend APIs.
2. **Filtering**:
   - Severity allowed: `CRITICAL`, `HIGH`, `MEDIUM`.
   - Confidence allowed: `HIGH`/`MEDIUM` for static; `ai_confidence >= 0.5` for agents (≥0.8 labeled HIGH, 0.5–0.79 labeled MEDIUM).
   - Agent findings must be verified, non-false-positive; static findings limited to opengrep tasks.
3. **Normalization**:
   - Reuse `buildProjectDetailPotentialTree` and new `flatten` helper to convert nested nodes into `ProjectDetailPotentialListItem` records that include CWE label/text, severity/confidence badges, task metadata (type, id, createdAt), and route + source for detail navigation.
4. **Sorting**: severity desc → confidence desc → task createdAt desc → title asc; deterministic for stable pagination.

## UI Behavior
- **Presentation**: Table-like list; each row shows vulnerability title (with CWE label subtitle), task badge + name/ID, severity badge, confidence badge, and a “详情” action button preserving `returnTo` for navigation.
- **Copy**: Keep the header badge for total count and show rule description text under the title.
- **Path/line display**: intentionally omitted per user request to reduce clutter; details remain on individual finding pages.
- **Pagination**: page size fixed to 10; Prev/Next buttons with disable states and page indicator. Changing filters reloads data and resets to page 1.
- **Loading states**: reuse existing “加载中/失败/暂无潜在漏洞” placeholders; ready state now renders the table.

## Interaction & Navigation
- Default expansion behavior removed (no tree). Instead, rely on pagination for large datasets.
- “详情” link reuses `appendReturnTo` to maintain navigation context.
- No new filters or toggles; rules are fixed per summary.

## Testing Notes
- Unit tests ensure flatten helper retains all filtered findings and enforces sorting.
- Component tests assert header copy, badges, pagination transitions, and placeholder states.
- Regression check ensures recent task section unaffected and detail routes still include return info.
