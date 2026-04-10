import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("useAgentAuditState trims the log buffer to a fixed upper bound", async () => {
  const module = await import("../src/pages/AgentAudit/hooks/useAgentAuditState.ts");

  assert.equal(module.MAX_AGENT_AUDIT_LOGS, 2000);
  assert.deepEqual(
    module.appendAgentAuditLogWithLimit(
      Array.from({ length: 2000 }, (_, index) => ({ id: `log-${index}` })),
      { id: "log-next" },
    ).map((item: { id: string }) => item.id),
    [
      "log-1",
      ...Array.from({ length: 1998 }, (_, index) => `log-${index + 2}`),
      "log-next",
    ],
  );
});

test("TaskDetailPage keeps realtime findings state live and clears timers on unmount", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/AgentAudit/TaskDetailPage.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /const \[realtimeFindings, setRealtimeFindings\] = useState<RealtimeMergedFindingItem\[\]>\(\[\]\);/,
  );
  assert.match(
    source,
    /const visibleManagedFindings = useMemo\(\s*\(\) => realtimeFindings,\s*\[realtimeFindings\],\s*\);/s,
  );
  assert.match(
    source,
    /return \(\) => {\s*if \(agentTreeRefreshTimer\.current\) {\s*clearTimeout\(agentTreeRefreshTimer\.current\);/s,
  );
});
