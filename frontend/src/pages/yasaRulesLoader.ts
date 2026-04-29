import {
  getYasaRuntimeConfig,
  getYasaRuleConfigs,
  getYasaRules,
  type YasaRule,
  type YasaRuleConfig,
  type YasaRuntimeConfig,
} from "@/shared/api/yasa";

export const YASA_RULES_LOAD_ERROR_FALLBACK =
  "YASA 规则加载失败";
export const YASA_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK =
  "加载 YASA 自定义规则配置失败，当前仅展示内置规则";
export const YASA_RUNTIME_CONFIG_LOAD_ERROR_FALLBACK =
  "加载 YASA 运行配置失败，当前不可编辑";

export interface YasaRulesLoaderResult {
  rules: YasaRule[];
  customRuleConfigs: YasaRuleConfig[];
  runtimeConfig: YasaRuntimeConfig | null;
  rulesLoadError: string | null;
  customConfigsLoadError: string | null;
  runtimeConfigLoadError: string | null;
}

export interface YasaRulesLoaderDeps {
  getRules?: (params: { limit: number }) => Promise<YasaRule[]>;
  getRuleConfigs?: (params: { limit: number }) => Promise<YasaRuleConfig[]>;
  getRuntimeConfig?: () => Promise<YasaRuntimeConfig>;
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

  return detail ? String(detail) : fallback;
}

export async function loadYasaRulesPageData(
  deps: YasaRulesLoaderDeps = {},
): Promise<YasaRulesLoaderResult> {
  const getRules = deps.getRules ?? ((params) => getYasaRules(params));
  const getRuleConfigs =
    deps.getRuleConfigs ?? ((params) => getYasaRuleConfigs(params));
  const getRuntimeConfig = deps.getRuntimeConfig ?? (() => getYasaRuntimeConfig());

  const [rulesResult, customRuleConfigsResult, runtimeConfigResult] =
    await Promise.allSettled([
      getRules({ limit: 2000 }),
      getRuleConfigs({ limit: 500 }),
      getRuntimeConfig(),
    ]);

  return {
    rules: rulesResult.status === "fulfilled" ? rulesResult.value : [],
    customRuleConfigs:
      customRuleConfigsResult.status === "fulfilled"
        ? customRuleConfigsResult.value
        : [],
    runtimeConfig:
      runtimeConfigResult.status === "fulfilled" ? runtimeConfigResult.value : null,
    rulesLoadError:
      rulesResult.status === "rejected"
        ? YASA_RULES_LOAD_ERROR_FALLBACK
        : null,
    customConfigsLoadError:
      customRuleConfigsResult.status === "rejected"
        ? getErrorMessage(
            customRuleConfigsResult.reason,
            YASA_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
          )
        : null,
    runtimeConfigLoadError:
      runtimeConfigResult.status === "rejected"
        ? getErrorMessage(
            runtimeConfigResult.reason,
            YASA_RUNTIME_CONFIG_LOAD_ERROR_FALLBACK,
          )
        : null,
  };
}
