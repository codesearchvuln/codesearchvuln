export type ProjectStatusToggleAction = {
  action: "enable" | "disable";
  label: "启用" | "禁用";
  requiresConfirmation: boolean;
};

export function getProjectStatusToggleAction(input: { is_active: boolean }): ProjectStatusToggleAction {
  if (input.is_active) {
    return {
      action: "disable",
      label: "禁用",
      requiresConfirmation: true,
    };
  }

  return {
    action: "enable",
    label: "启用",
    requiresConfirmation: false,
  };
}
