import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const opengrepRulesPath = path.join(frontendDir, "src/pages/OpengrepRules.tsx");

test("OpengrepRules 补丁规则生成队列查看框不再使用渐变背景", () => {
	const source = readFileSync(opengrepRulesPath, "utf8");

	assert.match(
		source,
		/className="border-b border-cyan-500\/30 bg-background\/70"/,
	);
	assert.doesNotMatch(
		source,
		/className="border-b border-cyan-500\/30 bg-gradient-to-r from-blue-950\/40 to-cyan-950\/40"/,
	);
});
