export type LLMFetchStyle =
	| "openai_compatible"
	| "anthropic"
	| "azure_openai"
	| "native_static";

export interface LLMProviderItem {
	id: string;
	name: string;
	description: string;
	defaultModel: string;
	models: string[];
	defaultBaseUrl: string;
	requiresApiKey: boolean;
	supportsModelFetch: boolean;
	fetchStyle: LLMFetchStyle;
}

const DEFAULT_MODELS: Record<string, string> = {
	openai: "gpt-5",
	anthropic: "claude-sonnet-4-20250514",
	gemini: "gemini-2.5-pro",
	deepseek: "deepseek-chat",
	ollama: "llama3.1",
	openrouter: "openai/gpt-5-mini",
};

export const LLM_PROVIDER_API_KEY_FIELD_MAP: Record<string, string> = {
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

export const BUILTIN_LLM_PROVIDERS: LLMProviderItem[] = [
	{
		id: "openai",
		name: "OpenAI",
		description: "OpenAI 官方模型服务",
		defaultModel: "gpt-5",
		models: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4o"],
		defaultBaseUrl: "https://api.openai.com/v1",
		requiresApiKey: true,
		supportsModelFetch: true,
		fetchStyle: "openai_compatible",
	},
	{
		id: "anthropic",
		name: "Anthropic",
		description: "Claude 系列模型服务",
		defaultModel: "claude-sonnet-4-20250514",
		models: [
			"claude-sonnet-4-20250514",
			"claude-opus-4-20250514",
			"claude-3-5-haiku-latest",
		],
		defaultBaseUrl: "https://api.anthropic.com",
		requiresApiKey: true,
		supportsModelFetch: true,
		fetchStyle: "anthropic",
	},
	{
		id: "gemini",
		name: "Google Gemini",
		description: "Google Gemini 模型服务",
		defaultModel: "gemini-2.5-pro",
		models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
		defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		requiresApiKey: true,
		supportsModelFetch: true,
		fetchStyle: "openai_compatible",
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		description: "DeepSeek 推理与对话模型",
		defaultModel: "deepseek-chat",
		models: ["deepseek-chat", "deepseek-reasoner"],
		defaultBaseUrl: "https://api.deepseek.com/v1",
		requiresApiKey: true,
		supportsModelFetch: true,
		fetchStyle: "openai_compatible",
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		description: "统一多模型路由聚合服务",
		defaultModel: "openai/gpt-5-mini",
		models: [
			"openai/gpt-5-mini",
			"anthropic/claude-3.7-sonnet",
			"google/gemini-2.5-pro",
		],
		defaultBaseUrl: "https://openrouter.ai/api/v1",
		requiresApiKey: true,
		supportsModelFetch: true,
		fetchStyle: "openai_compatible",
	},
	{
		id: "ollama",
		name: "Ollama",
		description: "本地部署 LLM（无 API Key）",
		defaultModel: "llama3.1",
		models: ["llama3.1", "qwen2.5", "deepseek-r1:latest"],
		defaultBaseUrl: "http://localhost:11434/v1",
		requiresApiKey: false,
		supportsModelFetch: true,
		fetchStyle: "openai_compatible",
	},
];

export function normalizeLlmProviderId(
	provider: string | undefined | null,
): string {
	const normalized = (provider || "").trim().toLowerCase();
	if (!normalized) return "openai";
	if (normalized === "claude") return "anthropic";
	return normalized;
}

function resolveProviderSource(
	providerOptions?: LLMProviderItem[] | null,
): LLMProviderItem[] {
	if (Array.isArray(providerOptions) && providerOptions.length > 0) {
		return providerOptions;
	}
	return BUILTIN_LLM_PROVIDERS;
}

function buildUnknownProvider(providerId: string): LLMProviderItem {
	return {
		id: providerId,
		name: providerId,
		description: "自定义模型提供商",
		defaultModel: "",
		models: [],
		defaultBaseUrl: "",
		requiresApiKey: true,
		supportsModelFetch: false,
		fetchStyle: "openai_compatible",
	};
}

export function buildLlmProviderOptions(options?: {
	backendProviders?: LLMProviderItem[] | null;
	currentProviderId?: string | null;
}): LLMProviderItem[] {
	const backendProviders = Array.isArray(options?.backendProviders)
		? options?.backendProviders
		: [];
	const currentProviderId = normalizeLlmProviderId(options?.currentProviderId || "");
	const baseProviders = backendProviders.length > 0 ? backendProviders : BUILTIN_LLM_PROVIDERS;
	if (!currentProviderId) return baseProviders;
	if (baseProviders.some((provider) => provider.id === currentProviderId)) {
		return baseProviders;
	}
	return [...baseProviders, buildUnknownProvider(currentProviderId)];
}

export function getLlmProviderInfo(
	providerOptions: LLMProviderItem[] | null | undefined,
	providerId: string,
): LLMProviderItem | undefined {
	const normalizedProviderId = normalizeLlmProviderId(providerId);
	return resolveProviderSource(providerOptions).find(
		(provider) => provider.id === normalizedProviderId,
	);
}

export function getDefaultModelForProvider(
	providerOptions: LLMProviderItem[] | null | undefined,
	providerId: string,
): string {
	const provider = getLlmProviderInfo(providerOptions, providerId);
	return provider?.defaultModel || DEFAULT_MODELS[normalizeLlmProviderId(providerId)] || "";
}

export function getDefaultBaseUrlForProvider(
	providerOptions: LLMProviderItem[] | null | undefined,
	providerId: string,
): string {
	return getLlmProviderInfo(providerOptions, providerId)?.defaultBaseUrl || "";
}

export function shouldRequireApiKey(
	providerOptions: LLMProviderItem[] | null | undefined,
	providerId: string,
): boolean {
	const provider = getLlmProviderInfo(providerOptions, providerId);
	if (provider) return Boolean(provider.requiresApiKey);
	return normalizeLlmProviderId(providerId) !== "ollama";
}

export function resolveEffectiveLlmApiKey(
	provider: string,
	llmConfig: Record<string, unknown>,
): string {
	const directKey = String(llmConfig.llmApiKey || "").trim();
	if (directKey) return directKey;

	const providerKeyField =
		LLM_PROVIDER_API_KEY_FIELD_MAP[normalizeLlmProviderId(provider)];
	if (!providerKeyField) return "";
	return String(llmConfig[providerKeyField] || "").trim();
}

export function getCreateProjectScanProviderLabel(
	provider: Pick<LLMProviderItem, "id" | "name"> | undefined,
): string {
	if (!provider) return "";
	return normalizeLlmProviderId(provider.id) === "openai"
		? "OpenAI 兼容"
		: provider.name || provider.id;
}
