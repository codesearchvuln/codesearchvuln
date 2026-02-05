import { api } from "@/shared/config/database";
import { apiClient } from "@/shared/api/serverClient";

type PreflightStage = "llm_config" | "llm_test" | "rag_config" | "rag_test";

interface EmbeddingConfigResponse {
	provider: string;
	model: string;
	api_key?: string | null;
	base_url?: string | null;
	dimensions?: number;
}

interface EmbeddingTestResponse {
	success: boolean;
	message?: string;
}

export interface AgentPreflightResult {
	ok: boolean;
	stage?: PreflightStage;
	message: string;
}

const EMBEDDING_PROVIDERS_REQUIRING_KEY = new Set([
	"openai",
	"azure",
	"cohere",
	"huggingface",
	"jina",
	"qwen",
]);

const normalizeProvider = (provider: string | undefined | null) =>
	(provider || "").trim().toLowerCase();

export async function runAgentPreflightCheck(): Promise<AgentPreflightResult> {
	const userConfig = await api.getUserConfig();
	const llmConfig = userConfig?.llmConfig || {};

	const llmProvider = normalizeProvider(llmConfig.llmProvider) || "openai";
	const llmApiKey = (llmConfig.llmApiKey || "").trim();
	const llmModel = (llmConfig.llmModel || "").trim();
	const llmBaseUrl = (llmConfig.llmBaseUrl || "").trim();

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
			model: llmModel || undefined,
			baseUrl: llmBaseUrl || undefined,
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

	let embeddingConfig: EmbeddingConfigResponse;
	try {
		const response =
			await apiClient.get<EmbeddingConfigResponse>("/embedding/config");
		embeddingConfig = response.data;
	} catch (error) {
		const message = error instanceof Error ? error.message : "未知错误";
		return {
			ok: false,
			stage: "rag_config",
			message: `智能审计初始化失败：RAG 配置读取失败（${message}）。`,
		};
	}

	const ragProvider = normalizeProvider(embeddingConfig.provider);
	const ragModel = (embeddingConfig.model || "").trim();
	const ragApiKey = (embeddingConfig.api_key || "").trim();

	if (!ragProvider || !ragModel) {
		return {
			ok: false,
			stage: "rag_config",
			message: "智能审计初始化失败：RAG 配置不完整，请先配置嵌入模型。",
		};
	}

	if (EMBEDDING_PROVIDERS_REQUIRING_KEY.has(ragProvider) && !ragApiKey) {
		return {
			ok: false,
			stage: "rag_config",
			message:
				"智能审计初始化失败：RAG 嵌入模型缺少 API Key，请先在嵌入模型配置中补全。",
		};
	}

	try {
		const testResponse = await apiClient.post<EmbeddingTestResponse>(
			"/embedding/test",
			{
				provider: embeddingConfig.provider,
				model: embeddingConfig.model,
				api_key: embeddingConfig.api_key || undefined,
				base_url: embeddingConfig.base_url || undefined,
				dimension: embeddingConfig.dimensions || undefined,
				test_text: "Agent 审计预检查",
			},
		);

		if (!testResponse.data?.success) {
			return {
				ok: false,
				stage: "rag_test",
				message: `智能审计初始化失败：RAG 测试未通过（${testResponse.data?.message || "未知错误"}）。`,
			};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "未知错误";
		return {
			ok: false,
			stage: "rag_test",
			message: `智能审计初始化失败：RAG 测试异常（${message}）。`,
		};
	}

	return {
		ok: true,
		message: "LLM 与 RAG 配置测试通过。",
	};
}
