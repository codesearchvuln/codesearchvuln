import test from "node:test";
import assert from "node:assert/strict";

import {
  EXTERNAL_TOOLS_MAX_PAGE_SIZE,
  resolveAnchoredExternalToolsPage,
  resolveExternalToolsFirstVisibleIndex,
  resolveResponsiveExternalToolsLayout,
} from "../src/pages/intelligent-scan/externalToolsResponsiveLayout.ts";

test("resolveResponsiveExternalToolsLayout 根据容器尺寸计算列数、行数和分页容量", () => {
  const layout = resolveResponsiveExternalToolsLayout({
    width: 980,
    height: 620,
    minCardHeight: 72,
    gap: 16,
  });

  assert.equal(layout.columnCount, 1);
  assert.equal(layout.rowCount, 7);
  assert.equal(layout.pageSize, 7);
});

test("resolveResponsiveExternalToolsLayout 在极小容器下至少保留 1x1 容量", () => {
  const layout = resolveResponsiveExternalToolsLayout({
    width: 180,
    height: 120,
    minCardHeight: 72,
    gap: 16,
  });

  assert.equal(layout.columnCount, 1);
  assert.equal(layout.rowCount, 1);
  assert.equal(layout.pageSize, 1);
});

test("resolveResponsiveExternalToolsLayout 会随高度增加分页容量", () => {
  const compact = resolveResponsiveExternalToolsLayout({
    width: 980,
    height: 240,
    minCardHeight: 72,
    gap: 16,
  });
  const tall = resolveResponsiveExternalToolsLayout({
    width: 980,
    height: 780,
    minCardHeight: 72,
    gap: 16,
  });

  assert.equal(compact.columnCount, 1);
  assert.equal(tall.columnCount, 1);
  assert.ok(tall.pageSize > compact.pageSize);
  assert.ok(tall.pageSize <= EXTERNAL_TOOLS_MAX_PAGE_SIZE);
});

test("resolveExternalToolsFirstVisibleIndex 返回当前页的首个锚点索引", () => {
  assert.equal(resolveExternalToolsFirstVisibleIndex({ page: 3, pageSize: 6 }), 12);
  assert.equal(resolveExternalToolsFirstVisibleIndex({ page: 0, pageSize: 0 }), 0);
});

test("resolveAnchoredExternalToolsPage 在 pageSize 变化后按原首项锚点重算页码", () => {
  const nextPage = resolveAnchoredExternalToolsPage({
    firstVisibleIndex: 12,
    nextPageSize: 4,
    totalRows: 20,
  });

  assert.equal(nextPage, 4);
});

test("resolveAnchoredExternalToolsPage 会把页码钳制到最后一页", () => {
  const nextPage = resolveAnchoredExternalToolsPage({
    firstVisibleIndex: 18,
    nextPageSize: 10,
    totalRows: 19,
  });

  assert.equal(nextPage, 2);
});
