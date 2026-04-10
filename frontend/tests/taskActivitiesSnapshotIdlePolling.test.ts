import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const hookPath = path.resolve(
  process.cwd(),
  "src/features/tasks/hooks/useTaskActivitiesSnapshot.ts",
);

test("useTaskActivitiesSnapshot 仅在存在运行中任务且页面可见时轮询", () => {
  const source = fs.readFileSync(hookPath, "utf8");

  assert.match(
    source,
    /if \(!pollingIntervalMs \|\| !hasActiveTasks \|\| document\.hidden\) return;/,
  );
  assert.match(
    source,
    /if \(!document\.hidden\) {\s*void refreshTaskActivitiesSnapshot\(\);\s*}/,
  );
  assert.doesNotMatch(
    source,
    /const interval = Math\.max\(idlePollingIntervalMs, pollingIntervalMs\);/,
  );
});
