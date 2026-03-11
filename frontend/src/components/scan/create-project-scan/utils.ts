import type { OpengrepRule } from "@/shared/api/opengrep";

export const CREATE_PROJECT_SCAN_PROVIDER_KEY_FIELD_MAP: Record<string, string> = {
  openai: "openaiApiKey",
  openrouter: "openaiApiKey",
  azure_openai: "openaiApiKey",
  custom: "openaiApiKey",
  anthropic: "claudeApiKey",
  claude: "claudeApiKey",
  gemini: "geminiApiKey",
  qwen: "qwenApiKey",
  deepseek: "deepseekApiKey",
  zhipu: "zhipuApiKey",
  moonshot: "moonshotApiKey",
  baidu: "baiduApiKey",
  minimax: "minimaxApiKey",
  doubao: "doubaoApiKey",
};

export function normalizeCreateProjectScanProvider(
  provider: string | undefined | null,
) {
  const normalized = (provider || "").trim().toLowerCase();
  if (!normalized) return "openai";
  if (normalized === "claude") return "anthropic";
  return normalized;
}

export function resolveCreateProjectScanEffectiveApiKey(
  provider: string,
  llmConfig: Record<string, unknown>,
): string {
  const directKey = String(llmConfig.llmApiKey || "").trim();
  if (directKey) return directKey;

  const providerKeyField = CREATE_PROJECT_SCAN_PROVIDER_KEY_FIELD_MAP[provider];
  if (!providerKeyField) return "";
  return String(llmConfig[providerKeyField] || "").trim();
}

export function extractCreateProjectScanApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const detail = (error as any)?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    return error.message || "未知错误";
  }
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return "未知错误";
}

export function isSevereCreateProjectScanRule(rule: OpengrepRule) {
  return String(rule.severity || "").toUpperCase() === "ERROR";
}

export function buildCreateProjectStaticTaskRoute(result: {
  primaryTaskId: string;
  params: URLSearchParams;
}) {
  return `/static-analysis/${result.primaryTaskId}${
    result.params.toString() ? `?${result.params.toString()}` : ""
  }`;
}

export function stripCreateProjectScanArchiveSuffix(fileName: string) {
  return fileName.replace(
    /\.(tar\.gz|tar\.bz2|tar\.xz|tgz|tbz2|zip|tar|7z|rar)$/i,
    "",
  );
}
