import {
	type AgentTask,
	cancelAgentTask,
	deleteAgentTask,
	getAgentTasks,
} from "@/shared/api/agentTasks";
import {
	deleteGitleaksScanTask,
	type GitleaksScanTask,
	getGitleaksScanTasks,
	interruptGitleaksScanTask,
} from "@/shared/api/gitleaks";
import {
	deleteBanditScanTask,
	type BanditScanTask,
	getBanditScanTasks,
	interruptBanditScanTask,
} from "@/shared/api/bandit";
import {
	deletePhpstanScanTask,
	type PhpstanScanTask,
	getPhpstanScanTasks,
	interruptPhpstanScanTask,
} from "@/shared/api/phpstan";
import {
	deletePmdScanTask,
	type PmdScanTask,
	getPmdScanTasks,
	interruptPmdScanTask,
} from "@/shared/api/pmd";
import {
	deleteYasaScanTask,
	type YasaScanTask,
	getYasaScanTasks,
	interruptYasaScanTask,
} from "@/shared/api/yasa";
import {
	deleteOpengrepScanTask,
	getOpengrepScanTasks,
	interruptOpengrepScanTask,
	type OpengrepScanTask,
} from "@/shared/api/opengrep";
import type { Project } from "@/shared/types";
import {
	INTERRUPTED_STATUSES,
} from "./taskProgress";
import {
	formatTaskDuration,
	getTaskDisplayProgressPercent,
	getTaskDisplayStatusSummary,
} from "./taskDisplay";
import {
	buildStaticScanGroups,
	resolveStaticScanGroupStatus,
} from "./staticScanGrouping";

export {
	buildStaticScanGroups,
	resolveStaticScanGroupStatus,
	type StaticScanGroup,
	type StaticScanGroupStatus,
} from "./staticScanGrouping";

export type TaskActivityKind = "rule_scan" | "intelligent_audit";
export type TaskActivitySourceMode =
	| "static"
	| "intelligent"
	| "hybrid"
	| "unknown";

export const HYBRID_TASK_NAME_MARKER = "[HYBRID]";
export const INTELLIGENT_TASK_NAME_MARKER = "[INTELLIGENT]";

export type SeverityCounts = {
	critical: number;
	high: number;
	medium: number;
	low: number;
};

export interface TaskActivityItem {
	id: string;
	projectName: string;
	kind: TaskActivityKind;
	sourceMode: TaskActivitySourceMode;
	name?: string | null;
	description?: string | null;
	status: string;
	currentPhase?: string | null;
	currentStep?: string | null;
	workflowPhase?: string | null;
	displayPhase?: TaskActivityStageKey | null;
	targetFiles?: string[] | null;
	gitleaksEnabled?: boolean;
	staticFindingStats?: SeverityCounts;
	agentFindingStats?: {
		critical: number;
		high: number;
		medium: number;
		low: number;
		total: number;
	};
	createdAt: string;
	startedAt?: string | null;
	completedAt?: string | null;
	durationMs?: number | null;
	route: string;
	opengrepTaskId?: string;
	gitleaksTaskId?: string;
	banditTaskId?: string;
	phpstanTaskId?: string;
	pmdTaskId?: string;
	yasaTaskId?: string;
	agentTaskId?: string;
}

export type TaskActivityStageKey =
	| "static_scan"
	| "recon"
	| "analysis"
	| "verification"
	| "complete";

export interface TaskActivityStageBadgeMeta {
	key: TaskActivityStageKey;
	label: string;
	variant: "pending" | "running" | "completed" | "failed";
	dotClassName: string;
	badgeClassName: string;
}

const TASK_ACTIVITY_STAGE_LABELS: Record<TaskActivityStageKey, string> = {
	static_scan: "静态扫描",
	recon: "侦查",
	analysis: "分析",
	verification: "验证",
	complete: "完成",
};

