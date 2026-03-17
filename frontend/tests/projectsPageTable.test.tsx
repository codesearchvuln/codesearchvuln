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

test("ProjectsTable renders grouped vulnerability columns and browse-state actions", async () => {
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
	assert.match(markup, /发现漏洞/);
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
	assert.match(markup, /仅 ZIP 类型项目支持代码浏览/);
	assert.doesNotMatch(markup, /序号/);
	assert.doesNotMatch(markup, /全选当前页/);
	assert.doesNotMatch(markup, /选择项目/);
	assert.ok(markup.indexOf("查看详情") < markup.indexOf("代码浏览"));
	assert.ok(markup.indexOf("代码浏览") < markup.indexOf("创建扫描"));
	assert.ok(!markup.includes(">状态<"));
	assert.match(markup, /disabled/);
});
