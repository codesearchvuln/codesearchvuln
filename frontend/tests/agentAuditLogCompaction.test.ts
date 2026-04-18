import test from "node:test";
import assert from "node:assert/strict";

import { compactAgentAuditDisplayLogs } from "../src/pages/AgentAudit/utils.ts";
import type { LogItem } from "../src/pages/AgentAudit/types.ts";

function createLog(overrides: Partial<LogItem> = {}): LogItem {
  return {
    id: overrides.id || `log-${Math.random().toString(36).slice(2, 8)}`,
    time: overrides.time || "00:00:28",
    type: overrides.type || "info",
    title: overrides.title || "侦查智能体 Agent 启动，LLM 开始自主收集信息...",
    content: overrides.content,
    phaseLabel: overrides.phaseLabel,
    agentName: overrides.agentName,
    agentRawName: overrides.agentRawName,
    detail: overrides.detail,
    eventTimestamp: overrides.eventTimestamp ?? null,
    repeatCount: overrides.repeatCount,
  };
}

test("compactAgentAuditDisplayLogs merges consecutive visually identical logs", () => {
  const compacted = compactAgentAuditDisplayLogs([
    createLog({ id: "a", agentName: "侦查主智能体" }),
    createLog({ id: "b", agentName: "侦查子智能体 · pdns" }),
    createLog({ id: "c", agentName: "侦查子智能体 · pdns" }),
  ]);

  assert.equal(compacted.length, 1);
  assert.equal(compacted[0].repeatCount, 3);
  assert.deepEqual(compacted[0].detail?.compacted_log_ids, ["a", "b", "c"]);
  assert.deepEqual(compacted[0].detail?.compacted_agent_names, [
    "侦查主智能体",
    "侦查子智能体 · pdns",
  ]);
});

test("compactAgentAuditDisplayLogs keeps tool logs and different timestamps separate", () => {
  const compacted = compactAgentAuditDisplayLogs([
    createLog({ id: "info-a", type: "info", time: "00:00:28" }),
    createLog({ id: "tool-a", type: "tool", title: "已完成：list_files", time: "00:00:28" }),
    createLog({ id: "info-b", type: "info", time: "00:00:29" }),
  ]);

  assert.equal(compacted.length, 3);
  assert.equal(compacted[0].repeatCount, undefined);
  assert.equal(compacted[1].type, "tool");
  assert.equal(compacted[2].time, "00:00:29");
});
