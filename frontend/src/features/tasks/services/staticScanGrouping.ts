export const STATIC_SCAN_PAIRING_WINDOW_MS = 60 * 1000;

export interface StaticScanTaskLike {
	id: string;
	project_id: string;
	status: string;
	created_at: string;
}

export interface StaticScanGroup<
	TOpengrepTask extends StaticScanTaskLike = StaticScanTaskLike,
	TGitleaksTask extends StaticScanTaskLike = StaticScanTaskLike,
	TBanditTask extends StaticScanTaskLike = StaticScanTaskLike,
> {
	projectId: string;
	createdAt: string;
	opengrepTask?: TOpengrepTask;
	gitleaksTask?: TGitleaksTask;
	banditTask?: TBanditTask;
}

export type StaticScanGroupStatus = "completed" | "running" | "other";

function normalizeTimestamp(value: string): number {
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeStatus(value: string | null | undefined): string {
	return String(value || "").trim().toLowerCase();
}

export function buildStaticScanGroups<
	TOpengrepTask extends StaticScanTaskLike,
	TGitleaksTask extends StaticScanTaskLike,
	TBanditTask extends StaticScanTaskLike,
>(params: {
	opengrepTasks: TOpengrepTask[];
	gitleaksTasks: TGitleaksTask[];
	banditTasks: TBanditTask[];
	pairingWindowMs?: number;
}): Array<StaticScanGroup<TOpengrepTask, TGitleaksTask, TBanditTask>> {
	const {
		opengrepTasks,
		gitleaksTasks,
		banditTasks,
		pairingWindowMs = STATIC_SCAN_PAIRING_WINDOW_MS,
	} = params;

	const gitleaksByProject = new Map<string, TGitleaksTask[]>();
	for (const task of gitleaksTasks) {
		const list = gitleaksByProject.get(task.project_id) || [];
		list.push(task);
		gitleaksByProject.set(task.project_id, list);
	}

	for (const [projectId, list] of gitleaksByProject.entries()) {
		list.sort(
			(a, b) => normalizeTimestamp(a.created_at) - normalizeTimestamp(b.created_at),
		);
		gitleaksByProject.set(projectId, list);
	}

	const banditByProject = new Map<string, TBanditTask[]>();
	for (const task of banditTasks) {
		const list = banditByProject.get(task.project_id) || [];
		list.push(task);
		banditByProject.set(task.project_id, list);
	}

	for (const [projectId, list] of banditByProject.entries()) {
		list.sort(
			(a, b) => normalizeTimestamp(a.created_at) - normalizeTimestamp(b.created_at),
		);
		banditByProject.set(projectId, list);
	}

	const usedGitleaksTaskIds = new Set<string>();
	const usedBanditTaskIds = new Set<string>();
	const groups: Array<
		StaticScanGroup<TOpengrepTask, TGitleaksTask, TBanditTask>
	> = [];

	for (const opengrepTask of opengrepTasks) {
		const candidates = gitleaksByProject.get(opengrepTask.project_id) || [];
		const opengrepTimestamp = normalizeTimestamp(opengrepTask.created_at);
		let pairedGitleaksTask: TGitleaksTask | undefined;
		let bestDiff = Number.POSITIVE_INFINITY;

		for (const candidate of candidates) {
			if (usedGitleaksTaskIds.has(candidate.id)) continue;
			const diff = Math.abs(
				normalizeTimestamp(candidate.created_at) - opengrepTimestamp,
			);
			if (diff <= pairingWindowMs && diff < bestDiff) {
				pairedGitleaksTask = candidate;
				bestDiff = diff;
			}
		}

		if (pairedGitleaksTask) {
			usedGitleaksTaskIds.add(pairedGitleaksTask.id);
		}

		const banditCandidates = banditByProject.get(opengrepTask.project_id) || [];
		let pairedBanditTask: TBanditTask | undefined;
		let bestBanditDiff = Number.POSITIVE_INFINITY;
		for (const candidate of banditCandidates) {
			if (usedBanditTaskIds.has(candidate.id)) continue;
			const diff = Math.abs(
				normalizeTimestamp(candidate.created_at) - opengrepTimestamp,
			);
			if (diff <= pairingWindowMs && diff < bestBanditDiff) {
				pairedBanditTask = candidate;
				bestBanditDiff = diff;
			}
		}
		if (pairedBanditTask) {
			usedBanditTaskIds.add(pairedBanditTask.id);
		}

		groups.push({
			projectId: opengrepTask.project_id,
			createdAt: opengrepTask.created_at,
			opengrepTask,
			gitleaksTask: pairedGitleaksTask,
			banditTask: pairedBanditTask,
		});
	}

	for (const gitleaksTask of gitleaksTasks) {
		if (usedGitleaksTaskIds.has(gitleaksTask.id)) continue;
		groups.push({
			projectId: gitleaksTask.project_id,
			createdAt: gitleaksTask.created_at,
			gitleaksTask,
		});
	}

	for (const banditTask of banditTasks) {
		if (usedBanditTaskIds.has(banditTask.id)) continue;
		groups.push({
			projectId: banditTask.project_id,
			createdAt: banditTask.created_at,
			banditTask,
		});
	}

	return groups;
}

export function resolveStaticScanGroupStatus(
	group: Pick<StaticScanGroup, "opengrepTask" | "gitleaksTask" | "banditTask">,
): StaticScanGroupStatus {
	const statuses = [group.opengrepTask?.status, group.gitleaksTask?.status, group.banditTask?.status]
		.map((status) => normalizeStatus(status))
		.filter(Boolean);

	if (statuses.some((status) => status === "running" || status === "pending")) {
		return "running";
	}

	if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
		return "completed";
	}

	return "other";
}
