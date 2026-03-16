import test from "node:test";
import assert from "node:assert/strict";

import {
	CWE_TREEMAP_COLORS,
	buildCweTreemapNodes,
	getCweTreemapColor,
	getCweTreemapLabelMode,
} from "../src/features/dashboard/components/dashboardCweTreemap";

test("getCweTreemapColor returns a stable palette color for the same cwe id", () => {
	const first = getCweTreemapColor("CWE-79");
	const second = getCweTreemapColor("CWE-79");

	assert.equal(first, second);
	assert.ok(CWE_TREEMAP_COLORS.includes(first));
});

test("CWE_TREEMAP_COLORS uses the approved higher-contrast cool palette", () => {
	assert.deepEqual(CWE_TREEMAP_COLORS, [
		"#1E3A8A",
		"#2456B3",
		"#2C6CC9",
		"#0F5F99",
		"#1576B5",
		"#1A7082",
		"#0F766E",
		"#15928A",
		"#3A4EA1",
		"#2B6788",
		"#116A74",
		"#2E5C9A",
	]);
});

test("getCweTreemapLabelMode separates detailed, compact, and hidden tiles", () => {
	assert.equal(getCweTreemapLabelMode({ width: 124, height: 72 }), "detailed");
	assert.equal(getCweTreemapLabelMode({ width: 68, height: 40 }), "compact");
	assert.equal(getCweTreemapLabelMode({ width: 30, height: 22 }), "hidden");
});

test("buildCweTreemapNodes keeps only cwe entries with positive findings", () => {
	const nodes = buildCweTreemapNodes([
		{
			cwe_id: "CWE-79",
			cwe_name: "跨站脚本",
			total_findings: 3,
			opengrep_findings: 2,
			agent_findings: 1,
			bandit_findings: 0,
		},
		{
			cwe_id: "CWE-89",
			cwe_name: "SQL 注入",
			total_findings: 0,
			opengrep_findings: 0,
			agent_findings: 0,
			bandit_findings: 0,
		},
		{
			cwe_id: "CWE-22",
			cwe_name: "路径遍历",
			total_findings: -4,
			opengrep_findings: 0,
			agent_findings: 0,
			bandit_findings: 0,
		},
	]);

	assert.deepEqual(
		nodes.map((node) => ({
			cweId: node.cweId,
			cweName: node.cweName,
			totalFindings: node.totalFindings,
			size: node.size,
		})),
		[
			{
				cweId: "CWE-79",
				cweName: "跨站脚本",
				totalFindings: 3,
				size: 3,
			},
		],
	);
	assert.equal(nodes[0]?.fill, getCweTreemapColor("CWE-79"));
});
