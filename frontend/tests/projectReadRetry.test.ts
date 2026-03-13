import test from "node:test";
import assert from "node:assert/strict";

import { resolveErrorBoundaryViewModel } from "../src/components/common/errorBoundaryState.ts";
import { retryProjectReads } from "../src/shared/api/retryProjectReads.ts";

function createAxiosLikeError(message: string, extras: Record<string, unknown> = {}) {
  const error = new Error(message) as Error & Record<string, unknown>;
  error.isAxiosError = true;
  error.config = { url: "/api/v1/projects/" };
  Object.assign(error, extras);
  return error;
}

test("retryProjectReads retries dev proxy ECONNREFUSED errors until success", async () => {
  let attempts = 0;

  const result = await retryProjectReads(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw createAxiosLikeError("connect ECONNREFUSED 172.18.0.4:8000");
      }
      return "ok";
    },
    {
      delaysMs: [0, 0, 0],
      timeoutMs: 1000,
      sleep: async () => {},
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retryProjectReads retries 503 responses until success", async () => {
  let attempts = 0;

  const result = await retryProjectReads(
    async () => {
      attempts += 1;
      if (attempts < 2) {
        throw createAxiosLikeError("Request failed with status code 503", {
          response: { status: 503 },
        });
      }
      return "ready";
    },
    {
      delaysMs: [0, 0],
      timeoutMs: 1000,
      sleep: async () => {},
    },
  );

  assert.equal(result, "ready");
  assert.equal(attempts, 2);
});

test("retryProjectReads does not retry non-retryable project read errors", async () => {
  let attempts = 0;
  const error = createAxiosLikeError("Request failed with status code 400", {
    response: { status: 400 },
  });

  await assert.rejects(
    async () =>
      retryProjectReads(
        async () => {
          attempts += 1;
          throw error;
        },
        {
          delaysMs: [0, 0, 0],
          timeoutMs: 1000,
          sleep: async () => {},
        },
      ),
    (caught) => {
      assert.equal(caught, error);
      return true;
    },
  );

  assert.equal(attempts, 1);
});

test("retryProjectReads preserves backend-offline fallback after retry budget exhaustion", async () => {
  let attempts = 0;
  const error = createAxiosLikeError("Network Error");

  await assert.rejects(
    async () =>
      retryProjectReads(
        async () => {
          attempts += 1;
          throw error;
        },
        {
          delaysMs: [0, 0, 0],
          timeoutMs: 1000,
          sleep: async () => {},
        },
      ),
    (caught) => {
      assert.equal(caught, error);
      const state = resolveErrorBoundaryViewModel(caught);
      assert.equal(state.variant, "backend-offline");
      return true;
    },
  );

  assert.equal(attempts, 3);
});
