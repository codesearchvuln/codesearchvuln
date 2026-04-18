import test from "node:test";
import assert from "node:assert/strict";

import {
  clearAgentAuditTaskDetailSnapshotStore,
  getAgentAuditTaskDetailSnapshot,
  isAgentAuditTaskDetailSnapshotFresh,
  saveAgentAuditTaskDetailSnapshot,
} from "../src/pages/AgentAudit/taskDetailSnapshotStore.ts";

test.beforeEach(() => {
  clearAgentAuditTaskDetailSnapshotStore();
});

test.after(() => {
  clearAgentAuditTaskDetailSnapshotStore();
});

test("taskDetailSnapshotStore caches task detail state by taskId and clones mutable collections", () => {
  const source = {
    task: { id: "task-1", status: "completed" } as any,
    findings: [{ id: "finding-1" }] as any,
    logs: [{ id: "log-1", title: "done" }] as any,
    agentTree: { nodes: [{ id: "agent-1" }] } as any,
    projectName: "demo-project",
    realtimeFindings: [{ id: "rt-1" }] as any,
    tokenUsage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      seenSequences: new Set([7]),
    },
    afterSequence: 42,
    historicalEventsLoaded: true,
    terminalFailureReason: null,
  };

  const snapshot = saveAgentAuditTaskDetailSnapshot("task-1", source);

  source.findings.push({ id: "finding-2" } as any);
  source.logs.push({ id: "log-2" } as any);
  source.realtimeFindings.push({ id: "rt-2" } as any);
  source.tokenUsage.seenSequences.add(8);

  assert.ok(snapshot);
  assert.ok(isAgentAuditTaskDetailSnapshotFresh(snapshot));

  const cachedSnapshot = getAgentAuditTaskDetailSnapshot("task-1");
  assert.equal(cachedSnapshot?.taskId, "task-1");
  assert.equal(cachedSnapshot?.data.findings.length, 1);
  assert.equal(cachedSnapshot?.data.logs.length, 1);
  assert.equal(cachedSnapshot?.data.realtimeFindings.length, 1);
  assert.deepEqual(
    [...(cachedSnapshot?.data.tokenUsage.seenSequences ?? new Set())],
    [7],
  );
});
