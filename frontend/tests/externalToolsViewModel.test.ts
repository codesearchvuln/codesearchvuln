import test from "node:test";
import assert from "node:assert/strict";

import { SKILL_TOOLS_CATALOG } from "../src/pages/intelligent-scan/skillToolsCatalog.ts";
import {
  buildExternalToolListState,
  buildExternalToolResources,
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

const resources = buildExternalToolResources({
  skillCatalog: backendCatalog,
  promptSkills: null,
});

const rows = buildExternalToolRows({
  resources,
  staticSkillCatalog: SKILL_TOOLS_CATALOG,
});

test("buildExternalToolListState 支持动态 pageSize 切片", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "",
    typeFilter: "all",
    statusFilter: "all",
    page: 2,
    pageSize: 2,
  });

  assert.equal(listState.page, 2);
  assert.equal(listState.pageSize, 2);
  assert.equal(listState.startIndex, 2);
  assert.equal(listState.pageRows.length, 1);
  assert.equal(listState.pageRows[0]?.tool_id, rows[2]?.tool_id);
});

test("buildExternalToolListState 会在过滤后重新计算总数和总页数", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "检索",
    typeFilter: "all",
    statusFilter: "all",
    page: 1,
    pageSize: 3,
  });

  assert.equal(listState.totalRows, 1);
  assert.equal(listState.totalPages, 1);
  assert.equal(listState.pageRows.length, 1);
  assert.equal(listState.pageRows[0]?.tool_id, "search_code");
});

test("buildExternalToolListState 会把超出范围的页码钳制到最后一页", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "",
    typeFilter: "all",
    statusFilter: "all",
    page: 99,
    pageSize: 5,
  });

  assert.equal(listState.totalPages, Math.ceil(rows.length / 5));
  assert.equal(listState.page, listState.totalPages);
  assert.equal(listState.startIndex, (listState.totalPages - 1) * 5);
});

test("buildExternalToolRows 仅以后端 catalog 作为可见集合并推断 PROMPT/CLI 类型", () => {
  assert.deepEqual(
    rows.map((row) => row.tool_id),
    ["locate_enclosing_function", "run_code", "search_code"],
  );
  assert.equal(rows.find((row) => row.tool_id === "search_code")?.typeLabel, "Scan Core");
  assert.equal(rows.find((row) => row.tool_id === "run_code")?.typeLabel, "Scan Core");
  assert.equal(
    rows.find((row) => row.tool_id === "locate_enclosing_function")?.capabilities[0],
    "定位所属函数",
  );
});

test("buildExternalToolRows 会按 skill_id 去重并过滤不可用 skill", () => {
  const dedupedRows = buildExternalToolRows({
    resources: buildExternalToolResources({
      skillCatalog: [
      backendCatalog[0],
      {
        ...backendCatalog[0],
        summary: "重复项不应再次展示。",
      },
      {
        ...backendCatalog[1],
        skill_id: "   ",
      },
      {
        ...backendCatalog[2],
        entrypoint: "",
      },
      ],
      promptSkills: null,
    }),
    staticSkillCatalog: SKILL_TOOLS_CATALOG,
  });

  assert.deepEqual(dedupedRows.map((row) => row.tool_id), ["search_code"]);
});

test("buildExternalToolListState 搜索范围包含类型字段", () => {
  const listState = buildExternalToolListState({
    rows,
    searchQuery: "cli",
    typeFilter: "all",
    statusFilter: "all",
    page: 1,
    pageSize: 10,
  });

  assert.equal(listState.totalRows, 0);
});

test("SKILL_TOOLS_CATALOG 中 flow 工具的参数说明/示例与后端入口一致", () => {
  assert.equal(SKILL_TOOLS_CATALOG.some((item) => item.id === "think"), false);
  assert.equal(SKILL_TOOLS_CATALOG.some((item) => item.id === "reflect"), false);
  assert.equal(
    SKILL_TOOLS_CATALOG.filter((item) => item.id === "locate_enclosing_function").length,
    1,
  );

  const dataflow = SKILL_TOOLS_CATALOG.find((item) => item.id === "dataflow_analysis");
  assert.ok(dataflow, "missing dataflow_analysis catalog item");
  assert.deepEqual(dataflow.inputChecklist, [
    "`source_code` (string, optional): 包含 source 的代码片段（与 variable_name 配合）",
    "`file_path` (string, optional): 直接从文件读取源码（source_code 为空时推荐）",
    "`start_line` / `end_line` (number, optional): 限定 file_path 读取的行范围",
    "`variable_name` (string, optional): 要追踪的变量名（默认 user_input）",
    "`source_hints` / `sink_hints` (string[], optional): Source/Sink 语义提示（可选）",
    "`sink_code` (string, optional): 包含 sink 的代码片段（可选）",
    "`language` (string, optional): 语言标记",
    "`max_hops` (number, optional): 最大传播步数",
  ]);
  assert.match(
    dataflow.exampleInput,
    /"file_path":\s*"src\/time64\.c"/,
  );
  assert.match(dataflow.exampleInput, /"start_line":\s*120/);
  assert.match(dataflow.exampleInput, /"end_line":\s*180/);
  assert.match(dataflow.exampleInput, /"variable_name":\s*"result"/);
  assert.match(dataflow.exampleInput, /"sink_hints":\s*\[/);

  const controlflow = SKILL_TOOLS_CATALOG.find((item) => item.id === "controlflow_analysis_light");
  assert.ok(controlflow, "missing controlflow_analysis_light catalog item");
  assert.deepEqual(controlflow.inputChecklist, [
    "`file_path` (string, required): 目标文件路径；推荐使用 `path/to/file:line` 形式内嵌行号",
    "`line_start` / `line_end` (number, optional): 目标行范围（缺失时可从 file_path:line 推断）",
    "`function_name` (string, optional): 目标函数名（无行号时用于回退定位）",
    "`vulnerability_type` (string, optional): 漏洞类型（用于辅助评分）",
    "`entry_points` / `entry_points_hint` (string[], optional): 候选入口函数（或回退提示）",
    "`call_chain_hint` (string[], optional): 已知调用链提示",
    "`control_conditions_hint` (string[], optional): 已知控制条件提示",
  ]);
  assert.match(
    controlflow.exampleInput,
    /"file_path":\s*"src\/time64\.c:120"/,
  );
  assert.match(controlflow.exampleInput, /"vulnerability_type":\s*"buffer_overflow"/);
  assert.match(controlflow.exampleInput, /"call_chain_hint":\s*\[\s*"main"\s*\]/);

  const locate = SKILL_TOOLS_CATALOG.find((item) => item.id === "locate_enclosing_function");
  assert.ok(locate, "missing locate_enclosing_function catalog item");
  assert.deepEqual(locate.inputChecklist, [
    "`file_path` (string, required): 文件路径",
    "`line` (number, required): 函数内任意锚点行",
  ]);
  assert.match(locate.exampleInput, /"line":\s*132/);
});
