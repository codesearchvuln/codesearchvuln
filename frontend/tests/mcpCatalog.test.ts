import test from "node:test";
import assert from "node:assert/strict";

import {
	DEFAULT_MCP_CATALOG,
	normalizeMcpCatalog,
} from "../src/pages/intelligent-scan/mcpCatalog.ts";

test("DEFAULT_MCP_CATALOG no longer exposes code_index", () => {
	assert.deepEqual(
		DEFAULT_MCP_CATALOG.map((item) => item.id),
		["filesystem"],
	);
});

test("normalizeMcpCatalog falls back to filesystem-only defaults", () => {
	const normalized = normalizeMcpCatalog([]);

	assert.deepEqual(
		normalized.map((item) => item.id),
		["filesystem"],
	);
});
