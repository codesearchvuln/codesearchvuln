import test from "node:test";
import assert from "node:assert/strict";

import {
  appendReturnTo,
  buildAgentFindingDetailRoute,
  buildProjectCodeBrowserRoute,
  resolveFindingDetailBackTarget,
} from "../src/shared/utils/findingRoute.ts";

test("buildAgentFindingDetailRoute preserves task detail pagination in returnTo", () => {
  const route = buildAgentFindingDetailRoute({
    taskId: "task-1",
    findingId: "finding-1",
    currentRoute:
      "/agent-audit/task-1?muteToast=1&returnTo=%2Ftasks%2Fintelligent&findingsPage=3&findingsPageSize=7&detailType=finding&detailId=finding-1",
  });

  const url = new URL(`http://localhost${route}`);
  assert.equal(
    url.searchParams.get("returnTo"),
    "/agent-audit/task-1?muteToast=1&returnTo=%2Ftasks%2Fintelligent&findingsPage=3&findingsPageSize=7",
  );
});

test("resolveFindingDetailBackTarget prefers explicit returnTo over history back", () => {
  const target = resolveFindingDetailBackTarget({
    returnTo:
      "/agent-audit/task-1?muteToast=1&returnTo=%2Ftasks%2Fintelligent&findingsPage=3&findingsPageSize=7",
    hasHistory: true,
    state: {
      fromTaskDetail: true,
      preferHistoryBack: true,
    },
  });

  assert.equal(
    target,
    "/agent-audit/task-1?muteToast=1&returnTo=%2Ftasks%2Fintelligent&findingsPage=3&findingsPageSize=7",
  );
});

test("buildProjectCodeBrowserRoute appends file and line query for deep links", () => {
  const route = buildProjectCodeBrowserRoute({
    projectId: "project-zip",
    filePath: "src/main.ts",
    line: 42,
  });

  const url = new URL(`http://localhost${route}`);
  assert.equal(url.pathname, "/projects/project-zip/code-browser");
  assert.equal(url.searchParams.get("file"), "src/main.ts");
  assert.equal(url.searchParams.get("line"), "42");
});

test("buildProjectCodeBrowserRoute omits invalid line while keeping file query", () => {
  const route = buildProjectCodeBrowserRoute({
    projectId: "project-zip",
    filePath: "src/main.ts",
    line: null,
  });

  const url = new URL(`http://localhost${route}`);
  assert.equal(url.searchParams.get("file"), "src/main.ts");
  assert.equal(url.searchParams.has("line"), false);
});

test("appendReturnTo preserves namespaced table state query in returnTo", () => {
  const route = appendReturnTo(
    "/finding-detail/static/task-1/finding-1?engine=opengrep",
    "/projects/project-1?pv_page=3&pv_pageSize=20&pv_sort=severity&pv_order=desc",
  );

  const url = new URL(`http://localhost${route}`);
  assert.equal(
    url.searchParams.get("returnTo"),
    "/projects/project-1?pv_page=3&pv_pageSize=20&pv_sort=severity&pv_order=desc",
  );
});
