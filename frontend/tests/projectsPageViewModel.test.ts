import test from "node:test";
import assert from "node:assert/strict";

async function importOrFail<TModule = Record<string, unknown>>(
	relativePath: string,
): Promise<TModule> {
	try {
		return (await import(relativePath)) as TModule;
	} catch (error) {
		assert.fail(
			`expected helper module ${relativePath} to exist: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

test("projects selectors filter by name description and repository url", async () => {
	const selectors = await importOrFail<any>(
		"../src/pages/projects/lib/projectsPageSelectors.ts",
	);

	const projects = [
		{
			id: "1",
			name: "Alpha Repo",
			description: "Handles login",
			repository_url: "https://example.com/alpha.git",
		},
		{
			id: "2",
			name: "Beta Service",
			description: "Contains payment flow",
			repository_url: "https://example.com/beta.git",
		},
	];

	assert.deepEqual(
		selectors.filterProjects(projects, "payment").map((project: any) => project.id),
		["2"],
	);
	assert.deepEqual(
		selectors.filterProjects(projects, "alpha.git").map((project: any) => project.id),
		["1"],
	);
	assert.equal(selectors.filterProjects(projects, "").length, 2);
});

test("projects selectors build compact pagination items with ellipsis", async () => {
	const selectors = await importOrFail<any>(
		"../src/pages/projects/lib/projectsPageSelectors.ts",
	);

	assert.deepEqual(selectors.buildPaginationItems(3, 5), [1, 2, 3, 4, 5]);
	assert.deepEqual(selectors.buildPaginationItems(5, 10), [1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
});

test("projects selectors expose current-page selection summary", async () => {
	const selectors = await importOrFail<any>(
		"../src/pages/projects/lib/projectsPageSelectors.ts",
	);

	const summary = selectors.getCurrentPageSelectionState({
		currentPageProjectIds: ["a", "b", "c"],
		selectedProjectIds: new Set(["a", "c"]),
	});

	assert.equal(summary.isAllSelected, false);
	assert.equal(summary.isSomeSelected, true);
	assert.equal(summary.selectedCount, 2);
});

test("projects view model utilities build project size text and execution stats", async () => {
	const builder = await importOrFail<any>(
		"../src/pages/projects/lib/buildProjectsPageViewModel.ts",
	);

	assert.equal(
		builder.getProjectSizeText({
			status: "ready",
			total: 12345,
			totalFiles: 88,
			slices: [],
		}),
		"88 文件 / 12,345 行",
	);
	assert.equal(
		builder.getProjectSizeText({
			status: "pending",
			total: 0,
			totalFiles: 0,
			slices: [],
		}),
		"统计中...",
	);

	const stats = builder.getProjectExecutionStats({
		auditTasks: [{ status: "completed" }, { status: "running" }],
		agentTasks: [{ status: "pending" }, { status: "completed" }],
		opengrepTasks: [
			{ id: "o1", project_id: "p1", status: "completed", created_at: "2024-01-01T00:00:00Z" },
		],
		gitleaksTasks: [
			{ id: "g1", project_id: "p1", status: "completed", created_at: "2024-01-01T00:00:01Z" },
		],
	});

	assert.deepEqual(stats, { completed: 3, running: 2 });
});
