import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const pagePath = path.join(frontendDir, "src/pages/ProjectDetail.tsx");

test("ProjectDetail 潜在漏洞预览只拉取高信号静态结果首批数据", () => {
	const source = readFileSync(pagePath, "utf8");

	assert.match(source, /getHighSignalOpengrepTaskFindings/);
	assert.match(source, /severity:\s*"ERROR"/);
	assert.match(source, /severity:\s*"WARNING"/);
	assert.match(source, /DETAIL_POTENTIAL_FINDINGS_FETCH_LIMIT = 100/);
	assert.doesNotMatch(source, /getAllOpengrepTaskFindings/);
	assert.doesNotMatch(source, /while \(true\)/);
});