const TASK_ACTIVITY_STAGE_BADGE_STYLES: Record<
	TaskActivityStageKey,
	{ dotClassName: string; badgeClassName: string }
> = {
	static_scan: {
		dotClassName: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]",
		badgeClassName:
			"border-sky-500/30 bg-sky-500/10 text-sky-100",
	},
	recon: {
		dotClassName: "bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.45)]",
		badgeClassName:
			"border-teal-500/30 bg-teal-500/10 text-teal-100",
	},
	analysis: {
		dotClassName: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]",
		badgeClassName:
			"border-amber-500/30 bg-amber-500/10 text-amber-100",
	},
	verification: {
		dotClassName:
			"bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]",
		badgeClassName:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
	},
	complete: {
		dotClassName:
			"bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.45)]",
		badgeClassName:
			"border-violet-500/30 bg-violet-500/10 text-violet-100",
	},
};

function normalizeTaskName(name: string | null | undefined): string {
	return String(name || "").trim().toLowerCase();
}

export function resolveSourceModeFromTaskMeta(
	kind: TaskActivityKind,
	name: string | null | undefined,
	description?: string | null | undefined,
): TaskActivitySourceMode {
	const normalizedName = normalizeTaskName(name);
	const normalizedDescription = normalizeTaskName(description);
	const normalizedCombined = `${normalizedName} ${normalizedDescription}`;
	if (
		normalizedCombined.includes(HYBRID_TASK_NAME_MARKER.toLowerCase()) ||
		normalizedCombined.includes("混合扫描")
	) {
		return "hybrid";
	}
	if (normalizedCombined.includes(INTELLIGENT_TASK_NAME_MARKER.toLowerCase())) {
		return "intelligent";
	}
	if (kind === "rule_scan") {
		return "static";
	}
	// Legacy intelligent_audit tasks created before markers are migrated to hybrid.
	return "hybrid";
}

export function isIntelligentAgentActivity(
	activity: Pick<TaskActivityItem, "kind" | "sourceMode">,
): boolean {
	return (
		activity.kind === "intelligent_audit" &&
		activity.sourceMode === "intelligent"
	);
}

export function isHybridAgentActivity(
	activity: Pick<TaskActivityItem, "kind" | "sourceMode">,
): boolean {
	return (
		activity.kind === "intelligent_audit" &&
		activity.sourceMode === "hybrid"
	);
}

export function getTaskKindText(
	activity: Pick<TaskActivityItem, "kind" | "sourceMode">,
): string {
	if (activity.kind === "rule_scan") {
		return "静态扫描";
	}
	if (activity.sourceMode === "hybrid") {
		return "混合扫描";
	}
	return "智能扫描";
}

function mapProjectNames(projects: Project[]) {
	return new Map(projects.map((project) => [project.id, project.name]));
}

function normalizeStatus(status: string | null | undefined): string {
	return String(status || "").trim().toLowerCase();
}

function resolveTaskActivityStageKey(
	activity: Pick<
		TaskActivityItem,
		| "kind"
		| "sourceMode"
		| "status"
		| "currentPhase"
		| "currentStep"
		| "workflowPhase"
		| "displayPhase"
	>,
): TaskActivityStageKey | null {
	const status = normalizeStatus(activity.status);
	if (activity.kind === "rule_scan") {
		return status === "running" || status === "pending" || status === "initializing"
			? "static_scan"
			: null;
	}
	if (activity.kind !== "intelligent_audit") {
		return null;
	}

	if (activity.displayPhase) {
		return activity.displayPhase;
	}

	const phase =
		normalizeStatus(activity.workflowPhase) ||
		normalizeStatus(activity.currentPhase);
	const step = String(activity.currentStep || "").trim();

	if (/验证/.test(step) || phase === "verification") {
		return "verification";
	}
	if (/报告|归档|收尾|入库/.test(step) || phase === "reporting") {
		return "complete";
	}
	if (/分析/.test(step) || phase === "analysis") {
		return "analysis";
	}
	if (
		activity.sourceMode === "hybrid" &&
		(/静态预扫|预扫|bootstrap/i.test(step) ||
			phase === "planning" ||
			phase === "indexing")
	) {
		return "static_scan";
	}
	if (
		phase === "planning" ||
		phase === "indexing" ||
		phase === "reconnaissance"
	) {
		return "recon";
	}
	if (status === "completed") {
		return "complete";
	}
	if (
		status === "running" ||
		status === "pending" ||
		status === "initializing"
	) {
		return activity.sourceMode === "hybrid" ? "static_scan" : "recon";
	}
	return null;
}

