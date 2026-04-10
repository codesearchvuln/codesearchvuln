import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_EXTERNAL_TOOLS_URL_STATE,
  mergeExternalToolsUrlState,
  parseExternalToolsUrlState,
} from "../src/pages/intelligent-scan/externalToolsUrlState.ts";

test("parseExternalToolsUrlState restores page, search, type, and status from query", () => {
  const state = parseExternalToolsUrlState(
    new URLSearchParams("page=4&q=prompt&type=prompt-custom&status=enabled"),
  );

  assert.deepEqual(state, {
    page: 4,
    searchQuery: "prompt",
    typeFilter: "prompt-custom",
    statusFilter: "enabled",
  });
});

test("parseExternalToolsUrlState falls back to defaults for invalid values", () => {
  const state = parseExternalToolsUrlState(
    new URLSearchParams("page=0&type=unknown&status=weird"),
  );

  assert.deepEqual(state, DEFAULT_EXTERNAL_TOOLS_URL_STATE);
});

test("mergeExternalToolsUrlState omits default values and preserves unrelated params", () => {
  const params = mergeExternalToolsUrlState(
    new URLSearchParams("tab=keepme&page=9"),
    {
      page: 1,
      searchQuery: "",
      typeFilter: "all",
      statusFilter: "all",
    },
  );

  assert.equal(params.get("tab"), "keepme");
  assert.equal(params.has("page"), false);
  assert.equal(params.has("q"), false);
  assert.equal(params.has("type"), false);
  assert.equal(params.has("status"), false);
});

test("mergeExternalToolsUrlState serializes non-default filters into query", () => {
  const params = mergeExternalToolsUrlState(new URLSearchParams(), {
    page: 3,
    searchQuery: "xml",
    typeFilter: "prompt-builtin",
    statusFilter: "disabled",
  });

  assert.equal(params.get("page"), "3");
  assert.equal(params.get("q"), "xml");
  assert.equal(params.get("type"), "prompt-builtin");
  assert.equal(params.get("status"), "disabled");
});
