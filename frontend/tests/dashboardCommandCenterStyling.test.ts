import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const dashboardCommandCenterPath = path.join(
	frontendDir,
	"src/features/dashboard/components/DashboardCommandCenter.tsx",
);

test("DashboardCommandCenter uses shared card tokens and avoids gradient dashboard surfaces", () => {
	const source = readFileSync(dashboardCommandCenterPath, "utf8");

	assert.match(
		source,
		/const DASHBOARD_PANEL_CLASSNAME =\s*"rounded-sm border border-border bg-card text-card-foreground shadow-sm"/,
	);
	assert.match(
		source,
		/className="px-1 py-1 text-foreground xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden"/,
	);
	assert.doesNotMatch(source, /bg-\[radial-gradient/);
	assert.doesNotMatch(source, /bg-\[linear-gradient/);
	assert.doesNotMatch(source, /bg-gradient-to-r/);
	assert.doesNotMatch(source, /<linearGradient/);
});
