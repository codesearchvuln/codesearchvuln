import { buildApiUrl } from "@/shared/api/apiBase";
import { apiClient } from "@/shared/api/serverClient";

export type Chat2RuleEngineType =
	| "opengrep"
	| "gitleaks"
	| "bandit"
	| "phpstan"
	| "pmd"
	| "yasa";

export interface Chat2RuleMessage {
	role: "user" | "assistant";
	content: string;
}

export interface Chat2RuleSelection {
	file_path: string;
	start_line: number;
	end_line: number;
}

export interface Chat2RuleValidationResult {
	valid: boolean;
	errors: string[];
	normalized_rule_text?: string | null;
	metadata?: {
		id?: string | null;
		severity?: string | null;
		languages?: string[] | null;
		message?: string | null;
	} | null;
}

export interface Chat2RuleChatResponse {
	assistant_message: string;
	rule_title: string;
	rule_text: string;
	explanation: string;
	validation_result: Chat2RuleValidationResult;
	usage: Record<string, number>;
	engine_type: Chat2RuleEngineType;
	save_supported: boolean;
}

export interface Chat2RuleSaveResponse {
	rule_id: string;
	name: string;
	language: string;
	severity: string;
	message: string;
	engine_type: Chat2RuleEngineType;
	save_supported: boolean;
}

export type Chat2RuleStreamEvent =
	| { type: "started"; engine_type?: Chat2RuleEngineType; save_supported?: boolean }
	| {
			type: "draft";
			assistant_message: string;
			rule_title: string;
			rule_text: string;
			explanation: string;
			engine_type?: Chat2RuleEngineType;
			save_supported?: boolean;
	  }
	| ({ type: "result" } & Chat2RuleChatResponse)
	| { type: "error"; message: string }
	| { type: "done"; engine_type?: Chat2RuleEngineType; save_supported?: boolean };

export async function chatWithRule(
	projectId: string,
	engineType: Chat2RuleEngineType,
	params: {
		messages: Chat2RuleMessage[];
		selections: Chat2RuleSelection[];
		draft_rule_text?: string;
	},
): Promise<Chat2RuleChatResponse> {
	const response = await apiClient.post(
		`/projects/${projectId}/chat2rule/${engineType}/chat`,
		params,
	);
	return response.data;
}

export async function streamChatWithRule(
	projectId: string,
	engineType: Chat2RuleEngineType,
	params: {
		messages: Chat2RuleMessage[];
		selections: Chat2RuleSelection[];
		draft_rule_text?: string;
	},
	options?: {
		signal?: AbortSignal;
		onEvent?: (event: Chat2RuleStreamEvent) => void;
	},
): Promise<void> {
	const response = await fetch(buildApiUrl(`/projects/${projectId}/chat2rule/${engineType}/stream`), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		},
		body: JSON.stringify(params),
		signal: options?.signal,
		credentials: "include",
	});

	if (!response.ok) {
		const errText = await response.text();
		let detail = errText;
		try {
			detail = JSON.parse(errText)?.detail ?? errText;
		} catch {
			// noop
		}
		throw new Error(detail || "流式请求失败");
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("响应流不可用");
	}

	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		const parts = buffer.split("\n\n");
		buffer = parts.pop() ?? "";

		for (const part of parts) {
			if (!part.trim()) continue;
			const dataLines = part
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trim());
			if (dataLines.length === 0) continue;

			let parsed: Chat2RuleStreamEvent | null = null;
			try {
				parsed = JSON.parse(dataLines.join("\n")) as Chat2RuleStreamEvent;
			} catch {
				parsed = null;
			}
			if (!parsed) continue;

			options?.onEvent?.(parsed);
			if (parsed.type === "error") {
				throw new Error(parsed.message || "流式生成失败");
			}
		}
	}
}

export async function saveRuleFromChat(
	projectId: string,
	engineType: Chat2RuleEngineType,
	params: {
		rule_text: string;
		title?: string;
		description?: string;
	},
): Promise<Chat2RuleSaveResponse> {
	const response = await apiClient.post(
		`/projects/${projectId}/chat2rule/${engineType}/save`,
		params,
	);
	return response.data;
}

// Backward-compatible wrappers
export type Chat2RuleOpengrepChatResponse = Chat2RuleChatResponse;
export type Chat2RuleOpengrepSaveResponse = Chat2RuleSaveResponse;

export async function chatWithOpengrepRule(
	projectId: string,
	params: {
		messages: Chat2RuleMessage[];
		selections: Chat2RuleSelection[];
		draft_rule_text?: string;
	},
): Promise<Chat2RuleChatResponse> {
	return chatWithRule(projectId, "opengrep", params);
}

export async function streamChatWithOpengrepRule(
	projectId: string,
	params: {
		messages: Chat2RuleMessage[];
		selections: Chat2RuleSelection[];
		draft_rule_text?: string;
	},
	options?: {
		signal?: AbortSignal;
		onEvent?: (event: Chat2RuleStreamEvent) => void;
	},
): Promise<void> {
	return streamChatWithRule(projectId, "opengrep", params, options);
}

export async function saveOpengrepRuleFromChat(
	projectId: string,
	params: {
		rule_text: string;
		title?: string;
		description?: string;
	},
): Promise<Chat2RuleSaveResponse> {
	return saveRuleFromChat(projectId, "opengrep", params);
}
