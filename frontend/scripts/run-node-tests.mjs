#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const defaultTestsDir = path.join(frontendDir, "tests");

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

export function listDefaultTestFiles({ testsDirPath = defaultTestsDir } = {}) {
  return fs
    .readdirSync(testsDirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => `tests/${entry.name}`)
    .sort();
}

function resolveSingleTestArg(arg, { testsDirPath = defaultTestsDir } = {}) {
  const normalized = toPosixPath(arg).trim();
  if (!normalized) return normalized;
  if (path.isAbsolute(arg)) return arg;
  if (normalized.startsWith("tests/")) return normalized;

  const fileName = path.basename(normalized);
  if (fs.existsSync(path.join(testsDirPath, fileName))) {
    return `tests/${fileName}`;
  }

  return normalized;
}

export function normalizeTestArgs(rawArgs, { testsDirPath = defaultTestsDir } = {}) {
  const filteredArgs = rawArgs.filter((arg) => String(arg).trim() !== "--");
  if (filteredArgs.length === 0) {
    return listDefaultTestFiles({ testsDirPath });
  }
  return filteredArgs
    .map((arg) => resolveSingleTestArg(arg, { testsDirPath }))
    .filter(Boolean);
}

export function buildNodeTestCommand(testArgs) {
  return {
    bin: process.execPath,
    args: ["--import", "tsx", "--test", ...testArgs],
  };
}

export function main() {
  const testArgs = normalizeTestArgs(process.argv.slice(2));
  const command = buildNodeTestCommand(testArgs);
  const result = spawnSync(command.bin, command.args, {
    cwd: frontendDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }
  process.exit(1);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