export function getTaskActivityStageBadgeMeta(
	activity: Pick<
		TaskActivityItem,
		| "kind"
		| "sourceMode"
		| "status"
		| "currentPhase"
		| "currentStep"
		| "workflowPhase"
		| "displayPhase"
	>,
): TaskActivityStageBadgeMeta | null {
	const status = normalizeStatus(activity.status);
	if (
		status !== "running" &&
		status !== "pending" &&
		status !== "initializing"
	) {
		return null;
	}
	const key = resolveTaskActivityStageKey(activity);
	if (!key) {
		return null;
	}
	const style = TASK_ACTIVITY_STAGE_BADGE_STYLES[key];
	const variant =
		status === "pending" ? "pending" : "running";
	const badgeClassName =
		variant === "pending"
			? "border-border/70 bg-muted/30 text-muted-foreground"
			: style.badgeClassName;
	const dotClassName =
		variant === "pending"
			? `${style.dotClassName} opacity-35`
			: style.dotClassName;
	return {
		key,
		label: TASK_ACTIVITY_STAGE_LABELS[key],
		variant,
		dotClassName,
		badgeClassName,
	};
}

function toNonNegativeInt(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0;
	}
	return Math.floor(parsed);
}

export function buildOpengrepSeverityCounts(
	task?: OpengrepScanTask | null,
): SeverityCounts {
	const total = toNonNegativeInt(task?.total_findings);
	const error = toNonNegativeInt(task?.error_count);
	const warning = toNonNegativeInt(task?.warning_count);
	return {
		critical: 0,
		high: 0,
		medium: error + warning,
		low: Math.max(total - error - warning, 0),
	};
}

export function buildGitleaksSeverityCounts(
	task?: GitleaksScanTask | null,
): SeverityCounts {
	return {
		critical: 0,
		high: 0,
		medium: 0,
		low: toNonNegativeInt(task?.total_findings),
	};
}

export function buildBanditSeverityCounts(
	task?: BanditScanTask | null,
): SeverityCounts {
	return {
		critical: 0,
		high: toNonNegativeInt(task?.high_count),
		medium: toNonNegativeInt(task?.medium_count),
		low: toNonNegativeInt(task?.low_count),
	};
}

export function buildPhpstanSeverityCounts(
	task?: PhpstanScanTask | null,
): SeverityCounts {
	// PHPStan integration: dashboard/task活动口径将 phpstan 发现全部归入 low(hint)。
	return {
		critical: 0,
		high: 0,
		medium: 0,
		low: toNonNegativeInt(task?.total_findings),
	};
}

export function buildPmdSeverityCounts(
	task?: PmdScanTask | null,
): SeverityCounts {
	return {
		critical: 0,
		high: 0,
		medium: 0,
		low: toNonNegativeInt(task?.total_findings),
	};
}

export function getAgentSeverityCounts(
	task?:
		| Pick<
				AgentTask,
				"critical_count" | "high_count" | "medium_count" | "low_count"
		  >
		| null,
): SeverityCounts {
	return {
		critical: toNonNegativeInt(task?.critical_count),
		high: toNonNegativeInt(task?.high_count),
		medium: toNonNegativeInt(task?.medium_count),
		low: toNonNegativeInt(task?.low_count),
	};
}

