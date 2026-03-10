import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  parseToolEvidence,
  isToolEvidenceCapableTool,
  parseToolEvidenceFromLog,
  type ToolEvidencePayload,
} from "../src/pages/AgentAudit/toolEvidence.ts";
import ToolEvidencePreview from "../src/pages/AgentAudit/components/ToolEvidencePreview.tsx";
import ToolEvidenceDetail from "../src/pages/AgentAudit/components/ToolEvidenceDetail.tsx";
import FindingCodeWindow from "../src/pages/AgentAudit/components/FindingCodeWindow.tsx";

globalThis.React = React;

const searchEvidenceOutput = {
  success: true,
  data: "搜索摘要",
  metadata: {
    render_type: "search_hits",
    command_chain: ["rg", "sed"],
    display_command: "rg -> sed",
    entries: [
      {
        file_path: "src/auth.ts",
        match_line: 88,
        match_text: "if (!is_admin(user)) return",
        window_start_line: 87,
        window_end_line: 89,
        language: "typescript",
        lines: [
          { line_number: 87, text: "function guard(user) {", kind: "context" },
          { line_number: 88, text: "if (!is_admin(user)) return", kind: "match" },
          { line_number: 89, text: "}", kind: "context" },
        ],
      },
    ],
  },
};

const codeWindowOutput = {
  success: true,
  data: "读取摘要",
  metadata: {
    render_type: "code_window",
    command_chain: ["read_file", "sed"],
    display_command: "read_file -> sed",
    entries: [
      {
        file_path: "src/auth.ts",
        start_line: 80,
        end_line: 92,
        focus_line: 88,
        language: "typescript",
        lines: [
          { line_number: 87, text: "function guard(user) {", kind: "context" },
          { line_number: 88, text: "if (!is_admin(user)) return", kind: "focus" },
          { line_number: 89, text: "}", kind: "context" },
        ],
      },
    ],
  },
};

const executionResultOutput = {
  success: true,
  data: "执行摘要",
  metadata: {
    render_type: "execution_result",
    command_chain: ["run_code", "python3"],
    display_command: "run_code -> python3",
    entries: [
      {
        language: "python",
        exit_code: 0,
        status: "passed",
        title: "Harness 执行结果",
        description: "验证命令注入 harness",
        runtime_image: "vulhunter/sandbox:latest",
        execution_command: "cd /tmp && python3 -c 'print(1)'",
        stdout_preview: "payload detected",
        stderr_preview: "",
        artifacts: [
          { label: "镜像", value: "vulhunter/sandbox:latest" },
          { label: "退出码", value: "0" },
        ],
        code: {
          language: "python",
          lines: [
            { line_number: 1, text: "print('payload detected')", kind: "focus" },
          ],
        },
      },
    ],
  },
};

test("parseToolEvidence 识别 search_code 结构化协议", () => {
  const parsed = parseToolEvidence(searchEvidenceOutput);

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "search_hits");
  assert.deepEqual(parsed?.commandChain, ["rg", "sed"]);
  assert.equal(parsed?.entries[0]?.filePath, "src/auth.ts");
});

test("parseToolEvidence 识别 execution_result 协议并扩展支持新工具", () => {
  const parsed = parseToolEvidence(executionResultOutput);

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "execution_result");
  assert.deepEqual(parsed?.commandChain, ["run_code", "python3"]);
  assert.equal(isToolEvidenceCapableTool("extract_function"), true);
  assert.equal(isToolEvidenceCapableTool("run_code"), true);
  assert.equal(isToolEvidenceCapableTool("sandbox_exec"), true);
});

test("parseToolEvidenceFromLog 识别 metadata 中的 execution_result 协议", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "run_code",
    toolOutput: { result: "legacy summary" },
    toolMetadata: executionResultOutput.metadata,
    toolInput: null,
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "execution_result");
  assert.equal(parsed?.displayCommand, "run_code -> python3");
});

