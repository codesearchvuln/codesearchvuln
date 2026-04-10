import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dashboardPagePath = path.resolve(process.cwd(), "src/pages/Dashboard.tsx");

test("Dashboard 空闲刷新复用 stale 策略且在页面隐藏时暂停", () => {
  const source = fs.readFileSync(dashboardPagePath, "utf8");

  assert.doesNotMatch(source, /force:\s*true/);
  assert.match(source, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(
    source,
    /if \(document\.hidden\) {\s*return;\s*}\s*void loadDashboardData\(\{ silent: true \}\);/,
  );
});
