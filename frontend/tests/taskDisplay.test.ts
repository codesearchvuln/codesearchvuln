import test from "node:test";
import assert from "node:assert/strict";

test("getTaskDisplayStatusSummary returns unified labels and classes", async () => {
  const { getTaskDisplayStatusSummary } = await import(
    "../src/features/tasks/services/taskDisplay.ts"
  );

  assert.equal(getTaskDisplayStatusSummary("completed").statusLabel, "任务完成");
  assert.equal(
    getTaskDisplayStatusSummary("failed").progressHint,
    "扫描已结束，至少一个引擎失败",
  );
  assert.equal(
    getTaskDisplayStatusSummary("interrupted").badgeClassName,
    "cyber-badge-warning",
  );
});

test("formatTaskDuration shows milliseconds for sub-second durations and hh:mm:ss otherwise", async () => {
  const { formatTaskDuration } = await import(
    "../src/features/tasks/services/taskDisplay.ts"
  );

  assert.equal(formatTaskDuration(532, { showMsWhenSubSecond: true }), "532 ms");
  assert.equal(formatTaskDuration(1_200, { showMsWhenSubSecond: true }), "00:00:01");
  assert.equal(formatTaskDuration(61_000, { showMsWhenSubSecond: true }), "00:01:01");
});