function getAgentTaskDefectSummaryStats(
	task:
		| Pick<
				AgentTask,
				| "findings_count"
				| "critical_count"
				| "high_count"
				| "medium_count"
				| "low_count"
		  >
		| null,
): {
	critical: number;
	high: number;
	medium: number;
	low: number;
	total: number;
} {
	return {
		critical: toNonNegativeInt(task?.critical_count),
		high: toNonNegativeInt(task?.high_count),
		medium: toNonNegativeInt(task?.medium_count),
		low: toNonNegativeInt(task?.low_count),
		total: toNonNegativeInt(task?.findings_count),
	};
}

export function mergeSeverityCounts(...counts: SeverityCounts[]): SeverityCounts {
	return counts.reduce<SeverityCounts>(
		(acc, item) => ({
			critical: acc.critical + item.critical,
			high: acc.high + item.high,
			medium: acc.medium + item.medium,
			low: acc.low + item.low,
		}),
		{
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
		},
	);
}

function buildYasaSeverityCounts(
	task?: YasaScanTask | null,
): SeverityCounts {
	// YASA integration: dashboard/task活动口径将 yasa 发现全部归入 low(hint)。
	return {
		critical: 0,
		high: 0,
		medium: 0,
		low: toNonNegativeInt(task?.total_findings),
	};
}

export function getSeverityCountTotal(counts: SeverityCounts): number {
	return counts.critical + counts.high + counts.medium + counts.low;
}

