import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AuditDetailContent } from "../src/pages/AgentAudit/components/AuditDetailDialog.tsx";
import type { LogItem } from "../src/pages/AgentAudit/types.ts";

globalThis.React = React;

function createBaseLogItem(): LogItem {
  return {
    id: "tool-log-1",
    time: "00:00:01",
    type: "tool",
    title: "已完成：search_code",
    tool: {
      name: "search_code",
      status: "completed",
      duration: 120,
    },
    detail: {
      tool_output: {
        success: true,
      },
    },
  };
}

test("AuditDetailContent 渲染 search_code 结构化证据详情", () => {
  const logItem: LogItem = {
    ...createBaseLogItem(),
    toolEvidence: {
      renderType: "search_hits",
      commandChain: ["rg", "sed"],
      displayCommand: "rg -> sed",
      entries: [
        {
          filePath: "src/auth.ts",
          matchLine: 88,
          matchText: "if (!is_admin(user)) return",
          windowStartLine: 87,
          windowEndLine: 89,
          language: "typescript",
          lines: [
            { lineNumber: 87, text: "function guard(user) {", kind: "context" },
            { lineNumber: 88, text: "if (!is_admin(user)) return", kind: "match" },
            { lineNumber: 89, text: "}", kind: "context" },
          ],
        },
      ],
    },
  };

  const markup = renderToStaticMarkup(
    createElement(AuditDetailContent, {
      detailType: "log",
      logItem,
    }),
  );

  assert.match(markup, /结构化证据/);
  assert.match(markup, /rg -&gt; sed/);
  assert.match(markup, /src\/auth\.ts:88/);
  assert.match(markup, /命中窗口/);
});

test("AuditDetailContent 渲染 read_file 结构化代码窗口详情", () => {
  const logItem: LogItem = {
    ...createBaseLogItem(),
    title: "已完成：read_file",
    tool: {
      name: "read_file",
      status: "completed",
      duration: 80,
    },
    toolEvidence: {
      renderType: "code_window",
      commandChain: ["read_file", "sed"],
      displayCommand: "read_file -> sed",
      entries: [
        {
          filePath: "src/auth.ts",
          startLine: 80,
          endLine: 92,
          focusLine: 88,
          language: "typescript",
          lines: [
            { lineNumber: 87, text: "function guard(user) {", kind: "context" },
            { lineNumber: 88, text: "if (!is_admin(user)) return", kind: "focus" },
            { lineNumber: 89, text: "}", kind: "context" },
          ],
        },
      ],
    },
  };

  const markup = renderToStaticMarkup(
    createElement(AuditDetailContent, {
      detailType: "log",
      logItem,
    }),
  );

  assert.match(markup, /结构化证据/);
  assert.match(markup, /read_file -&gt; sed/);
  assert.match(markup, /src\/auth\.ts:80-92/);
  assert.match(markup, /代码窗口/);
});
