import test from "node:test";
import assert from "node:assert/strict";

import {
	buildAgentFindingDetailNavigation,
	resolveFindingDetailBackTarget,
} from "../src/shared/utils/findingRoute.ts";

test("buildAgentFindingDetailNavigation returns route and prefers history back for task detail flows", () => {
	const result = buildAgentFindingDetailNavigation({
		taskId: "task-1",
		findingId: "finding-2",
		currentRoute: "/agent-audit/task-1?returnTo=%2Ftasks%2Fhybrid&detailType=finding&detailId=finding-2",
	});

	assert.equal(
		result.route,
		"/finding-detail/agent/task-1/finding-2?returnTo=%2Fagent-audit%2Ftask-1%3FreturnTo%3D%252Ftasks%252Fhybrid",
	);
	assert.deepEqual(result.state, {
		fromTaskDetail: true,
		preferHistoryBack: true,
	});
});

test("resolveFindingDetailBackTarget prefers history only when navigation state opts in", () => {
	assert.equal(
		resolveFindingDetailBackTarget({
			returnTo: "/agent-audit/task-1?returnTo=%2Ftasks%2Fintelligent",
			hasHistory: true,
			state: { fromTaskDetail: true, preferHistoryBack: true },
		}),
		-1,
	);

	assert.equal(
		resolveFindingDetailBackTarget({
			returnTo: "/agent-audit/task-1?returnTo=%2Ftasks%2Fintelligent",
			hasHistory: true,
			state: null,
		}),
		"/agent-audit/task-1?returnTo=%2Ftasks%2Fintelligent",
	);

	assert.equal(
		resolveFindingDetailBackTarget({
			returnTo: "",
			hasHistory: true,
			state: null,
		}),
		-1,
	);

	assert.equal(
		resolveFindingDetailBackTarget({
			returnTo: "",
			hasHistory: false,
			state: null,
		}),
		"/dashboard",
	);
});
