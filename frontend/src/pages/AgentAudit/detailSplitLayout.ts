const DETAIL_SPLIT_LAYOUT_STORAGE_KEY =
	"agent-audit:detail-split-layout:v1:desktop";

const DEFAULT_LOGS_PANEL_RATIO = 0.25;

export interface AgentAuditSplitLayoutState {
	logsPanelRatio: number;
}

export interface AgentAuditSplitConstraints {
	canResize: boolean;
	defaultLogsPanelRatio: number;
	logsPanelRatio: number;
	minLogsPanelRatio: number;
	maxLogsPanelRatio: number;
}

type ResolveSplitConstraintsInput = {
	containerHeight: number;
	defaultLogsHeightPx: number;
	minLogsHeightPx: number;
	minFindingsHeightPx: number;
};

function resolveStorage(storage?: Storage): Storage | null {
	if (storage) return storage;
	if (typeof window === "undefined") return null;
	return window.localStorage;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function clampLogsPanelRatio(input: number, min = 0, max = 1): number {
	if (!isFiniteNumber(input)) {
		return Math.min(Math.max(DEFAULT_LOGS_PANEL_RATIO, min), max);
	}
	if (min > max) {
		return min;
	}
	return Math.min(Math.max(input, min), max);
}

export function readAgentAuditSplitLayout(
	storage?: Storage,
): AgentAuditSplitLayoutState | null {
	const target = resolveStorage(storage);
	if (!target) return null;

	try {
		const raw = target.getItem(DETAIL_SPLIT_LAYOUT_STORAGE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}

		const ratio = (parsed as { logsPanelRatio?: unknown }).logsPanelRatio;
		if (!isFiniteNumber(ratio)) {
			return null;
		}

		return {
			logsPanelRatio: clampLogsPanelRatio(ratio),
		};
	} catch {
		return null;
	}
}

export function writeAgentAuditSplitLayout(
	state: AgentAuditSplitLayoutState,
	storage?: Storage,
): void {
	const target = resolveStorage(storage);
	if (!target) return;

	try {
		target.setItem(
			DETAIL_SPLIT_LAYOUT_STORAGE_KEY,
			JSON.stringify({
				logsPanelRatio: clampLogsPanelRatio(state.logsPanelRatio),
			}),
		);
	} catch {
		// Ignore storage failures so the page can keep working.
	}
}

export function resolveDefaultLogsPanelRatio(
	containerHeight: number,
	defaultLogsHeightPx: number,
): number {
	if (!isFiniteNumber(containerHeight) || containerHeight <= 0) {
		return DEFAULT_LOGS_PANEL_RATIO;
	}
	return clampLogsPanelRatio(defaultLogsHeightPx / containerHeight);
}

export function resolveSplitConstraints({
	containerHeight,
	defaultLogsHeightPx,
	minLogsHeightPx,
	minFindingsHeightPx,
}: ResolveSplitConstraintsInput): AgentAuditSplitConstraints {
	const defaultLogsPanelRatio = resolveDefaultLogsPanelRatio(
		containerHeight,
		defaultLogsHeightPx,
	);

	if (!isFiniteNumber(containerHeight) || containerHeight <= 0) {
		return {
			canResize: false,
			defaultLogsPanelRatio,
			logsPanelRatio: defaultLogsPanelRatio,
			minLogsPanelRatio: 0,
			maxLogsPanelRatio: 1,
		};
	}

	const minLogsPanelRatio = clampLogsPanelRatio(
		minLogsHeightPx / containerHeight,
	);
	const maxLogsPanelRatio = clampLogsPanelRatio(
		1 - minFindingsHeightPx / containerHeight,
	);
	const canResize = maxLogsPanelRatio >= minLogsPanelRatio;
	const fallbackLogsPanelRatio = canResize
		? clampLogsPanelRatio(
				defaultLogsPanelRatio,
				minLogsPanelRatio,
				maxLogsPanelRatio,
			)
		: defaultLogsPanelRatio;

	return {
		canResize,
		defaultLogsPanelRatio,
		logsPanelRatio: fallbackLogsPanelRatio,
		minLogsPanelRatio: canResize ? minLogsPanelRatio : 0,
		maxLogsPanelRatio: canResize ? maxLogsPanelRatio : 1,
	};
}
