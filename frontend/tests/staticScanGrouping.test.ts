import assert from "node:assert/strict";
import test from "node:test";

import {
	buildStaticScanGroups,
	resolveStaticScanGroupStatus,
} from "../src/features/tasks/services/staticScanGrouping.ts";

test("pairs opengrep and gitleaks created within the pairing window", () => {
	const groups = buildStaticScanGroups({
		opengrepTasks: [
			{
				id: "op-1",
				project_id: "project-1",
				status: "completed",
				created_at: "2026-03-07T10:00:00.000Z",
			},
		],
		gitleaksTasks: [
			{
				id: "gt-1",
				project_id: "project-1",
				status: "completed",
				created_at: "2026-03-07T10:00:20.000Z",
			},
		],
	});

	assert.equal(groups.length, 1);
	assert.equal(groups[0]?.opengrepTask?.id, "op-1");
	assert.equal(groups[0]?.gitleaksTask?.id, "gt-1");
});

test("keeps gitleaks-only static scans as standalone groups", () => {
	const groups = buildStaticScanGroups({
		opengrepTasks: [],
		gitleaksTasks: [
			{
				id: "gt-only",
				project_id: "project-1",
				status: "running",
				created_at: "2026-03-07T10:02:00.000Z",
			},
		],
	});

	assert.equal(groups.length, 1);
	assert.equal(groups[0]?.opengrepTask, undefined);
	assert.equal(groups[0]?.gitleaksTask?.id, "gt-only");
});

test("treats any running engine in a grouped static scan as running", () => {
	const status = resolveStaticScanGroupStatus({
		projectId: "project-1",
		createdAt: "2026-03-07T10:00:00.000Z",
		opengrepTask: {
			id: "op-1",
			project_id: "project-1",
			status: "completed",
			created_at: "2026-03-07T10:00:00.000Z",
		},
		gitleaksTask: {
			id: "gt-1",
			project_id: "project-1",
			status: "running",
			created_at: "2026-03-07T10:00:10.000Z",
		},
	});

	assert.equal(status, "running");
});

test("treats a grouped static scan as completed only when all engines complete", () => {
	const completed = resolveStaticScanGroupStatus({
		projectId: "project-1",
		createdAt: "2026-03-07T10:00:00.000Z",
		opengrepTask: {
			id: "op-1",
			project_id: "project-1",
			status: "completed",
			created_at: "2026-03-07T10:00:00.000Z",
		},
		gitleaksTask: {
			id: "gt-1",
			project_id: "project-1",
			status: "completed",
			created_at: "2026-03-07T10:00:10.000Z",
		},
	});
	const failed = resolveStaticScanGroupStatus({
		projectId: "project-1",
		createdAt: "2026-03-07T10:00:00.000Z",
		opengrepTask: {
			id: "op-2",
			project_id: "project-1",
			status: "completed",
			created_at: "2026-03-07T10:00:00.000Z",
		},
		gitleaksTask: {
			id: "gt-2",
			project_id: "project-1",
			status: "failed",
			created_at: "2026-03-07T10:00:10.000Z",
		},
	});

	assert.equal(completed, "completed");
	assert.equal(failed, "other");
});
