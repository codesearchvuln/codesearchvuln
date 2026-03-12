import test from "node:test";
import assert from "node:assert/strict";
import React from "react";

globalThis.React = React;

const [{ default: routes }, { SIDEBAR_NAV_GROUPS }] = await Promise.all([
	import("../src/app/routes.tsx"),
	import("../src/app/sidebarNavGroups.ts"),
]);

test("agent test route is grouped under devTest navigation", () => {
	const agentTestRoute = routes.find((route) => route.path === "/agent-test");

	assert.ok(agentTestRoute);
	assert.equal(agentTestRoute.navGroup, "devTest");
});

test("sidebar navigation groups keep the expected parent order", () => {
	assert.deepEqual(
		SIDEBAR_NAV_GROUPS.map((group) => group.id),
		["task", "scanConfig", "devTest"],
	);
});

test("devTest group defaults to the agent test page", () => {
	const devTestGroup = SIDEBAR_NAV_GROUPS.find(
		(group) => group.id === "devTest",
	);

	assert.ok(devTestGroup);
	assert.equal(devTestGroup.defaultEntryPath, "/agent-test");
});
