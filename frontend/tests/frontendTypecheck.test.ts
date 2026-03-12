import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("frontend test tsconfig type-checks cleanly", () => {
  const result = spawnSync(
    process.execPath,
    ["./node_modules/typescript/bin/tsc", "-p", "tsconfig.test.json", "--noEmit"],
    {
      cwd: frontendDir,
      encoding: "utf8",
    },
  );

  const combinedOutput = `${result.stdout}${result.stderr}`.trim();
  assert.equal(result.status, 0, combinedOutput || "tsc exited with a non-zero status");
});
