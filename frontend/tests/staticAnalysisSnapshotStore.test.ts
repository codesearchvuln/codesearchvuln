import test from "node:test";
import assert from "node:assert/strict";

import {
  clearStaticAnalysisSnapshotStore,
  getStaticAnalysisFindingsSnapshot,
  getStaticAnalysisTaskSnapshot,
  isStaticAnalysisSnapshotFresh,
  requestStaticAnalysisFindingsSnapshot,
  requestStaticAnalysisTaskSnapshot,
} from "../src/pages/static-analysis/staticAnalysisSnapshotStore.ts";

test.beforeEach(() => {
  clearStaticAnalysisSnapshotStore();
});

test.after(() => {
  clearStaticAnalysisSnapshotStore();
});

test("staticAnalysisSnapshotStore dedupes in-flight task requests and hydrates cache", async () => {
  let loaderCalls = 0;

  const [first, second] = await Promise.all([
    requestStaticAnalysisTaskSnapshot({
      engine: "opengrep",
      taskId: "task-1",
      loader: async (taskId) => {
        loaderCalls += 1;
        return {
          id: taskId,
          status: "completed",
        };
      },
    }),
    requestStaticAnalysisTaskSnapshot({
      engine: "opengrep",
      taskId: "task-1",
      loader: async (taskId) => ({
        id: taskId,
        status: "completed",
      }),
    }),
  ]);

  assert.equal(loaderCalls, 1);
  assert.equal(first.data.id, "task-1");
  assert.equal(second.data.id, "task-1");
  assert.ok(isStaticAnalysisSnapshotFresh(first));

  const cachedSnapshot = getStaticAnalysisTaskSnapshot<{ id: string }>(
    "opengrep",
    "task-1",
  );
  assert.equal(cachedSnapshot?.data.id, "task-1");
});

test("staticAnalysisSnapshotStore keys findings cache by unified query", async () => {
  const baseQuery = {
    opengrepTaskId: "og-task",
    page: 1,
    pageSize: 20,
    sortBy: "severity" as const,
    sortOrder: "desc" as const,
  };

  await requestStaticAnalysisFindingsSnapshot({
    query: baseQuery,
    loader: async () => ({
      items: [
        {
          key: "opengrep:finding-1",
          id: "finding-1",
          taskId: "og-task",
          engine: "opengrep",
          rule: "python-sqli",
          filePath: "src/app.py",
          line: 12,
          severity: "HIGH",
          severityScore: 3,
          confidence: "HIGH",
          confidenceScore: 3,
          status: "open",
        },
      ],
      total: 1,
    }),
  });

  const matchingSnapshot = getStaticAnalysisFindingsSnapshot(baseQuery);
  const otherPageSnapshot = getStaticAnalysisFindingsSnapshot({
    ...baseQuery,
    page: 2,
  });

  assert.equal(matchingSnapshot?.data.total, 1);
  assert.equal(matchingSnapshot?.data.items[0]?.id, "finding-1");
  assert.equal(otherPageSnapshot, null);
});
