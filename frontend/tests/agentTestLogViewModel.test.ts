import test from "node:test";
import assert from "node:assert/strict";

import {
  formatAgentTestEventMessage,
  shouldShowAgentTestEvent,
} from "../src/pages/agent-test/eventLogUtils.ts";
import type { SseEvent } from "../src/pages/agent-test/types.ts";

function createEvent(overrides: Partial<SseEvent> = {}): SseEvent {
  return {
    id: 1,
    type: "info",
    message: "hello",
    ts: 1_700_000_000,
    ...overrides,
  };
}

test("shouldShowAgentTestEvent hides skipped and empty collapsible events", () => {
  assert.equal(
    shouldShowAgentTestEvent(createEvent({ type: "thinking_token" })),
    false,
  );
  assert.equal(
    shouldShowAgentTestEvent(createEvent({ type: "llm_thought", message: "  " })),
    false,
  );
  assert.equal(
    shouldShowAgentTestEvent(createEvent({ type: "tool_call" })),
    true,
  );
});

test("formatAgentTestEventMessage formats tool calls and tool results", () => {
  assert.equal(
    formatAgentTestEventMessage(
      createEvent({
        type: "tool_call",
        tool_name: "search_code",
        tool_input: { query: "password" },
      }),
    ),
    'search_code({"query":"password"})',
  );

  assert.equal(
    formatAgentTestEventMessage(
      createEvent({
        type: "tool_result",
        tool_name: "search_code",
        tool_output: "match found",
      }),
    ),
    "search_code → match found",
  );
});

test("formatAgentTestEventMessage truncates oversized tool payloads and result payloads", () => {
  const longInput = { data: "x".repeat(250) };
  const longOutput = "y".repeat(320);

  assert.match(
    formatAgentTestEventMessage(
      createEvent({
        type: "tool_call",
        tool_name: "sandbox_exec",
        tool_input: longInput,
      }),
    ),
    /^sandbox_exec\(.+…\)$/,
  );

  assert.match(
    formatAgentTestEventMessage(
      createEvent({
        type: "tool_result",
        tool_name: "sandbox_exec",
        tool_output: longOutput,
      }),
    ),
    /^sandbox_exec → .+…$/,
  );
});
