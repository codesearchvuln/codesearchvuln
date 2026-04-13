import { buildApiUrl } from "@/shared/api/apiBase";
import { apiClient } from "@/shared/api/serverClient";

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

export interface Chat2RuleOpengrepChatResponse {
	assistant_message: string;
	rule_title: string;
	rule_text: string;
	explanation: string;
	validation_result: Chat2RuleValidationResult;
	usage: Record<string, number>;
}

export interface Chat2RuleOpengrepSaveResponse {
	rule_id: string;
	name: string;
	language: string;
	severity: string;
	message: string;
}

export type Chat2RuleStreamEvent =
	| { type: "started" }
	| {
			type: "draft";
			assistant_message: string;
			rule_title: string;
			rule_text: string;
			explanation: string;
	  }
	| ({ type: "result" } & Chat2RuleOpengrepChatResponse)
	| { type: "error"; message: string }
	| { type: "done" };

export async function chatWithOpengrepRule(
	projectId: string,
	params: {
		messages: Chat2RuleMessage[];
		selections: Chat2RuleSelection[];
		draft_rule_text?: string;
	},
): Promise<Chat2RuleOpengrepChatResponse> {
	const response = await apiClient.post(
		`/projects/${projectId}/chat2rule/opengrep/chat`,
		params,
	);
	return response.data;
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
	const response = await fetch(buildApiUrl(`/projects/${projectId}/chat2rule/opengrep/stream`), {
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

export async function saveOpengrepRuleFromChat(
	projectId: string,
	params: {
		rule_text: string;
		title?: string;
		description?: string;
	},
): Promise<Chat2RuleOpengrepSaveResponse> {
	const response = await apiClient.post(
		`/projects/${projectId}/chat2rule/opengrep/save`,
		params,
	);
	return response.data;
}
