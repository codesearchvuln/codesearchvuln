import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve(
  process.cwd(),
  "src/pages/AgentAudit/TaskDetailPage.tsx",
);

test("TaskDetailPage 使用 snapshot store 预热智能/混合扫描详情并在回跳时优先回补增量事件", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /getAgentAuditTaskDetailSnapshot/);
  assert.match(source, /saveAgentAuditTaskDetailSnapshot/);
  assert.match(source, /isAgentAuditTaskDetailSnapshotFresh/);
  assert.match(source, /hydrateTaskDetailSnapshot/);
  assert.match(source, /backfillEventsSince\(\s*cachedSnapshot\.data\.afterSequence/s);
});
