import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const homePagePath = path.resolve(
  process.cwd(),
  "src/pages/AgentAudit/index.tsx",
);

test("AgentAudit 首页默认不自动挂载 nexus iframe，而是显式点击后再加载", () => {
  const source = fs.readFileSync(homePagePath, "utf8");

  assert.match(
    source,
    /const \[isNexusLoaded, setIsNexusLoaded\] = useState\(false\);/,
  );
  assert.match(source, /\{isNexusLoaded \? \(/);
  assert.match(source, /setIsNexusLoaded\(true\)/);
  assert.match(source, /加载 GitNexus/);
  assert.doesNotMatch(source, /<iframe[\s\S]*src=\{`http:\/\/\$\{window\.location\.hostname\}:5174`\}/);
});
