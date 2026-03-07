import test from "node:test";
import assert from "node:assert/strict";

import {
	TASK_ACTIVITIES_TABLE_COLSPAN,
	TASK_ACTIVITIES_TABLE_HEADERS,
} from "../src/features/tasks/components/taskActivitiesTableConfig.ts";

test("task activities table removes scan task column and keeps 8 columns", () => {
	assert.deepEqual(TASK_ACTIVITIES_TABLE_HEADERS, [
		"序号",
		"扫描项目",
		"创建时间",
		"用时",
		"扫描进度",
		"扫描状态",
		"缺陷统计",
		"操作",
	]);
	assert.equal(TASK_ACTIVITIES_TABLE_HEADERS.includes("扫描任务"), false);
	assert.equal(TASK_ACTIVITIES_TABLE_COLSPAN, 8);
});
