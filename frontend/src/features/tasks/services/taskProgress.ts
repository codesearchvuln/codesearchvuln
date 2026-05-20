export interface EstimatedTaskProgressInput {
	status: string | null | undefined;
	createdAt: string | null | undefined;
	startedAt?: string | null | undefined;
}

export const INTERRUPTED_STATUSES = new Set([
	"interrupted",
	"aborted",
	"cancelled",
]);

export function isTerminalTaskStatus(
	status: string | null | undefined,
): boolean {
	const normalized = normalizeTaskStatus(status);
	return (
		normalized === "completed" ||
		normalized === "failed" ||
		INTERRUPTED_STATUSES.has(normalized)
	);
}

function normalizeTaskStatus(status: string | null | undefined): string {
	return String(status || "").trim().toLowerCase();
}

export function getEstimatedTaskProgressPercent(
	input: EstimatedTaskProgressInput,
	nowMs = Date.now(),
): number {
	const status = normalizeTaskStatus(input.status);

	if (
		isTerminalTaskStatus(status)
	) {
		return 100;
	}

	if (status === "pending") {
		return 15;
	}

	if (status === "running") {
		const startedAt = input.startedAt || input.createdAt;
		const elapsed = nowMs - new Date(String(startedAt || "")).getTime();
		if (!Number.isFinite(elapsed) || elapsed <= 0) {
			return 35;
		}
		const elapsedMinutes = elapsed / 60000;
		const progress = 35 + Math.floor(elapsedMinutes * 4);
		return Math.max(35, Math.min(95, progress));
	}

	return 0;
}
