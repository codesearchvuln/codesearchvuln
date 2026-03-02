import { api } from "@/shared/config/database";

type PreflightStage = "llm_config" | "llm_test";

export interface AgentPreflightResult {
	ok: boolean;
	stage?: PreflightStage;
	message: string;
}

const normalizeProvider = (provider: string | undefined | null) =>
	(provider || "").trim().toLowerCase();

const resolveEffectiveApiKey = (
	provider: string,
	llmConfig: Record<string, unknown>,
): string => {
	const directKey = String(llmConfig.llmApiKey || "").trim();
	if (directKey) return directKey;

	const providerKeyMap: Record<string, string> = {
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
	const providerKeyField = providerKeyMap[provider];
	if (!providerKeyField) return "";
	return String(llmConfig[providerKeyField] || "").trim();
};

export async function runAgentPreflightCheck(): Promise<AgentPreflightResult> {
	const userConfig = await api.getUserConfig();
	const llmConfig = userConfig?.llmConfig || {};

	const llmProvider = normalizeProvider(llmConfig.llmProvider) || "openai";
	const llmApiKey = resolveEffectiveApiKey(llmProvider, llmConfig);
	const llmModel = (llmConfig.llmModel || "").trim();
	const llmBaseUrl = (llmConfig.llmBaseUrl || "").trim();

	if (!llmModel) {
		return {
			ok: false,
			stage: "llm_config",
			message:
				"智能审计初始化失败：LLM 未配置模型（llmModel），请先在系统配置中完成配置并测试。",
		};
	}
	if (!llmBaseUrl) {
		return {
			ok: false,
			stage: "llm_config",
			message:
				"智能审计初始化失败：LLM 未配置 Base URL（llmBaseUrl），请先在系统配置中完成配置并测试。",
		};
	}

	if (llmProvider !== "ollama" && !llmApiKey) {
		return {
			ok: false,
			stage: "llm_config",
			message:
				"智能审计初始化失败：LLM 未配置 API Key，请先在系统配置中完成 LLM 配置并测试。",
		};
	}

	try {
		const llmResult = await api.testLLMConnection({
			provider: llmProvider,
			apiKey: llmApiKey,
			model: llmModel,
			baseUrl: llmBaseUrl,
		});

		if (!llmResult.success) {
			return {
				ok: false,
				stage: "llm_test",
				message: `智能审计初始化失败：LLM 测试未通过（${llmResult.message || "未知错误"}）。`,
			};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "未知错误";
		return {
			ok: false,
			stage: "llm_test",
			message: `智能审计初始化失败：LLM 测试异常（${message}）。`,
		};
	}

	return {
		ok: true,
		message: "LLM 配置测试通过（RAG 可选，未检查）。",
	};
}
