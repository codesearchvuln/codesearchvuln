import test from "node:test";
import assert from "node:assert/strict";

async function importOrFail<TModule = Record<string, unknown>>(
  relativePath: string,
): Promise<TModule> {
  try {
    return (await import(relativePath)) as TModule;
  } catch (error) {
    assert.fail(
      `expected helper module ${relativePath} to exist: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

test("serializeDataTableUrlState supports namespaced query keys", async () => {
  const urlStateModule = await importOrFail<any>(
    "../src/components/data-table/urlState.ts",
  );

  const params = urlStateModule.serializeDataTableUrlState(
    {
      globalFilter: "sqli",
      columnFilters: [{ id: "engine", value: "opengrep" }],
      sorting: [{ id: "severity", desc: true }],
      pagination: { pageIndex: 1, pageSize: 20 },
    },
    { prefix: "pv_" },
  );

  assert.equal(params.get("pv_q"), "sqli");
  assert.equal(params.get("pv_sort"), "severity");
  assert.equal(params.get("pv_order"), "desc");
  assert.equal(params.get("pv_page"), "2");
  assert.equal(params.get("pv_pageSize"), "20");
  assert.equal(params.get("pv_filters"), '{"engine":"opengrep"}');
});

test("parseDataTableUrlState restores state from namespaced query keys", async () => {
  const urlStateModule = await importOrFail<any>(
    "../src/components/data-table/urlState.ts",
  );

  const state = urlStateModule.parseDataTableUrlState(
    new URLSearchParams(
      "pv_q=critical&pv_sort=confidence&pv_order=asc&pv_page=3&pv_pageSize=50&pv_filters=%7B%22status%22%3A%22verified%22%7D",
    ),
    { prefix: "pv_" },
  );

  assert.equal(state.globalFilter, "critical");
  assert.deepEqual(state.sorting, [{ id: "confidence", desc: false }]);
  assert.equal(state.pagination.pageIndex, 2);
  assert.equal(state.pagination.pageSize, 50);
  assert.deepEqual(state.columnFilters, [{ id: "status", value: "verified" }]);
});

test("mergeDataTableUrlState only rewrites keys inside the same prefix", async () => {
  const urlStateModule = await importOrFail<any>(
    "../src/components/data-table/urlState.ts",
  );

  const merged = urlStateModule.mergeDataTableUrlState(
    new URLSearchParams(
      "tool=opengrep&page=9&pageSize=100&pv_page=5&pv_pageSize=10&pv_q=old",
    ),
    {
      globalFilter: "fresh",
      pagination: { pageIndex: 1, pageSize: 20 },
      sorting: [{ id: "severity", desc: true }],
      columnFilters: [],
    },
    { prefix: "pv_" },
  );

  assert.equal(merged.get("tool"), "opengrep");
  assert.equal(merged.get("page"), "9");
  assert.equal(merged.get("pageSize"), "100");
  assert.equal(merged.get("pv_q"), "fresh");
  assert.equal(merged.get("pv_page"), "2");
  assert.equal(merged.get("pv_pageSize"), "20");
  assert.equal(merged.get("pv_sort"), "severity");
  assert.equal(merged.get("pv_order"), "desc");
});