function toRuleScanActivities(
	opengrepTasks: OpengrepScanTask[],
	gitleaksTasks: GitleaksScanTask[],
	banditTasks: BanditScanTask[],
	phpstanTasks: PhpstanScanTask[],
	pmdTasks: PmdScanTask[],
	yasaTasks: YasaScanTask[],
	resolveProjectName: (projectId: string) => string,
): TaskActivityItem[] {
	// Multi-engine grouping: one activity item can contain any selected static engines.
	const visibleOpengrepTasks = opengrepTasks.filter(
		(task) => !task.name.startsWith("Agent Bootstrap OpenGrep"),
	);
	const groups = buildStaticScanGroups({
		opengrepTasks: visibleOpengrepTasks,
		gitleaksTasks,
		banditTasks,
		phpstanTasks,
		pmdTasks,
		yasaTasks,
	});

	return groups
		.map((group): TaskActivityItem | null => {
		const opengrepTask = group.opengrepTask;
		const gitleaksTask = group.gitleaksTask;
		const banditTask = group.banditTask;
		const phpstanTask = group.phpstanTask;
		const pmdTask = group.pmdTask;
		const yasaTask = group.yasaTask;
		const primaryTask =
			opengrepTask || gitleaksTask || banditTask || phpstanTask || pmdTask || yasaTask;
		if (!primaryTask) {
			return null;
		}

		const params = new URLSearchParams();
		params.set("muteToast", "1");
		if (opengrepTask) {
			params.set("opengrepTaskId", opengrepTask.id);
		}
		if (gitleaksTask) {
			params.set("gitleaksTaskId", gitleaksTask.id);
		}
		if (banditTask) {
			params.set("banditTaskId", banditTask.id);
		}
		if (phpstanTask) {
			params.set("phpstanTaskId", phpstanTask.id);
		}
		if (pmdTask) {
			params.set("pmdTaskId", pmdTask.id);
		}
		if (yasaTask) {
			params.set("yasaTaskId", yasaTask.id);
		}
		if (!opengrepTask && gitleaksTask && !banditTask && !phpstanTask && !pmdTask && !yasaTask) {
			params.set("tool", "gitleaks");
		}
		if (!opengrepTask && !gitleaksTask && banditTask && !phpstanTask && !pmdTask && !yasaTask) {
			params.set("tool", "bandit");
		}
		if (!opengrepTask && !gitleaksTask && !banditTask && phpstanTask && !pmdTask && !yasaTask) {
			params.set("tool", "phpstan");
		}
		if (!opengrepTask && !gitleaksTask && !banditTask && !phpstanTask && !yasaTask && pmdTask) {
			params.set("tool", "pmd");
		}
		if (!opengrepTask && !gitleaksTask && !banditTask && !phpstanTask && !pmdTask && yasaTask) {
			params.set("tool", "yasa");
		}

		const durationCandidates = [
			opengrepTask?.scan_duration_ms,
			gitleaksTask?.scan_duration_ms,
			banditTask?.scan_duration_ms,
			phpstanTask?.scan_duration_ms,
			pmdTask?.scan_duration_ms,
			yasaTask?.scan_duration_ms,
		];
		const durationMs = durationCandidates.reduce<number | null>((total, value) => {
			if (
				typeof value !== "number" ||
				!Number.isFinite(value) ||
				value <= 0
			) {
				return total;
			}
			return (total ?? 0) + value;
		}, null);

		const staticFindingStats = mergeSeverityCounts(
			buildOpengrepSeverityCounts(opengrepTask),
			buildGitleaksSeverityCounts(gitleaksTask),
			buildBanditSeverityCounts(banditTask),
			buildPhpstanSeverityCounts(phpstanTask),
			buildPmdSeverityCounts(pmdTask),
			buildYasaSeverityCounts(yasaTask),
		);

		const candidateStatuses = [
			opengrepTask,
			gitleaksTask,
			banditTask,
			phpstanTask,
			pmdTask,
			yasaTask,
		]
			.map((task) => normalizeStatus(task?.status))
			.filter(Boolean);
		const hasRunningStatus = candidateStatuses.some(
			(status) => status === "running" || status === "pending",
		);
		const latestUpdatedAt = [
			opengrepTask,
			gitleaksTask,
			banditTask,
			phpstanTask,
			yasaTask,
		].reduce<string | null>((latest, task) => {
			const current = task?.updated_at || null;
			if (!current) return latest;
			if (!latest) return current;
			return new Date(current).getTime() > new Date(latest).getTime()
				? current
				: latest;
		}, null);
		const completedAt = hasRunningStatus ? null : latestUpdatedAt;

		const item: TaskActivityItem = {
			id: `static-${primaryTask.id}`,
			projectName: resolveProjectName(group.projectId),
			kind: "rule_scan",
			sourceMode: resolveSourceModeFromTaskMeta(
				"rule_scan",
				opengrepTask?.name ||
					gitleaksTask?.name ||
					banditTask?.name ||
					phpstanTask?.name ||
					pmdTask?.name ||
					yasaTask?.name,
			),
			status: resolveStaticScanGroupStatus(group),
			gitleaksEnabled: Boolean(gitleaksTask),
			staticFindingStats,
			createdAt: group.createdAt,
			startedAt: group.createdAt,
			completedAt,
			durationMs,
			route: `/static-analysis/${primaryTask.id}?${params.toString()}`,
			opengrepTaskId: opengrepTask?.id,
			gitleaksTaskId: gitleaksTask?.id,
			banditTaskId: banditTask?.id,
			phpstanTaskId: phpstanTask?.id,
			pmdTaskId: pmdTask?.id,
			yasaTaskId: yasaTask?.id,
		};
		return item;
	})
		.filter((item): item is TaskActivityItem => item !== null);
}

function toAgentActivities(
	agentTasks: AgentTask[],
	resolveProjectName: (projectId: string) => string,
): TaskActivityItem[] {
	return agentTasks.map((task) => ({
		id: `agent-${task.id}`,
		projectName: resolveProjectName(task.project_id),
		kind: "intelligent_audit",
		sourceMode: resolveSourceModeFromTaskMeta(
			"intelligent_audit",
			task.name,
			task.description,
		),
		name: task.name,
		description: task.description,
		status: task.status,
		currentPhase: task.current_phase,
		currentStep: task.current_step,
		workflowPhase: task.workflow_phase ?? null,
		displayPhase: task.display_phase ?? null,
		targetFiles: task.target_files,
		agentFindingStats: getAgentTaskDefectSummaryStats(task),
		createdAt: task.created_at,
		startedAt: task.started_at,
		completedAt: task.completed_at,
		route: `/agent-audit/${task.id}?muteToast=1`,
		agentTaskId: task.id,
	}));
}

