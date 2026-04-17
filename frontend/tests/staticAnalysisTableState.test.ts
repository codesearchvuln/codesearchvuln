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

test("createStaticAnalysisInitialTableState applies default sorting, pagination, and hidden columns", async () => {
  const tableStateModule = await importOrFail<any>(
    "../src/pages/static-analysis/tableState.ts",
  );

  const state = tableStateModule.createStaticAnalysisInitialTableState({
    globalFilter: "",
    columnFilters: [],
    sorting: [],
    pagination: { pageIndex: 2, pageSize: 0 },
    columnVisibility: {
      engine: true,
    },
    rowSelection: {},
    density: "comfortable",
  });

  assert.deepEqual(state.sorting, [{ id: "severity", desc: true }]);
  assert.equal(state.pagination.pageIndex, 2);
  assert.equal(state.pagination.pageSize, 15);
  assert.equal(state.columnVisibility.location, false);
  assert.equal(state.columnVisibility.engine, true);
});

test("createStaticAnalysisInitialTableState keeps explicit sorting and page size", async () => {
  const tableStateModule = await importOrFail<any>(
    "../src/pages/static-analysis/tableState.ts",
  );

  const state = tableStateModule.createStaticAnalysisInitialTableState({
    globalFilter: "",
    columnFilters: [],
    sorting: [{ id: "confidence", desc: false }],
    pagination: { pageIndex: 1, pageSize: 50 },
    columnVisibility: {},
    rowSelection: {},
    density: "comfortable",
  });

  assert.deepEqual(state.sorting, [{ id: "confidence", desc: false }]);
  assert.equal(state.pagination.pageIndex, 1);
  assert.equal(state.pagination.pageSize, 50);
});

test("resolveStaticAnalysisTableState keeps the default hidden location column when URL state omits visibility", async () => {
  const tableStateModule = await importOrFail<any>(
    "../src/pages/static-analysis/tableState.ts",
  );

  const state = tableStateModule.resolveStaticAnalysisTableState({
    globalFilter: "",
    columnFilters: [],
    sorting: [],
    pagination: { pageIndex: 0, pageSize: 0 },
    columnVisibility: {},
    rowSelection: {},
    density: "comfortable",
  });

  assert.deepEqual(state.sorting, [{ id: "severity", desc: true }]);
  assert.equal(state.pagination.pageSize, 15);
  assert.equal(state.columnVisibility.location, false);
});

test("buildStaticAnalysisUnifiedFindingsQuery maps table state into backend query params", async () => {
  const tableStateModule = await importOrFail<any>(
    "../src/pages/static-analysis/tableState.ts",
  );

  const query = tableStateModule.buildStaticAnalysisUnifiedFindingsQuery({
    state: {
      globalFilter: "",
      columnFilters: [
        { id: "engine", value: "bandit" },
        { id: "severity", value: "HIGH" },
        { id: "confidence", value: "LOW" },
        { id: "status", value: "verified" },
        { id: "rule", value: "yaml.load" },
      ],
      sorting: [{ id: "confidence", desc: false }],
      pagination: { pageIndex: 2, pageSize: 50 },
      columnVisibility: {},
      rowSelection: {},
      density: "comfortable",
    },
    opengrepTaskId: "og-1",
    gitleaksTaskId: "",
    banditTaskId: "bd-1",
    phpstanTaskId: "",
    yasaTaskId: "",
    pmdTaskId: "",
  });

  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 50);
  assert.equal(query.engine, "bandit");
  assert.equal(query.severity, "HIGH");
  assert.equal(query.confidence, "LOW");
  assert.equal(query.status, "verified");
  assert.equal(query.keyword, "yaml.load");
  assert.equal(query.sortBy, "confidence");
  assert.equal(query.sortOrder, "asc");
  assert.equal(query.opengrepTaskId, "og-1");
  assert.equal(query.banditTaskId, "bd-1");
  assert.equal(query.gitleaksTaskId, undefined);
});

test("buildStaticAnalysisUnifiedFindingsQuery falls back to default backend sorting", async () => {
  const tableStateModule = await importOrFail<any>(
    "../src/pages/static-analysis/tableState.ts",
  );

  const query = tableStateModule.buildStaticAnalysisUnifiedFindingsQuery({
    state: {
      globalFilter: "controller.php",
      columnFilters: [],
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 0 },
      columnVisibility: {},
      rowSelection: {},
      density: "comfortable",
    },
    opengrepTaskId: "",
    gitleaksTaskId: "",
    banditTaskId: "",
    phpstanTaskId: "php-1",
    yasaTaskId: "",
    pmdTaskId: "",
  });

  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 15);
  assert.equal(query.sortBy, "severity");
  assert.equal(query.sortOrder, "desc");
  assert.equal(query.keyword, "controller.php");
  assert.equal(query.phpstanTaskId, "php-1");
});
