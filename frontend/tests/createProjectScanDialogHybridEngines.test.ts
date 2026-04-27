import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("CreateProjectScanDialogContent only exposes YASA in static mode", () => {
  const source = readFileSync(
    resolve(
      import.meta.dirname,
      "../src/components/scan/create-project-scan/Content.tsx",
    ),
    "utf8",
  );

  assert.match(
    source,
    /key:\s*"yasa"[\s\S]*?title:\s*"YASA"[\s\S]*?visible:\s*mode\s*===\s*"static"/,
  );
});
