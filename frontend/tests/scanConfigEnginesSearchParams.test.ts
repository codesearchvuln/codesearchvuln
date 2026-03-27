import assert from "node:assert/strict";
import test from "node:test";

import { buildScanConfigEngineSearchParams } from "../src/pages/ScanConfigEngines.tsx";

test("buildScanConfigEngineSearchParams clears data-table state when switching engine tabs", () => {
  const currentParams = new URLSearchParams({
    tab: "opengrep",
    page: "3",
    pageSize: "50",
    q: "crypto",
    sort: "ruleName",
    order: "desc",
    filters: '{"source":"builtin"}',
  });

  const nextParams = buildScanConfigEngineSearchParams(currentParams, "pmd");

  assert.equal(nextParams.get("tab"), "pmd");
  assert.equal(nextParams.get("page"), null);
  assert.equal(nextParams.get("pageSize"), null);
  assert.equal(nextParams.get("q"), null);
  assert.equal(nextParams.get("sort"), null);
  assert.equal(nextParams.get("order"), null);
  assert.equal(nextParams.get("filters"), null);
});

test("buildScanConfigEngineSearchParams preserves unrelated params", () => {
  const currentParams = new URLSearchParams({
    tab: "gitleaks",
    foo: "bar",
    page: "2",
  });

  const nextParams = buildScanConfigEngineSearchParams(currentParams, "pmd");

  assert.equal(nextParams.get("tab"), "pmd");
  assert.equal(nextParams.get("foo"), "bar");
  assert.equal(nextParams.get("page"), null);
});
