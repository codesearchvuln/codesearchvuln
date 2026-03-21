import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ScanConfigEngines from "../src/pages/ScanConfigEngines.tsx";

globalThis.React = React;

test("ScanConfigEngines renders phpstan rules page when tab=phpstan", () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/scan-config/engines?tab=phpstan"] },
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

  assert.match(markup, /扩展包数量/);
  assert.match(markup, /规则来源数量/);
  assert.match(markup, /筛选规则/);
  assert.match(markup, /aria-label="筛选启用状态"/);
});
