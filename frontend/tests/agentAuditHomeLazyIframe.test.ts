import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const homePagePath = path.resolve(
  process.cwd(),
  "src/pages/AgentAudit/index.tsx",
);

test("AgentAudit 首页仍保留惰性加载，但改为加载主前端承载的 Nexus 页面", () => {
  const source = fs.readFileSync(homePagePath, "utf8");

  assert.match(
    source,
    /const \[isNexusLoaded, setIsNexusLoaded\] = useState\(false\);/,
  );
  assert.match(source, /const iframePath = "\/nexus\/";/);
  assert.match(source, /setIsNexusLoaded\(true\)/);
  assert.match(source, /加载 GitNexus 页面/);
  assert.match(source, /主前端承载本地静态产物/);
  assert.doesNotMatch(source, /window\.location\.hostname\}:5174/);
});
