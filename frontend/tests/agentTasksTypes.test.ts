import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("agentTasks flow engine type keeps the lightweight union shape", () => {
	const source = readFileSync(new URL("../src/shared/api/agentTasks.ts", import.meta.url), "utf8");

	assert.match(source, /engine:\s*"llm_dataflow_estimate"\s*\|\s*string;/);
});
