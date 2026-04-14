import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

const taskActivitiesPath = path.join(
	process.cwd(),
	"src/features/tasks/services/taskActivities.ts",
);

test("TaskActivityItem exposes task ids for delete actions", () => {
	const source = readFileSync(taskActivitiesPath, "utf8");
	assert.match(source, /opengrepTaskId\?: string;/);
	assert.match(source, /gitleaksTaskId\?: string;/);
	assert.match(source, /banditTaskId\?: string;/);
	assert.match(source, /phpstanTaskId\?: string;/);
	assert.match(source, /pmdTaskId\?: string;/);
	assert.match(source, /yasaTaskId\?: string;/);
	assert.match(source, /agentTaskId\?: string;/);
});

test("deleteTaskActivity performs interrupt then delete for static engines", () => {
	const source = readFileSync(taskActivitiesPath, "utf8");
	assert.match(source, /interruptOpengrepScanTask/);
	assert.match(source, /deleteOpengrepScanTask/);
	assert.match(source, /interruptGitleaksScanTask/);
	assert.match(source, /deleteGitleaksScanTask/);
	assert.match(source, /interruptBanditScanTask/);
	assert.match(source, /deleteBanditScanTask/);
	assert.match(source, /interruptPhpstanScanTask/);
	assert.match(source, /deletePhpstanScanTask/);
	assert.match(source, /interruptPmdScanTask/);
	assert.match(source, /deletePmdScanTask/);
	assert.match(source, /interruptYasaScanTask/);
	assert.match(source, /deleteYasaScanTask/);
});

test("deleteTaskActivity performs cancel then delete for agent tasks", () => {
	const source = readFileSync(taskActivitiesPath, "utf8");
	assert.match(source, /cancelAgentTask/);
	assert.match(source, /deleteAgentTask/);
	assert.match(source, /if \(!AGENT_TERMINAL_STATUSES\.has\(normalizedStatus\)\)/);
});