const AGENT_TERMINAL_STATUSES = new Set([
	"completed",
	"failed",
	"cancelled",
	"interrupted",
]);

async function interruptAndDeleteStaticTask(
	taskId: string,
	interruptFn: (taskId: string) => Promise<unknown>,
	deleteFn: (taskId: string) => Promise<unknown>,
): Promise<void> {
	try {
		await interruptFn(taskId);
	} catch {
		// Ignore interrupt errors and try hard delete anyway.
	}
	await deleteFn(taskId);
}

export async function deleteTaskActivity(activity: TaskActivityItem): Promise<void> {
	if (activity.kind === "rule_scan") {
		const operations: Array<() => Promise<void>> = [];
		if (activity.opengrepTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.opengrepTaskId,
					interruptOpengrepScanTask,
					deleteOpengrepScanTask,
				),
			);
		}
		if (activity.gitleaksTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.gitleaksTaskId,
					interruptGitleaksScanTask,
					deleteGitleaksScanTask,
				),
			);
		}
		if (activity.banditTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.banditTaskId,
					interruptBanditScanTask,
					deleteBanditScanTask,
				),
			);
		}
		if (activity.phpstanTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.phpstanTaskId,
					interruptPhpstanScanTask,
					deletePhpstanScanTask,
				),
			);
		}
		if (activity.pmdTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.pmdTaskId,
					interruptPmdScanTask,
					deletePmdScanTask,
				),
			);
		}
		if (activity.yasaTaskId) {
			operations.push(() =>
				interruptAndDeleteStaticTask(
					activity.yasaTaskId,
					interruptYasaScanTask,
					deleteYasaScanTask,
				),
			);
		}
		if (operations.length === 0) {
			throw new Error("缺少可删除的静态任务标识");
		}
		for (const runOperation of operations) {
			await runOperation();
		}
		return;
	}

	const taskId = activity.agentTaskId;
	if (!taskId) {
		throw new Error("缺少可删除的智能任务标识");
	}
	const normalizedStatus = String(activity.status || "").trim().toLowerCase();
	if (!AGENT_TERMINAL_STATUSES.has(normalizedStatus)) {
		try {
			await cancelAgentTask(taskId);
		} catch {
			// Ignore cancel errors and try hard delete anyway.
		}
	}
	await deleteAgentTask(taskId);
}

