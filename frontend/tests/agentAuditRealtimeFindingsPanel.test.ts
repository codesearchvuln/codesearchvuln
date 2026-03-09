import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

function read(relativePath: string) {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("realtime findings panel uses simplified single-shell layout", () => {
	const content = read(
		"src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx",
	);

	assert.doesNotMatch(
		content,
		/>漏洞列表</,
		"panel should remove the standalone 漏洞列表 title row",
	);
	assert.match(
		content,
		/className="rounded-xl border border-border\/70 bg-card\/50"/,
		"panel should adopt the lighter event-log style outer shell",
	);
	assert.match(
		content,
		/className="flex flex-wrap items-center gap-3 border-b border-border\/70 px-4 py-3"/,
		"panel should render the filters inside a toolbar-style header",
	);
	assert.doesNotMatch(
		content,
		/min-h-0 flex-1 overflow-hidden rounded-md border border-border/,
		"panel should remove the nested bordered table shell",
	);
});

test("realtime findings panel keeps plain text headers and gates detail actions", () => {
	const content = read(
		"src/pages/AgentAudit/components/RealtimeFindingsPanel.tsx",
	);

	assert.doesNotMatch(
		content,
		/headerProgressSummary:\s*RealtimeHeaderProgressSummary/,
		"panel should no longer require header progress summary for decorated headers",
	);
	assert.match(
		content,
		/<TableHead[^>]*className="min-w-\[260px\]"[^>]*data-no-i18n="true"[^>]*>\s*命中位置\s*<\/TableHead>/,
		"location header should be reduced to plain text",
	);
	assert.match(
		content,
		/<TableHead[^>]*className="w-\[120px\]"[^>]*data-no-i18n="true"[^>]*>\s*漏洞危害\s*<\/TableHead>/,
		"severity header should be reduced to plain text",
	);
	assert.match(
		content,
		/未侦察/,
		"processing status should include the pre-recon label",
	);
	assert.match(
		content,
		/已验证/,
		"processing status should still include the verified label",
	);
	assert.match(
		content,
		/disabled=\{props\.isRunning\}/,
		"detail action should be disabled while scan is still running",
	);
	assert.match(
		content,
		/onOpenDetail:\s*\(item: RealtimeMergedFindingItem\) => void/,
		"panel should use a callback detail action so ended scans can open in-page details for realtime items",
	);
});
