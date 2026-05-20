import { getTaskDisplayStatusSummary } from "@/features/tasks/services/taskDisplay";

const AGENT_AUDIT_ACTIVE_STATUSES = new Set([
	"pending",
	"initializing",
	"running",
	"planning",
	"indexing",
	"analyzing",
	"verifying",
	"reporting",
]);

export function isAgentAuditTerminalStatus(status: string | undefined): boolean {
	const normalized = String(status || "").trim().toLowerCase();
	return (
		normalized === "completed" ||
		normalized === "failed" ||
		normalized === "cancelled" ||
		normalized === "interrupted"
	);
}

export function isAgentAuditActiveStatus(status: string | undefined): boolean {
	const normalized = String(status || "").trim().toLowerCase();
	return AGENT_AUDIT_ACTIVE_STATUSES.has(normalized);
}

export function toAgentAuditStatusLabel(status: string | undefined): string {
	const normalized = String(status || "").trim().toLowerCase();
	if (
		normalized === "interrupted" ||
		normalized === "cancelled" ||
		normalized === "canceled" ||
		normalized === "completed" ||
		normalized === "failed" ||
		normalized === "running" ||
		normalized === "pending" ||
		normalized === "aborted"
	) {
		return getTaskDisplayStatusSummary(normalized).statusLabel;
	}
	if (normalized === "waiting") return "等待中";
	if (normalized === "created") return "已创建";
	return String(status || "");
}

export function buildAgentAuditStreamDisconnectTitle(
	source: "transport" | "stream_end",
	errorMessage: string,
): string {
	const prefix =
		source === "transport" ? "服务异常或连接失败" : "事件流连接中断";
	return `${prefix}：${errorMessage}；恢复后进行中的任务会自动标记为中止`;
}
