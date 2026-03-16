import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const projectsPagePath = path.join(
	frontendDir,
	"src/pages/projects/ProjectsPage.tsx",
);

test("ProjectsPage 的项目浏览外层容器不再渲染 cyber-card 外框", () => {
	const source = readFileSync(projectsPagePath, "utf8");

	assert.match(source, /id="project-browser"/);
	assert.doesNotMatch(
		source,
		/id="project-browser"[\s\S]*className="cyber-card p-4 relative z-10 flex flex-col flex-1 min-h-\[65vh\]"/,
	);
});
