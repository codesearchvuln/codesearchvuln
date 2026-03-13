import test from "node:test";
import assert from "node:assert/strict";

type StatusToggleModule = {
  getProjectStatusToggleAction: (input: { is_active: boolean }) => {
    action: "enable" | "disable";
    label: "启用" | "禁用";
    requiresConfirmation: boolean;
  };
};

async function loadStatusToggleModule(): Promise<StatusToggleModule | null> {
  try {
    return (await import("../src/pages/projects/viewModel.ts")) as StatusToggleModule;
  } catch {
    return null;
  }
}

test("getProjectStatusToggleAction 为启用项目返回禁用动作", async () => {
  const module = await loadStatusToggleModule();

  assert.ok(
    module?.getProjectStatusToggleAction,
    "expected projects status toggle view model to exist",
  );

  assert.deepEqual(module.getProjectStatusToggleAction({ is_active: true }), {
    action: "disable",
    label: "禁用",
    requiresConfirmation: true,
  });
});

test("getProjectStatusToggleAction 为禁用项目返回启用动作", async () => {
  const module = await loadStatusToggleModule();

  assert.ok(
    module?.getProjectStatusToggleAction,
    "expected projects status toggle view model to exist",
  );

  assert.deepEqual(module.getProjectStatusToggleAction({ is_active: false }), {
    action: "enable",
    label: "启用",
    requiresConfirmation: false,
  });
});
