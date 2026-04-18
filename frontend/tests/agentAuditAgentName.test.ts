import test from "node:test";
import assert from "node:assert/strict";

import * as localization from "../src/pages/AgentAudit/localization.ts";

test("toZhAgentName distinguishes recon host and recon subagent", () => {
	assert.equal(localization.toZhAgentName("Recon"), "侦查主智能体");
	assert.equal(localization.toZhAgentName("ReconAgent"), "侦查主智能体");
	assert.equal(
		localization.toZhAgentName("ReconSubAgent[src/auth]"),
		"侦查子智能体 · src/auth",
	);
	assert.equal(
		localization.toZhAgentName("ReconWorker", {
			agentRole: "recon_subagent",
			moduleName: "src/admin",
		}),
		"侦查子智能体 · src/admin",
	);
});

test("localizeAuditText keeps recon host and recon subagent names distinct", () => {
	assert.equal(
		localization.localizeAuditText("ReconAgent waiting ReconSubAgent"),
		"侦查主智能体 waiting 侦查子智能体",
	);
});
