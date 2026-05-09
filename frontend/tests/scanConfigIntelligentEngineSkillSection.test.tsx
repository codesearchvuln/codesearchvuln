import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ScanConfigIntelligentEngine from "../src/pages/ScanConfigIntelligentEngine.tsx";
import { SsrRouter } from "./ssrTestRouter.tsx";

globalThis.React = React;

test("ScanConfigIntelligentEngine 展示推理模块与 workflow 并发控制", () => {
	const markup = renderToStaticMarkup(
		createElement(
			SsrRouter,
			null,
			createElement(ScanConfigIntelligentEngine),
		),
	);

	assert.match(markup, /推理模块/);
	assert.match(markup, /Workflow 并发控制/);
	assert.match(markup, /Recon\(SubAgent\) 并发数/);
	assert.match(markup, /Verification 并发数/);
	assert.doesNotMatch(markup, /Prompt Skill 已迁移到外部工具页/);
	assert.doesNotMatch(markup, /Agent 角色/);
	assert.doesNotMatch(markup, /Skill Key/);
	assert.doesNotMatch(markup, /business_logic_recon/);
});
