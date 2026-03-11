import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

function read(relativePath: string) {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("FindingDetail 为 Agent 误报预留判定依据专用视图", () => {
	const content = read("src/pages/FindingDetail.tsx");

	assert.match(content, /误报判定依据/);
	assert.match(content, /该问题已在验证阶段判定为误报，不计入有效漏洞/);
	assert.match(content, /该误报未保留可展示代码，仅提供判定结论/);
	assert.match(content, /未生成详细判定说明/);
	assert.match(content, /agentFindingSnapshot/);
	assert.match(content, /setAgentFinding\(agentFindingSnapshot\)/);
});

test("FindingDetail 的 Agent 分支仅在存在真实置信度时渲染置信度徽标", () => {
	const content = read("src/pages/FindingDetail.tsx");

	assert.match(content, /const agentConfidenceLabel = /);
	assert.match(content, /agentConfidenceLabel \? \(/);
	assert.doesNotMatch(
		content,
		/置信度：\{normalizeAgentConfidence\(resolveAgentConfidenceValue\(agentFinding\)\)\}/,
	);
});
