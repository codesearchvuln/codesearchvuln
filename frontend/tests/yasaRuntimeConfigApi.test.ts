import test from "node:test";
import assert from "node:assert/strict";

import { apiClient } from "../src/shared/api/serverClient.ts";
import { getYasaRuntimeConfig, updateYasaRuntimeConfig } from "../src/shared/api/yasa.ts";

test("yasa runtime config api uses expected endpoints", async () => {
  const originalGet = apiClient.get;
  const originalPut = apiClient.put;

  const calls: Array<{ method: "get" | "put"; url: string; payload?: unknown }> = [];

  apiClient.get = (async (url: string) => {
    calls.push({ method: "get", url });
    return {
      data: {
        yasa_timeout_seconds: 600,
        yasa_orphan_stale_seconds: 120,
        yasa_exec_heartbeat_seconds: 15,
        yasa_process_kill_grace_seconds: 2,
      },
    };
  }) as typeof apiClient.get;

  apiClient.put = (async (url: string, payload?: unknown) => {
    calls.push({ method: "put", url, payload });
    return { data: payload };
  }) as typeof apiClient.put;

  try {
    const runtime = await getYasaRuntimeConfig();
    assert.equal(runtime.yasa_timeout_seconds, 600);

    const updatePayload = {
      yasa_timeout_seconds: 700,
      yasa_orphan_stale_seconds: 180,
      yasa_exec_heartbeat_seconds: 20,
      yasa_process_kill_grace_seconds: 3,
    };
    const updated = await updateYasaRuntimeConfig(updatePayload);
    assert.equal(updated.yasa_timeout_seconds, 700);

    assert.deepEqual(calls[0], {
      method: "get",
      url: "/static-tasks/yasa/runtime-config",
    });
    assert.deepEqual(calls[1], {
      method: "put",
      url: "/static-tasks/yasa/runtime-config",
      payload: updatePayload,
    });
  } finally {
    apiClient.get = originalGet;
    apiClient.put = originalPut;
  }
});
