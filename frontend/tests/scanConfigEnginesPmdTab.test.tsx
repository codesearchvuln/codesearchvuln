import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Route, Routes } from "react-router-dom";

import ScanConfigEngines from "../src/pages/ScanConfigEngines.tsx";
import { SsrRouter } from "./ssrTestRouter.tsx";

globalThis.React = React;

test("ScanConfigEngines renders pmd rules page when tab=pmd", () => {
  const markup = renderToStaticMarkup(
    createElement(
      SsrRouter,
      { location: "/scan-config/engines?tab=pmd" },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/scan-config/engines",
          element: createElement(ScanConfigEngines),
        }),
      ),
    ),
  );

  // assert.match(markup, /PMD 预设组合/);
  assert.match(markup, /导入 XML ruleset/);
  assert.match(markup, /内置 ruleset/);
});
