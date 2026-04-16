import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

async function importOrFail<TModule = Record<string, unknown>>(
	relativePath: string,
): Promise<TModule> {
	try {
		return (await import(relativePath)) as TModule;
	} catch (error) {
		assert.fail(
			`expected helper module ${relativePath} to exist: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

test("reduceNexusEmbedLoadState 将错误/超时视为终态失败，只有 reset 才能恢复加载", async () => {
	const module = await importOrFail<{
		reduceNexusEmbedLoadState: (
			state: "loading" | "ready" | "failed",
			event:
				| "iframe-loaded"
				| "iframe-error"
				| "load-timeout"
				| "reset",
		) => "loading" | "ready" | "failed";
	}>("../src/shared/nexusEmbedLoadState.ts");

	assert.equal(
		module.reduceNexusEmbedLoadState("loading", "iframe-loaded"),
		"ready",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("loading", "iframe-error"),
		"failed",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("loading", "load-timeout"),
		"failed",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("failed", "iframe-loaded"),
		"failed",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("failed", "iframe-error"),
		"failed",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("failed", "load-timeout"),
		"failed",
	);
	assert.equal(
		module.reduceNexusEmbedLoadState("failed", "reset"),
		"loading",
	);
});

test("AgentAudit 首页在 GitNexus 背景加载失败后停止继续挂载 iframe", () => {
	const source = fs.readFileSync(
		path.resolve(process.cwd(), "src/pages/AgentAudit/index.tsx"),
		"utf8",
	);

	assert.match(source, /reduceNexusEmbedLoadState/);
	assert.match(source, /GitNexus 背景加载失败，已停止继续加载。/);
	assert.match(source, /nexusIframeState !== "failed" \?/);
	assert.match(source, /dispatchNexusIframeState\("load-timeout"\)/);
	assert.match(source, /dispatchNexusIframeState\("iframe-error"\)/);
});

test("ProjectDetail 在 nexus-item-detail 加载失败后停止继续挂载 iframe", () => {
	const source = fs.readFileSync(
		path.resolve(process.cwd(), "src/pages/ProjectDetail.tsx"),
		"utf8",
	);

	assert.match(source, /reduceNexusEmbedLoadState/);
	assert.match(source, /项目详情背景加载失败，已停止继续加载。/);
	assert.match(source, /itemDetailIframeState !== "failed" \?/);
	assert.match(source, /dispatchItemDetailIframeState\("load-timeout"\)/);
	assert.match(source, /dispatchItemDetailIframeState\("iframe-error"\)/);
});
