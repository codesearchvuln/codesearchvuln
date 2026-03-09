import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import RealtimeFindingsPanel, {
	type RealtimeMergedFindingItem,
} from "../src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx";
import type { FindingsViewFilters } from "../src/pages/AgentAudit/types.ts";

globalThis.React = React;

const filters: FindingsViewFilters = {
	keyword: "",
	severity: "all",
	verification: "all",
};

const items: RealtimeMergedFindingItem[] = [
	{
		id: "finding-1",
		fingerprint: "fingerprint-1",
		title: "SQL 注入",
		severity: "high",
		display_severity: "high",
		verification_progress: "pending",
		vulnerability_type: "SQL Injection",
		file_path: "src/api/user.ts",
		line_start: 18,
		line_end: 18,
		confidence: 0.92,
		is_verified: false,
	},
];

test("RealtimeFindingsPanel 的命中位置和漏洞危害表头保持精简且禁用自动翻译", () => {
	const markup = renderToStaticMarkup(
		createElement(RealtimeFindingsPanel, {
			taskId: "task-1",
			items,
			isRunning: false,
			currentPhase: null,
			filters,
			onFiltersChange: () => {},
			onOpenDetail: () => {},
		}),
	);

	assert.match(markup, /<th[^>]*data-no-i18n="true"[^>]*>命中位置<\/th>/);
	assert.match(markup, /<th[^>]*data-no-i18n="true"[^>]*>漏洞危害<\/th>/);
	assert.doesNotMatch(markup, />命中位置[^<]+</);
	assert.doesNotMatch(markup, />漏洞危害[^<]+</);
});