export async function fetchTaskActivities(
	projects: Project[],
	limit = 100,
): Promise<TaskActivityItem[]> {
	const [agentTasks, opengrepTasks, gitleaksTasks, banditTasks, phpstanTasks, pmdTasks, yasaTasks] =
		await Promise.all([
		getAgentTasks({ limit }),
		getOpengrepScanTasks({ limit }),
		getGitleaksScanTasks({ limit }),
		getBanditScanTasks({ limit }),
		getPhpstanScanTasks({ limit }),
		getPmdScanTasks({ limit }),
		getYasaScanTasks({ limit }),
	]);

	const projectNameMap = mapProjectNames(projects);
	const resolveProjectName = (projectId: string) =>
		projectNameMap.get(projectId) || "未知项目";

	const activities = [
		...toRuleScanActivities(
			opengrepTasks,
			gitleaksTasks,
			banditTasks,
			phpstanTasks,
			pmdTasks,
			yasaTasks,
			resolveProjectName,
		),
		...toAgentActivities(agentTasks, resolveProjectName),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	return activities;
}

export function filterActivitiesByKind(
	activities: TaskActivityItem[],
	kind: TaskActivityKind,
	keyword: string,
): TaskActivityItem[] {
	const trimmed = keyword.trim().toLowerCase();
	const filteredByKind = activities.filter(
		(activity) => activity.kind === kind,
	);
	if (!trimmed) return filteredByKind;

	const kindText = kind === "rule_scan" ? "静态扫描" : "智能扫描";
	return filteredByKind.filter((activity) => {
		return (
			activity.projectName.toLowerCase().includes(trimmed) ||
			kindText.includes(trimmed) ||
			getTaskStatusText(activity.status).includes(trimmed)
		);
	});
}

function matchesActivityKeyword(
	activity: TaskActivityItem,
	keyword: string,
): boolean {
	const trimmed = keyword.trim().toLowerCase();
	if (!trimmed) return true;
	const kindText = getTaskKindText(activity);
	return (
		activity.projectName.toLowerCase().includes(trimmed) ||
		kindText.includes(trimmed) ||
		getTaskStatusText(activity.status).includes(trimmed)
	);
}

export function filterIntelligentActivities(
	activities: TaskActivityItem[],
	keyword: string,
): TaskActivityItem[] {
	return activities.filter(
		(activity) =>
			isIntelligentAgentActivity(activity) &&
			matchesActivityKeyword(activity, keyword),
	);
}

export function filterHybridActivities(
	activities: TaskActivityItem[],
	keyword: string,
): TaskActivityItem[] {
	return activities.filter(
		(activity) =>
			isHybridAgentActivity(activity) &&
			matchesActivityKeyword(activity, keyword),
	);
}

export function filterMixedActivities(
	activities: TaskActivityItem[],
	keyword: string,
): TaskActivityItem[] {
	const trimmed = keyword.trim().toLowerCase();
	if (!trimmed) return activities;

	return activities.filter((activity) => {
		const kindText = getTaskKindText(activity);
		return (
			activity.projectName.toLowerCase().includes(trimmed) ||
			kindText.includes(trimmed) ||
			getTaskStatusText(activity.status).includes(trimmed)
		);
	});
}

export function getTaskStatusText(status: string): string {
	return getTaskDisplayStatusSummary(status).statusLabel;
}

export function getTaskStatusClassName(status: string): string {
	const normalized = normalizeStatus(status);
	if (normalized === "completed") {
		return "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40";
	}
	if (normalized === "running" || normalized === "pending") {
		return "bg-sky-500/5 border-sky-500/20 hover:border-sky-500/40";
	}
	if (normalized === "failed") {
		return "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40";
	}
	if (normalized === "cancelled" || normalized === "canceled") {
		return "bg-slate-500/5 border-slate-500/20 hover:border-slate-500/40";
	}
	if (INTERRUPTED_STATUSES.has(normalized)) {
		return "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40";
	}
	return "bg-muted/30 border-border hover:border-border";
}

export function getTaskStatusBadgeClassName(status: string): string {
	return getTaskDisplayStatusSummary(status).badgeClassName;
}

export function getTaskProgressBarClassName(status: string): string {
	return getTaskDisplayStatusSummary(status).progressBarClassName;
}

export function getTaskProgressPercent(
	activity: TaskActivityItem,
	nowMs = Date.now(),
): number {
	return getTaskDisplayProgressPercent({
		status: activity.status,
		createdAt: activity.createdAt,
		startedAt: activity.startedAt,
		nowMs,
	});
}

export function formatCreatedAt(time: string): string {
	const date = new Date(time);
	if (Number.isNaN(date.getTime())) return time;
	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

export function getRelativeTime(time: string, nowMs = Date.now()): string {
	const now = new Date(nowMs);
	const taskDate = new Date(time);
	const diffMs = now.getTime() - taskDate.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);
	if (diffMins < 60) return `${Math.max(diffMins, 1)}分钟前`;
	if (diffHours < 24) return `${diffHours}小时前`;
	return `${diffDays}天前`;
}

export function formatDurationMs(durationMs: number): string {
	return formatTaskDuration(durationMs, { showMsWhenSubSecond: true });
}

export function getActivityDurationLabel(
	activity: TaskActivityItem,
	nowMs = Date.now(),
): string {
	if (activity.kind === "rule_scan") {
		if (
			typeof activity.durationMs === "number" &&
			Number.isFinite(activity.durationMs) &&
			activity.durationMs > 0
		) {
			return `用时：${formatDurationMs(activity.durationMs)}`;
		}
		const started = activity.startedAt || activity.createdAt || null;
		const completed = activity.completedAt || null;
		if (started && completed) {
			const duration =
				new Date(completed).getTime() - new Date(started).getTime();
			if (Number.isFinite(duration) && duration > 0) {
				return `用时：${formatDurationMs(duration)}`;
			}
			return "用时：-";
		}
		if (activity.status === "running" && started) {
			const elapsed = nowMs - new Date(started).getTime();
			if (Number.isFinite(elapsed) && elapsed >= 0) {
				return `已运行：${formatDurationMs(elapsed)}`;
			}
			return "已运行：-";
		}
		return "用时：-";
	}

	const started = activity.startedAt || activity.createdAt || null;
	const completed = activity.completedAt || null;

	if (started && completed) {
		const duration =
			new Date(completed).getTime() - new Date(started).getTime();
		if (Number.isFinite(duration) && duration >= 0) {
			return `用时：${formatDurationMs(duration)}`;
		}
		return "用时：-";
	}

	if (activity.status === "running" && started) {
		const elapsed = nowMs - new Date(started).getTime();
		if (Number.isFinite(elapsed) && elapsed >= 0) {
			return `已运行：${formatDurationMs(elapsed)}`;
		}
		return "已运行：-";
	}

	return "用时：-";
}

export interface TaskActivitySummary {
	staticTotal: number;
	intelligentTotal: number;
	hybridTotal: number;
	running: number;
	completed: number;
	failed: number;
	interrupted: number;
}

export interface TaskStatusSummary {
	total: number;
	completed: number;
	running: number;
}

export function summarizeTaskActivities(
	activities: TaskActivityItem[],
): TaskActivitySummary {
	return activities.reduce<TaskActivitySummary>(
		(acc, activity) => {
			const normalizedStatus = normalizeStatus(activity.status);
			if (activity.kind === "rule_scan") {
				acc.staticTotal += 1;
			} else if (isIntelligentAgentActivity(activity)) {
				acc.intelligentTotal += 1;
			} else {
				acc.hybridTotal += 1;
			}

			if (normalizedStatus === "running" || normalizedStatus === "pending") {
				acc.running += 1;
			} else if (normalizedStatus === "completed") {
				acc.completed += 1;
			} else if (normalizedStatus === "failed") {
				acc.failed += 1;
			} else if (
				normalizedStatus === "cancelled" ||
				normalizedStatus === "canceled" ||
				INTERRUPTED_STATUSES.has(normalizedStatus)
			) {
				acc.interrupted += 1;
			}

			return acc;
		},
		{
			staticTotal: 0,
			intelligentTotal: 0,
			hybridTotal: 0,
			running: 0,
			completed: 0,
			failed: 0,
			interrupted: 0,
		},
	);
}

export function summarizeTaskStatus(
	activities: TaskActivityItem[],
): TaskStatusSummary {
	return activities.reduce<TaskStatusSummary>(
		(acc, activity) => {
			const normalizedStatus = normalizeStatus(activity.status);
			acc.total += 1;
			if (normalizedStatus === "completed") {
				acc.completed += 1;
			} else if (normalizedStatus === "running" || normalizedStatus === "pending") {
				acc.running += 1;
			}
			return acc;
		},
		{
			total: 0,
			completed: 0,
			running: 0,
		},
	);
}
