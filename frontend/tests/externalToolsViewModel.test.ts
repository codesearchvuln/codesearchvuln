import test from "node:test";
import assert from "node:assert/strict";

import { SKILL_TOOLS_CATALOG } from "../src/pages/intelligent-scan/skillToolsCatalog.ts";
import {
  buildExternalToolListState,
  buildExternalToolRows,
} from "../src/pages/intelligent-scan/externalToolsViewModel.ts";

const backendCatalog = [
  {
    skill_id: "search_code",
    name: "search_code",
    summary: "在项目中检索代码片段、关键字与命中位置。",
    entrypoint: "scan-core/search_code",
    namespace: "scan-core",
    aliases: [],
    has_scripts: false,
    has_bin: false,
    has_assets: false,
  },
  {
    skill_id: "run_code",
    name: "run_code",
    summary: "运行验证 Harness/PoC，收集动态执行证据。",
    entrypoint: "scan-core/run_code",
    namespace: "scan-core",
    aliases: [],
    has_scripts: false,
    has_bin: false,
    has_assets: false,
  },
  {
    skill_id: "locate_enclosing_function",
    name: "locate_enclosing_function",
    summary: "根据文件与行号定位所属函数及其范围，辅助补全函数级证据。",
    entrypoint: "scan-core/locate_enclosing_function",
    namespace: "scan-core",
    aliases: [],
    has_scripts: false,
    has_bin: false,
    has_assets: false,
  },
];

const rows = buildExternalToolRows({
  skillCatalog: backendCatalog,
  staticSkillCatalog: SKILL_TOOLS_CATALOG,
});

test("buildExternalToolListState 支持动态 pageSize 切片", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "",
    page: 2,
    pageSize: 2,
  });

  assert.equal(listState.page, 2);
  assert.equal(listState.pageSize, 2);
  assert.equal(listState.startIndex, 2);
  assert.equal(listState.pageRows.length, 1);
  assert.equal(listState.pageRows[0]?.id, rows[2]?.id);
});

test("buildExternalToolListState 会在过滤后重新计算总数和总页数", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "检索",
    page: 1,
    pageSize: 3,
  });

  assert.equal(listState.totalRows, 1);
  assert.equal(listState.totalPages, 1);
  assert.equal(listState.pageRows.length, 1);
  assert.equal(listState.pageRows[0]?.id, "search_code");
});

test("buildExternalToolListState 会把超出范围的页码钳制到最后一页", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "",
    page: 99,
    pageSize: 5,
  });

  assert.equal(listState.totalPages, Math.ceil(rows.length / 5));
  assert.equal(listState.page, listState.totalPages);
  assert.equal(listState.startIndex, (listState.totalPages - 1) * 5);
});

test("buildExternalToolRows 仅以后端 catalog 作为可见集合并推断 PROMPT/CLI 类型", () => {
  assert.deepEqual(
    rows.map((row) => row.id),
    ["search_code", "run_code", "locate_enclosing_function"],
  );
  assert.equal(rows.find((row) => row.id === "search_code")?.displayType, "PROMPT");
  assert.equal(rows.find((row) => row.id === "run_code")?.displayType, "CLI");
  assert.equal(
    rows.find((row) => row.id === "locate_enclosing_function")?.capabilities[0],
    "根据文件与行号定位所属函数及其范围，辅助补全函数级证据。",
  );
});

test("buildExternalToolListState 搜索范围包含类型字段", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "cli",
    page: 1,
    pageSize: 10,
  });

  assert.equal(listState.totalRows, 1);
  assert.equal(listState.pageRows[0]?.id, "run_code");
});