test("parseToolEvidenceFromLog 为 MCP read_file 原始结果合成代码窗口", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "read_file",
    toolInput: {
      path: "src/demo.py",
      start_line: 3,
      end_line: 5,
    },
    toolMetadata: {
      mcp_adapter: "filesystem",
      mcp_tool: "read_file",
    },
    toolOutput: {
      result:
        "CallToolResult(content=[TextContent(type='text', text='line1\\nline2\\nline3\\nline4\\nline5\\nline6', annotations=None)], structuredContent=None, isError=False)",
      truncated: false,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "code_window");
  assert.equal(parsed?.entries[0]?.filePath, "src/demo.py");
  assert.equal(parsed?.entries[0]?.startLine, 3);
  assert.equal(parsed?.entries[0]?.endLine, 5);
  assert.deepEqual(
    parsed?.entries[0]?.lines.map((line) => `${line.lineNumber}:${line.text}`),
    ["3:line3", "4:line4", "5:line5"],
  );
});

test("parseToolEvidenceFromLog 在缺少 toolInput 时从日志内容恢复 read_file 窗口", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "read_file",
    toolInput: null,
    toolMetadata: {
      tool_status: "completed",
      mcp_adapter: "filesystem",
      mcp_tool: "read_file",
    },
    toolOutput: {
      result:
        "CallToolResult(content=[TextContent(type='text', text='line1\\nline2\\nline3\\nline4\\nline5\\nline6', annotations=None)], structuredContent=None, isError=False)",
      truncated: false,
    },
    logContent: `MCP 路由：filesystem/read_file

输入：
{
  "file_path": "src/demo.py",
  "start_line": 3,
  "end_line": 5
}

MCP 路由：filesystem/read_file@stdio

输出：
CallToolResult(content=[TextContent(type='text', text='line1\\nline2\\nline3\\nline4\\nline5\\nline6', annotations=None)], structuredContent=None, isError=False)`,
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "code_window");
  assert.equal(parsed?.entries[0]?.filePath, "src/demo.py");
  assert.deepEqual(
    parsed?.entries[0]?.lines.map((line) => `${line.lineNumber}:${line.text}`),
    ["3:line3", "4:line4", "5:line5"],
  );
});

test("parseToolEvidenceFromLog 为 search_code 原始命中结果合成 search_hits", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "search_code",
    toolInput: null,
    toolMetadata: {
      tool_status: "completed",
    },
    toolOutput: {
      result: "src/auth.ts:88:if (!is_admin(user)) return\nsrc/admin.ts:12:return true",
      truncated: false,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "search_hits");
  assert.equal(parsed?.entries.length, 2);
  assert.equal(parsed?.entries[0]?.filePath, "src/auth.ts");
  assert.equal(parsed?.entries[0]?.matchLine, 88);
  assert.equal(parsed?.entries[0]?.lines[0]?.kind, "match");
});

test("parseToolEvidenceFromLog 为 extract_function 纯文本失败结果合成执行证据", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "extract_function",
    toolInput: null,
    toolMetadata: {
      tool_status: "failed",
      mcp_adapter: "__local__",
    },
    toolOutput: {
      result: "无法提取函数 'checkAutoType'。你可以使用 read_file 工具直接读取文件，手动定位函数代码。",
      truncated: false,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "execution_result");
  assert.equal(parsed?.entries[0]?.status, "failed");
  assert.match(parsed?.entries[0]?.description || "", /checkAutoType/);
});

test("parseToolEvidenceFromLog 不把 legacy extract_function 摘要误判为源码窗口", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "extract_function",
    toolInput: {
      file_path: "src/auth.ts",
      function_name: "guard",
    },
    toolMetadata: {
      tool_status: "completed",
    },
    toolOutput: {
      result: `📦 函数提取结果

文件: src/auth.ts
函数: guard
参数: user

\`\`\`typescript
function guard(user) {
  return user;
}
\`\`\``,
      truncated: false,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "execution_result");
  assert.equal(parsed?.entries[0]?.status, "passed");
  assert.match(parsed?.entries[0]?.stdoutPreview || "", /函数提取结果/);
});

