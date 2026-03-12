import { api } from "@/shared/config/database";
import {
	normalizeLlmProviderId,
	resolveEffectiveLlmApiKey,
	shouldRequireApiKey,
} from "@/shared/llm/providerCatalog";

type PreflightStage = "llm_config" | "llm_test";
export type PreflightMissingField = "llmModel" | "llmBaseUrl" | "llmApiKey";

export interface AgentPreflightResult {
	ok: boolean;
	stage?: PreflightStage;
	message: string;
	reasonCode?: "missing_fields" | "llm_test_failed" | "llm_test_exception";
	missingFields?: PreflightMissingField[];
}

export async function runAgentPreflightCheck(): Promise<AgentPreflightResult> {
	const userConfig = await api.getUserConfig();
	const llmConfig = (userConfig?.llmConfig || {}) as Record<string, unknown>;

	const llmProvider = normalizeLlmProviderId(
		typeof llmConfig.llmProvider === "string" ? llmConfig.llmProvider : undefined,
	);
	const llmApiKey = resolveEffectiveLlmApiKey(llmProvider, llmConfig);
	const llmModel = String(llmConfig.llmModel || "").trim();
	const llmBaseUrl = String(llmConfig.llmBaseUrl || "").trim();
	const missingFields: PreflightMissingField[] = [];
	if (!llmModel) missingFields.push("llmModel");
	if (!llmBaseUrl) missingFields.push("llmBaseUrl");
	if (shouldRequireApiKey(undefined, llmProvider) && !llmApiKey) {
		missingFields.push("llmApiKey");
	}

	if (missingFields.length > 0) {
		const fieldLabelMap: Record<PreflightMissingField, string> = {
			llmModel: "模型（llmModel）",
			llmBaseUrl: "Base URL（llmBaseUrl）",
			llmApiKey: "API Key（llmApiKey）",
		};
		const message = missingFields
			.map((field) => fieldLabelMap[field])
			.filter(Boolean)
			.join("、");
		return {
			ok: false,
			stage: "llm_config",
			reasonCode: "missing_fields",
			missingFields,
			message: `智能扫描初始化失败：LLM 缺少必填配置 ${message}，请先补全并测试。`,
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
				reasonCode: "llm_test_failed",
				message: `智能扫描初始化失败：LLM 测试未通过（${llmResult.message || "未知错误"}）。`,
			};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "未知错误";
		return {
			ok: false,
			stage: "llm_test",
			reasonCode: "llm_test_exception",
			message: `智能扫描初始化失败：LLM 测试异常（${message}）。`,
		};
	}

	return {
		ok: true,
		message: "LLM 配置测试通过。",
	};
}
