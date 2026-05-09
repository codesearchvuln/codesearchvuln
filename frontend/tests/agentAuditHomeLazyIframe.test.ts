import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const homePagePath = path.resolve(
  process.cwd(),
  "src/pages/AgentAudit/index.tsx",
);

test("AgentAudit 首页默认挂载独立 GitNexus iframe", () => {
  const source = fs.readFileSync(homePagePath, "utf8");

  assert.match(source, /src=\{`http:\/\/\$\{window\.location\.hostname\}:5174`\}/);
  assert.match(source, /"http:\/\/localhost:5174"/);
  assert.match(source, /title="GitNexus"/);
  assert.doesNotMatch(source, /isNexusLoaded/);
  assert.doesNotMatch(source, /setIsNexusLoaded/);
  assert.doesNotMatch(source, /加载 GitNexus 页面/);
  assert.doesNotMatch(source, /visibilitychange/);
  assert.doesNotMatch(source, /src="\/nexus\/"/);
});
