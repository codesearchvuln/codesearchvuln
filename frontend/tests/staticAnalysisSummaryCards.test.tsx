import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.React = React;

test("StaticAnalysisSummaryCards keeps the initial zero-progress state pending while tasks are still loading", async () => {
  const summaryCardsModule = await import(
    "../src/pages/static-analysis/StaticAnalysisSummaryCards.tsx"
  );

  const markup = renderToStaticMarkup(
    createElement(summaryCardsModule.StaticAnalysisSummaryCards, {
      opengrepTask: null,
      gitleaksTask: null,
      banditTask: null,
      phpstanTask: null,
      yasaTask: null,
      enabledEngines: ["opengrep"],
      loadingInitial: true,
    }),
  );

  assert.match(markup, /0%/);
  assert.match(markup, /任务待处理/);
  assert.match(markup, /扫描排队中，等待引擎启动/);
  assert.doesNotMatch(markup, /任务失败/);
  assert.doesNotMatch(markup, /存在失败引擎/);
});
