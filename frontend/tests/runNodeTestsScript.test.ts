import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildNodeTestCommand,
  listDefaultTestFiles,
  normalizeTestArgs,
} from "../scripts/run-node-tests.mjs";

test("listDefaultTestFiles returns sorted .test.ts files only", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "node-tests-"));
  fs.writeFileSync(path.join(tempDir, "b.test.ts"), "");
  fs.writeFileSync(path.join(tempDir, "a.test.ts"), "");
  fs.writeFileSync(path.join(tempDir, "ignore.spec.ts"), "");

  assert.deepEqual(listDefaultTestFiles({ testsDirPath: tempDir }), [
    "tests/a.test.ts",
    "tests/b.test.ts",
  ]);
});

test("normalizeTestArgs strips pnpm separator and resolves bare test filenames", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "node-tests-"));
  fs.writeFileSync(path.join(tempDir, "findingRouteNavigation.test.ts"), "");

  assert.deepEqual(
    normalizeTestArgs(["--", "findingRouteNavigation.test.ts"], { testsDirPath: tempDir }),
    ["tests/findingRouteNavigation.test.ts"],
  );
});

test("buildNodeTestCommand uses node --import tsx --test", () => {
  const command = buildNodeTestCommand(["tests/findingRouteNavigation.test.ts"]);

  assert.equal(command.bin, process.execPath);
  assert.deepEqual(command.args, [
    "--import",
    "tsx",
    "--test",
    "tests/findingRouteNavigation.test.ts",
  ]);
});