test("parseToolEvidenceFromLog 为 sandbox_exec 原始结果合成 execution_result", () => {
  const parsed = parseToolEvidenceFromLog({
    toolName: "sandbox_exec",
    toolInput: {
      command: "bash -lc 'id'",
    },
    toolMetadata: {
      tool_status: "failed",
    },
    toolOutput: {
      result: "permission denied",
      truncated: false,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.renderType, "execution_result");
  assert.deepEqual(parsed?.commandChain, ["sandbox_exec", "bash"]);
  assert.equal(parsed?.displayCommand, "sandbox_exec -> bash");
  assert.equal(parsed?.entries[0]?.executionCommand, "bash -lc 'id'");
  assert.equal(parsed?.entries[0]?.stderrPreview, "permission denied");
});

test("ToolEvidencePreview 渲染搜索命中卡片摘要", () => {
  const parsed = parseToolEvidence(searchEvidenceOutput) as ToolEvidencePayload;
  const markup = renderToStaticMarkup(
    createElement(ToolEvidencePreview, { evidence: parsed }),
  );

  assert.match(markup, /rg -&gt; sed/);
  assert.match(markup, /src\/auth\.ts:88/);
  assert.match(markup, /1 条命中/);
  assert.match(markup, /is_admin/);
  assert.match(markup, /命中/);
  assert.doesNotMatch(markup, /rounded-lg border border-cyan-500/);
});

test("ToolEvidencePreview 渲染代码窗口卡片摘要", () => {
  const parsed = parseToolEvidence(codeWindowOutput) as ToolEvidencePayload;
  const markup = renderToStaticMarkup(
    createElement(ToolEvidencePreview, { evidence: parsed }),
  );

  assert.match(markup, /read_file -&gt; sed/);
  assert.match(markup, /src\/auth\.ts:80-92/);
  assert.match(markup, /焦点行 88/);
  assert.match(markup, /代码窗口/);
  assert.doesNotMatch(markup, /rounded-lg border border-amber-500/);
});

test("ToolEvidencePreview 渲染执行证据摘要卡", () => {
  const parsed = parseToolEvidence(executionResultOutput) as ToolEvidencePayload;
  const markup = renderToStaticMarkup(
    createElement(ToolEvidencePreview, { evidence: parsed }),
  );

  assert.match(markup, /run_code -&gt; python3/);
  assert.match(markup, /验证命令注入 harness/);
  assert.match(markup, /退出码 0/);
  assert.match(markup, /payload detected/);
  assert.match(markup, /执行代码/);
});

test("ToolEvidenceDetail 渲染 execution_result 详情", () => {
  const parsed = parseToolEvidence(executionResultOutput) as ToolEvidencePayload;
  const markup = renderToStaticMarkup(
    createElement(ToolEvidenceDetail, {
      toolName: "run_code",
      evidence: parsed,
      rawOutput: executionResultOutput,
    }),
  );

  assert.match(markup, /执行摘要/);
  assert.match(markup, /执行代码/);
  assert.match(markup, /vulhunter\/sandbox:latest/);
  assert.match(markup, /cd \/tmp &amp;&amp; python3 -c/);
});

test("FindingCodeWindow 使用紧凑 IDE 风格代码窗", () => {
  const markup = renderToStaticMarkup(
    createElement(FindingCodeWindow, {
      code: "const a = 1;\nconst b = 2;",
      filePath: "src/auth.ts",
      lineStart: 80,
      lineEnd: 81,
      focusLine: 80,
      title: "代码窗口",
      density: "compact",
      badges: ["focus"],
      meta: ["typescript", "80-81"],
    }),
  );

  assert.match(markup, /代码窗口/);
  assert.match(markup, /src\/auth\.ts:80-81/);
  assert.match(markup, /focus/);
  assert.match(markup, /overflow-x-auto/);
  assert.match(markup, /whitespace-pre/);
  assert.doesNotMatch(markup, /border-b border-border\/30/);
});

test("ToolEvidenceDetail 对旧协议显示不可展示提示和原始 JSON 入口", () => {
  const markup = renderToStaticMarkup(
    createElement(ToolEvidenceDetail, {
      toolName: "search_code",
      evidence: null,
      rawOutput: { success: true, data: "legacy-only" },
    }),
  );

  assert.match(markup, /旧版工具结果协议，无法在新版证据视图中展示/);
  assert.match(markup, /查看原始 JSON/);
});
