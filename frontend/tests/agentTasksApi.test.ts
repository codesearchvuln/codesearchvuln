import test from "node:test";
import assert from "node:assert/strict";

import { apiClient } from "../src/shared/api/serverClient.ts";
import { updateAgentFindingStatus } from "../src/shared/api/agentTasks.ts";

test("updateAgentFindingStatus 调用 /status 路径并通过 query 传递状态", async () => {
  const originalPatch = apiClient.patch;
  const calls: Array<{ url: string; payload: unknown; config: unknown }> = [];

  apiClient.patch = (async (url: string, payload?: unknown, config?: unknown) => {
    calls.push({ url, payload, config });
    return {
      data: {
        message: "状态已更新",
        finding_id: "finding-1",
        status: "false_positive",
      },
    };
  }) as typeof apiClient.patch;

  try {
    const result = await updateAgentFindingStatus(
      "task-1",
      "finding-1",
      "false_positive",
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "/agent-tasks/task-1/findings/finding-1/status");
    assert.equal(calls[0]?.payload, undefined);
    assert.deepEqual(calls[0]?.config, {
      params: {
        status: "false_positive",
      },
    });
    assert.deepEqual(result, {
      message: "状态已更新",
      finding_id: "finding-1",
      status: "false_positive",
    });
  } finally {
    apiClient.patch = originalPatch;
  }
});
