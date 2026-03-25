export const SCAN_ENGINE_TABS = [
  "opengrep",
  "gitleaks",
  "bandit",
  "phpstan",
  "yasa",
  "pmd",
] as const;

export type ScanEngineTab = (typeof SCAN_ENGINE_TABS)[number];

export const DEFAULT_SCAN_ENGINE_TAB: ScanEngineTab = "opengrep";

export const SCAN_ENGINE_SELECTOR_OPTIONS = SCAN_ENGINE_TABS.map((value) => ({
  label: value,
  value,
}));

export function isScanEngineTab(value: string): value is ScanEngineTab {
  return SCAN_ENGINE_TABS.includes(value as ScanEngineTab);
}
