import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const taskDetailPagePath = path.join(
  frontendDir,
  "src/pages/AgentAudit/TaskDetailPage.tsx",
);

test("TaskDetailPage 导出日志菜单包含本地 ZIP 选项与对应提示文案", () => {
  const source = readFileSync(taskDetailPagePath, "utf8");

  assert.match(source, /async \(format: "json" \| "markdown" \| "local_zip"\)/);
  assert.match(source, /"本地日志已导出为 ZIP"/);
  assert.match(source, /"导出本地日志失败，请重试"/);
  assert.match(source, /handleExportLogs\("local_zip"\)/);
  assert.match(source, /导出本地日志 ZIP/);
});
