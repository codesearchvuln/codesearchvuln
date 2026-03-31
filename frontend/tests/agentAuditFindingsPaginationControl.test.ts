import test from "node:test";
import assert from "node:assert/strict";

import {
	resolveAgentAuditPaginationTransition,
} from "../src/pages/AgentAudit/detailViewModel.ts";

test("layout-driven findings page-size changes stay local and do not request route sync", () => {
	const next = resolveAgentAuditPaginationTransition({
		current: {
			page: 1,
			pageSize: 3,
		},
		update: {
			pageSize: 7,
		},
		source: "layout",
	});

	assert.deepEqual(next.state, {
		page: 1,
		pageSize: 7,
	});
	assert.equal(next.routeSync, null);
});

test("user-driven findings pagination changes still sync the route", () => {
	const next = resolveAgentAuditPaginationTransition({
		current: {
			page: 2,
			pageSize: 7,
		},
		update: {
			page: 3,
		},
		source: "user",
	});

	assert.deepEqual(next.state, {
		page: 3,
		pageSize: 7,
	});
	assert.deepEqual(next.routeSync, {
		page: 3,
		pageSize: 7,
	});
});
