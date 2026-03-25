import {
  getPmdBuiltinRulesets,
  getPmdPresets,
  getPmdRuleConfigs,
  type PmdPreset,
  type PmdRuleConfig,
  type PmdRulesetSummary,
} from "@/shared/api/pmd";

export const PMD_BUILTIN_RULESETS_LOAD_ERROR_FALLBACK =
  "加载 PMD 内置 ruleset 失败";
export const PMD_PRESETS_LOAD_ERROR_FALLBACK =
  "加载 PMD 预设组合失败，当前不可查看 preset 说明";
export const PMD_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK =
  "加载 PMD 自定义 ruleset 失败，当前仅展示内置 ruleset";

export interface PmdRulesLoaderResult {
  presets: PmdPreset[];
  builtinRulesets: PmdRulesetSummary[];
  customRuleConfigs: PmdRuleConfig[];
  builtinLoadError: string | null;
  presetsLoadError: string | null;
  customConfigsLoadError: string | null;
}

export interface PmdRulesLoaderDeps {
  getPresets?: () => Promise<PmdPreset[]>;
  getBuiltinRulesets?: (params: { limit: number }) => Promise<PmdRulesetSummary[]>;
  getRuleConfigs?: (params: { limit: number }) => Promise<PmdRuleConfig[]>;
}

function formatDetailLocation(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  const parts = loc
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(".") : null;
}

function getErrorMessageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed || fallback;
  }

  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }

      if (typeof item === "object" && item !== null) {
        const message =
          "msg" in item && typeof item.msg === "string" ? item.msg.trim() : "";
        const location = "loc" in item ? formatDetailLocation(item.loc) : null;
        if (message) {
          return location ? `${location}: ${message}` : message;
        }
      }
    }
    return fallback;
  }

  if (typeof detail === "object" && detail !== null) {
    if ("message" in detail && typeof detail.message === "string") {
      const message = detail.message.trim();
      if (message) return message;
    }

    if ("msg" in detail && typeof detail.msg === "string") {
      const message = detail.msg.trim();
      if (message) return message;
    }
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  const detail =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data
      ? error.response.data.detail
      : null;

  return getErrorMessageFromDetail(detail, fallback);
}

export async function loadPmdRulesPageData(
  deps: PmdRulesLoaderDeps = {},
): Promise<PmdRulesLoaderResult> {
  const getPresets = deps.getPresets ?? (() => getPmdPresets());
  const getBuiltinRulesets =
    deps.getBuiltinRulesets ?? ((params) => getPmdBuiltinRulesets(params));
  const getRuleConfigs =
    deps.getRuleConfigs ?? ((params) => getPmdRuleConfigs(params));

  const [presetsResult, builtinResult, customResult] = await Promise.allSettled([
    getPresets(),
    getBuiltinRulesets({ limit: 500 }),
    getRuleConfigs({ limit: 500 }),
  ]);

  return {
    presets: presetsResult.status === "fulfilled" ? presetsResult.value : [],
    builtinRulesets: builtinResult.status === "fulfilled" ? builtinResult.value : [],
    customRuleConfigs: customResult.status === "fulfilled" ? customResult.value : [],
    builtinLoadError:
      builtinResult.status === "rejected"
        ? getErrorMessage(
            builtinResult.reason,
            PMD_BUILTIN_RULESETS_LOAD_ERROR_FALLBACK,
          )
        : null,
    presetsLoadError:
      presetsResult.status === "rejected"
        ? getErrorMessage(
            presetsResult.reason,
            PMD_PRESETS_LOAD_ERROR_FALLBACK,
          )
        : null,
    customConfigsLoadError:
      customResult.status === "rejected"
        ? getErrorMessage(
            customResult.reason,
            PMD_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
          )
        : null,
  };
}
