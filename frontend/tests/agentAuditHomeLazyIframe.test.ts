import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const homePagePath = path.resolve(
  process.cwd(),
  "src/pages/AgentAudit/index.tsx",
);

test("AgentAudit 首页默认挂载主前端承载的 Nexus iframe", () => {
  const source = fs.readFileSync(homePagePath, "utf8");

  assert.match(source, /const iframePath = "\/nexus\/";/);
  assert.match(source, /const iframeOrigin = window\.location\.origin;/);
  assert.match(source, /<iframe[\s\S]*src=\{iframePath\}/);
  assert.doesNotMatch(source, /isNexusLoaded/);
  assert.doesNotMatch(source, /setIsNexusLoaded/);
  assert.doesNotMatch(source, /加载 GitNexus 页面/);
  assert.doesNotMatch(source, /visibilitychange/);
  assert.doesNotMatch(source, /window\.location\.hostname\}:5174/);
});
