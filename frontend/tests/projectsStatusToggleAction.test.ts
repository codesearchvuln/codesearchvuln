import test from "node:test";
import assert from "node:assert/strict";

type StatusToggleModule = {
  getProjectStatusToggleAction?: unknown;
  PROJECT_STATUS_LABEL?: string;
};

async function loadStatusToggleModule(): Promise<StatusToggleModule | null> {
  try {
    return (await import("../src/pages/projects/viewModel.ts")) as StatusToggleModule;
  } catch {
    return null;
  }
}

test("projects view model no longer exports status toggle actions", async () => {
  const module = await loadStatusToggleModule();

  assert.ok(module, "expected projects view model module to exist");
  assert.equal(module?.getProjectStatusToggleAction, undefined);
  assert.equal(module?.PROJECT_STATUS_LABEL, "可用");
});
