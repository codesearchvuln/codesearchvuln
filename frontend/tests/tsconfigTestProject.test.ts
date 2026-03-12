import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadTsconfig(configPath: string) {
  const configText = execFileSync(
    process.execPath,
    ["./node_modules/typescript/bin/tsc", "--showConfig", "-p", configPath],
    {
      cwd: frontendDir,
      encoding: "utf8",
    },
  );

  return JSON.parse(configText) as {
    compilerOptions?: {
      allowImportingTsExtensions?: boolean;
      types?: string[];
    };
    references?: Array<{ path?: string }>;
    files?: string[];
  };
}

test("root tsconfig references the dedicated test project", () => {
  const rootConfig = loadTsconfig("tsconfig.json");

  assert.ok(
    rootConfig.references?.some((reference) => reference.path === "./tsconfig.test.json"),
  );
});

test("test project includes staticAnalysisViewModel.test.ts with node types enabled", () => {
  const testConfig = loadTsconfig("tsconfig.test.json");
  const typecheck = spawnSync(
    process.execPath,
    ["./node_modules/typescript/bin/tsc", "-p", "tsconfig.test.json", "--noEmit"],
    {
      cwd: frontendDir,
      encoding: "utf8",
    },
  );
  const combinedOutput = `${typecheck.stdout}${typecheck.stderr}`;

  assert.equal(testConfig.compilerOptions?.allowImportingTsExtensions, true);
  assert.deepEqual(testConfig.compilerOptions?.types, ["node"]);
  assert.ok(
    testConfig.files?.includes("./tests/staticAnalysisViewModel.test.ts"),
  );
  assert.doesNotMatch(
    combinedOutput,
    /Cannot find type definition file for 'node'/,
  );
});
