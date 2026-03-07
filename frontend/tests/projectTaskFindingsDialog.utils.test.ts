import test from "node:test";
import assert from "node:assert/strict";

import {
	filterTaskFindings,
	paginateTaskFindings,
	sortTaskFindings,
	type TaskFindingRow,
} from "../src/pages/project-detail/components/projectTaskFindingsDialog.utils.ts";

test("sortTaskFindings sorts intelligent findings by severity, confidence, then createdAt desc", () => {
	const rows: TaskFindingRow[] = [
		{
			id: "low-new",
			taskId: "task-1",
			taskCategory: "intelligent",
			title: "Low issue",
			filePath: "src/c.ts",
			line: 9,
			severity: "LOW",
			confidence: "HIGH",
			route: "/finding-detail/agent/task-1/low-new",
			createdAt: "2026-03-07T09:00:00.000Z",
		},
		{
			id: "critical-medium",
			taskId: "task-1",
			taskCategory: "intelligent",
			title: "Critical medium",
			filePath: "src/a.ts",
			line: 2,
			severity: "CRITICAL",
			confidence: "MEDIUM",
			route: "/finding-detail/agent/task-1/critical-medium",
			createdAt: "2026-03-07T08:00:00.000Z",
		},
		{
			id: "critical-high-old",
			taskId: "task-1",
			taskCategory: "intelligent",
			title: "Critical high old",
			filePath: "src/b.ts",
			line: 6,
			severity: "CRITICAL",
			confidence: "HIGH",
			route: "/finding-detail/agent/task-1/critical-high-old",
			createdAt: "2026-03-07T07:00:00.000Z",
		},
		{
			id: "critical-high-new",
			taskId: "task-1",
			taskCategory: "intelligent",
			title: "Critical high new",
			filePath: "src/d.ts",
			line: 11,
			severity: "CRITICAL",
			confidence: "HIGH",
			route: "/finding-detail/agent/task-1/critical-high-new",
			createdAt: "2026-03-07T10:00:00.000Z",
		},
	];

	const sorted = sortTaskFindings(rows);

	assert.deepEqual(
		sorted.map((item) => item.id),
		["critical-high-new", "critical-high-old", "critical-medium", "low-new"],
	);
});

test("sortTaskFindings sorts static findings by severity, confidence, then path and line asc", () => {
	const rows: TaskFindingRow[] = [
		{
			id: "b-path",
			taskId: "task-2",
			taskCategory: "static",
			title: "B path",
			filePath: "src/b.ts",
			line: 12,
			severity: "HIGH",
			confidence: "HIGH",
			route: "/finding-detail/static/task-2/b-path",
			createdAt: null,
		},
		{
			id: "a-line-20",
			taskId: "task-2",
			taskCategory: "static",
			title: "A line 20",
			filePath: "src/a.ts",
			line: 20,
			severity: "HIGH",
			confidence: "HIGH",
			route: "/finding-detail/static/task-2/a-line-20",
			createdAt: null,
		},
		{
			id: "critical-low",
			taskId: "task-2",
			taskCategory: "static",
			title: "Critical low",
			filePath: "src/z.ts",
			line: 1,
			severity: "CRITICAL",
			confidence: "LOW",
			route: "/finding-detail/static/task-2/critical-low",
			createdAt: null,
		},
		{
			id: "a-line-10",
			taskId: "task-2",
			taskCategory: "static",
			title: "A line 10",
			filePath: "src/a.ts",
			line: 10,
			severity: "HIGH",
			confidence: "HIGH",
			route: "/finding-detail/static/task-2/a-line-10",
			createdAt: null,
		},
	];

	const sorted = sortTaskFindings(rows);

	assert.deepEqual(
		sorted.map((item) => item.id),
		["critical-low", "a-line-10", "a-line-20", "b-path"],
	);
});

test("filterTaskFindings filters by severity and confidence and paginate keeps continuous numbering", () => {
	const rows: TaskFindingRow[] = Array.from({ length: 15 }, (_, index) => ({
		id: `row-${index + 1}`,
		taskId: "task-3",
		taskCategory: "hybrid",
		title: `Issue ${index + 1}`,
		filePath: `src/${String(index + 1).padStart(2, "0")}.ts`,
		line: index + 1,
		severity: index < 12 ? "HIGH" : "LOW",
		confidence: index % 2 === 0 ? "HIGH" : "MEDIUM",
		route: `/finding-detail/agent/task-3/row-${index + 1}`,
		createdAt: `2026-03-07T${String(index).padStart(2, "0")}:00:00.000Z`,
	}));

	const filtered = filterTaskFindings(sortTaskFindings(rows), "HIGH", "MEDIUM");
	const page2 = paginateTaskFindings(filtered, 2, 10);

	assert.equal(filtered.length, 6);
	assert.equal(page2.items.length, 0);

	const page1 = paginateTaskFindings(filtered, 1, 10);
	assert.equal(page1.items[0]?.id, "row-12");
	assert.equal(page1.startIndex, 0);
	assert.equal(page1.totalPages, 1);
	assert.equal(page1.totalItems, 6);
	assert.deepEqual(
		page1.items.map((item) => item.id),
		["row-12", "row-10", "row-8", "row-6", "row-4", "row-2"],
	);
});
