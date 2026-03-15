import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.React = React;

async function importOrFail<TModule = Record<string, unknown>>(
	relativePath: string,
): Promise<TModule> {
	try {
		return (await import(relativePath)) as TModule;
	} catch (error) {
		assert.fail(
			`expected demo module ${relativePath} to exist: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

test("CodeWindowDemo page renders monochrome variant switcher and mock browser content", async () => {
	const pageModule = await importOrFail<any>(
		"../src/pages/CodeWindowDemo.tsx",
	);

	const markup = renderToStaticMarkup(createElement(pageModule.default));

	assert.match(markup, /代码窗 Demo/);
	assert.match(markup, /样式预览/);
	assert.match(markup, /Native Explorer/);
	assert.match(markup, /Terminal Flat/);
	assert.match(markup, /Dense IDE/);
	assert.match(markup, /src\/pages\/AgentAudit\/components\/FindingCodeWindow\.tsx/);
	assert.match(markup, /data-appearance="native-explorer"/);
	assert.match(markup, /data-display-preset="project-browser"/);
	assert.match(markup, /h-\[100dvh\] max-h-\[100dvh\]/);
	assert.match(markup, /flex-1 min-h-0 overflow-hidden/);
	assert.match(markup, /max-h-none/);
	assert.match(markup, /custom-scrollbar-dark/);
});
