import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve(
  process.cwd(),
  "src/pages/StaticAnalysis.tsx",
);

test("StaticAnalysis 详情回跳路径基于即时 tableState 构造，避免 URL 同步窗口期", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /mergeDataTableUrlState\(/);
  assert.match(source, /const findingsCurrentRoute = useMemo\(/);
  assert.match(source, /currentRoute=\{findingsCurrentRoute\}/);
});
