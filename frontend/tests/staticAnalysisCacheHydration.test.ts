import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const hookPath = path.resolve(
  process.cwd(),
  "src/pages/static-analysis/useStaticAnalysisData.ts",
);

test("useStaticAnalysisData 从 snapshot store 预热任务和漏洞列表，避免回跳后立即重拉", () => {
  const source = fs.readFileSync(hookPath, "utf8");

  assert.match(source, /getStaticAnalysisTaskSnapshot/);
  assert.match(source, /getStaticAnalysisFindingsSnapshot/);
  assert.match(source, /isStaticAnalysisSnapshotFresh/);
  assert.match(source, /requestStaticAnalysisTaskSnapshot/);
  assert.match(source, /requestStaticAnalysisFindingsSnapshot/);
});
