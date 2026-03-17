import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

globalThis.React = React;

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

test("ProjectsTable renders compact grouped headers and browse-state actions", async () => {
	const tableModule = await importOrFail<any>(
		"../src/pages/projects/components/ProjectsTable.tsx",
	);

	const markup = renderToStaticMarkup(
		createElement(MemoryRouter, {}, createElement(tableModule.default, {
			rows: [
				{
					id: "p1",
					name: "Demo Project",
					detailPath: "/projects/p1",
					detailState: { from: "/projects" },
					sizeText: "10 文件 / 200 行",
					vulnerabilityStats: {
						critical: 3,
						high: 5,
						medium: 8,
						low: 13,
						total: 29,
					},
					executionStats: { completed: 2, running: 1 },
					actions: {
						canCreateScan: true,
						canBrowseCode: true,
						browseCodePath: "/projects/p1/code-browser",
						browseCodeState: { from: "/projects#project-browser" },
						browseCodeDisabledReason: null,
					},
				},
				{
					id: "p2",
					name: "Disabled Project",
					detailPath: "/projects/p2",
					detailState: { from: "/projects" },
					sizeText: "-",
					vulnerabilityStats: {
						critical: 0,
						high: 1,
						medium: 2,
						low: 3,
						total: 6,
					},
					executionStats: { completed: 0, running: 0 },
					actions: {
						canCreateScan: true,
						canBrowseCode: false,
						browseCodePath: "/projects/p2/code-browser",
						browseCodeState: { from: "/projects#project-browser" },
						browseCodeDisabledReason: "仅 ZIP 类型项目支持代码浏览",
					},
				},
			],
			onCreateScan: () => {},
		})),
	);

	assert.match(markup, /Demo Project/);
	assert.match(markup, /Disabled Project/);
	assert.match(markup, /执行任务/);
	assert.match(markup, /发现漏洞/);
	assert.match(markup, /已完成/);
	assert.match(markup, /进行中/);
	assert.match(markup, /严重/);
	assert.match(markup, /高危/);
	assert.match(markup, /中危/);
	assert.match(markup, /低危/);
	assert.match(markup, /查看详情/);
	assert.match(markup, /代码浏览/);
	assert.match(markup, /创建扫描/);
	assert.match(markup, />3</);
	assert.match(markup, />5</);
	assert.match(markup, />8</);
	assert.match(markup, />13</);
	assert.match(markup, />2</);
	assert.match(markup, />1</);
	assert.match(markup, /仅 ZIP 类型项目支持代码浏览/);
	assert.doesNotMatch(markup, /序号/);
	assert.doesNotMatch(markup, /全选当前页/);
	assert.doesNotMatch(markup, /选择项目/);
	assert.doesNotMatch(markup, /<th[^>]*>已完成<\/th>/);
	assert.doesNotMatch(markup, /<th[^>]*>进行中<\/th>/);
	assert.doesNotMatch(markup, /<th[^>]*>严重<\/th>/);
	assert.doesNotMatch(markup, /<th[^>]*>高危<\/th>/);
	assert.doesNotMatch(markup, /<th[^>]*>中危<\/th>/);
	assert.doesNotMatch(markup, /<th[^>]*>低危<\/th>/);
	assert.match(markup, /data-project-metric-chip="completed"/);
	assert.match(markup, /data-project-metric-chip="running"/);
	assert.match(markup, /data-project-metric-chip="critical"/);
	assert.match(markup, /data-project-metric-chip="high"/);
	assert.match(markup, /data-project-metric-chip="medium"/);
	assert.match(markup, /data-project-metric-chip="low"/);
	assert.match(markup, /inline-grid grid-cols-\[2ch_auto\] items-center gap-1\.5 rounded-md border px-2\.5 py-1/);
	assert.match(markup, /text-right font-semibold tabular-nums text-\[16px\]/);
	assert.match(markup, /whitespace-nowrap text-left text-\[16px\] font-medium/);
	assert.match(markup, />2<\/span><span class="whitespace-nowrap text-left text-\[16px\] font-medium tracking-\[0\.02em\]">已完成<\/span>/);
	assert.match(markup, />1<\/span><span class="whitespace-nowrap text-left text-\[16px\] font-medium tracking-\[0\.02em\]">进行中<\/span>/);
	assert.match(markup, />3<\/span><span class="whitespace-nowrap text-left text-\[16px\] font-medium tracking-\[0\.02em\]">严重<\/span>/);
	assert.doesNotMatch(markup, /text-left font-semibold tabular-nums text-rose-300">3<\/td>/);
	assert.doesNotMatch(markup, /colSpan="2"[^>]*text-center/);
	assert.doesNotMatch(markup, /colSpan="4"[^>]*text-center/);
	assert.doesNotMatch(markup, /<\/thead>[\s\S]*<th[^>]*>已完成<\/th>/);
	assert.ok(markup.indexOf("查看详情") < markup.indexOf("代码浏览"));
	assert.ok(markup.indexOf("代码浏览") < markup.indexOf("创建扫描"));
	assert.ok(!markup.includes(">状态<"));
	assert.match(markup, /disabled/);
});
