import test from "node:test";
import assert from "node:assert/strict";

import { fromAgentEvent } from "../src/pages/AgentAudit/realtimeFindingMapper.ts";

test("fromAgentEvent uses finding_id before structural fingerprint when no verification keys", () => {
  const item = fromAgentEvent({
    id: "event-1",
    task_id: "task-1",
    event_type: "finding_update",
    phase: "verification",
    message: "finding update",
    tool_name: null,
    tool_duration_ms: null,
    finding_id: "db-finding-42",
    sequence: 1,
    timestamp: "2026-04-21T00:00:00.000Z",
    metadata: {
      finding_scope: "verification_queue",
      id: "metadata-finding-id",
      status: "verified",
      vulnerability_type: "SQL Injection",
      file_path: "src/api/user.ts",
      line_start: 10,
      severity: "high",
    },
  } as any);

  assert.ok(item);
  assert.equal(item?.merge_key, "db-finding-42");
});

test("fromAgentEvent keeps verification_todo_id as highest-priority merge key", () => {
  const item = fromAgentEvent({
    id: "event-2",
    task_id: "task-1",
    event_type: "finding_update",
    phase: "verification",
    message: "finding update",
    tool_name: null,
    tool_duration_ms: null,
    finding_id: "db-finding-43",
    sequence: 2,
    timestamp: "2026-04-21T00:00:00.000Z",
    metadata: {
      finding_scope: "verification_queue",
      verification_todo_id: "todo-123",
      verification_fingerprint: "fp-123",
      status: "verified",
      vulnerability_type: "SQL Injection",
      file_path: "src/api/user.ts",
      line_start: 10,
      severity: "high",
    },
  } as any);

  assert.ok(item);
  assert.equal(item?.merge_key, "todo-123");
});
