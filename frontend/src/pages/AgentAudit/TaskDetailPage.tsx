/**
 * Agent task detail page.
 * Keeps the existing detail experience on a dedicated route.
 */

import {
	ArrowDown,
	Bot,
	Download,
	Layers,
	Loader2,
	Terminal,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { StreamErrorContext } from "@/shared/api/agentStream";
import {
	type AgentEvent,
	type AgentFinding,
	type AgentTaskProgressResponse,
	cancelAgentTask,
	downloadAgentLogs,
	getAgentEvents,
	getAgentFindings,
	getAgentTask,
	getAgentTaskProgress,
	getAgentTree,
	updateAgentFindingStatus,
} from "@/shared/api/agentTasks";
import { api } from "@/shared/api/database";
import {
	getOpengrepScanFindings,
	type OpengrepFinding,
} from "@/shared/api/opengrep";
import { useLogoVariant } from "@/shared/branding/useLogoVariant";
import {
	buildAgentFindingDetailNavigation,
	buildAgentFindingDetailRoute,
} from "@/shared/utils/findingRoute";
import {
	getAgentAuditTaskDetailSnapshot,
	isAgentAuditTaskDetailSnapshotFresh,
	isAgentAuditTaskDetailSnapshotReusable,
	saveAgentAuditTaskDetailSnapshot,
} from "./taskDetailSnapshotStore";
import {
	getTaskAutoScroll,
	PROGRAMMATIC_SCROLL_GUARD_MS,
	persistTaskAutoScroll,
	shouldDisableAutoScrollOnScroll,
} from "./autoScrollState";
// Local imports
import {
	AgentErrorBoundary,
	AuditDetailDialog,
	EventLogVirtualList,
	Header,
	RealtimeFindingsPanel,
	StatsPanel,
} from "./components";
import type { RealtimeMergedFindingItem } from "./components/RealtimeFindingsPanel";
import ReportExportDialog from "./components/ReportExportDialog";
import {
	EVENT_LOG_GRID_TEMPLATE,
	EVENT_LOG_TABLE_MIN_WIDTH_PX,
	POLLING_INTERVALS,
} from "./constants";
import {
	clampLogsPanelRatio,
	readAgentAuditSplitLayout,
	resolveSplitConstraints,
	writeAgentAuditSplitLayout,
} from "./detailSplitLayout";
import {
	type AgentAuditFindingDisplayStatus,
	accumulateTokenUsage,
	buildAgentAuditTaskFindingCountersPatch,
	buildStatsSummary,
	createTokenUsageAccumulator,
	getAgentAuditFindingDisplayStatus,
	getAgentAuditFindingManualDisplayStatus,
	isFalsePositiveFinding,
	readAgentAuditFindingsPagination,
	resolveAgentFindingDetailId,
	resolveAgentAuditBackTarget,
	resolveAgentAuditDetailTitle,
	writeAgentAuditFindingsPagination,
} from "./detailViewModel";
import { useAgentAuditState } from "./hooks";
import {
	localizeAuditText,
	normalizeEventLogPhaseLabel,
	normalizeSeverityKey,
	toZhAgentName,
} from "./localization";
import {
	fromAgentFinding as agentFindingToRealtimeItem,
} from "./realtimeFindingMapper";
import { buildAgentDisplayStageSummary } from "./stageProgress";
import {
	buildAgentAuditStreamDisconnectTitle,
	isAgentAuditActiveStatus,
	toAgentAuditStatusLabel,
} from "./taskStatus";
import { getTerminalStatusTransitionPolicy } from "./terminalStatePolicy";
import {
	expectsNativeToolEvidence,
	isToolEvidenceCapableTool,
	parseToolEvidenceFromLog,
} from "./toolEvidence";
import type {
	BootstrapInputsSummary,
	DetailViewState,
	FindingsFiltersChangeOptions,
	FindingsViewFilters,
	LateToolCallPolicy,
	LogItem,
	TerminalFailureClass,
	TerminalRecoveryState,
	ToolEvidenceMissingState,
} from "./types";
import {
	cleanThinkingContent,
	compactAgentAuditDisplayLogs,
	computeContainerAnchorScrollTop,
	getTimeString,
	resolveLogDisplayTime,
	sanitizeAuditText,
	shouldIgnoreStaleToolEvent,
} from "./utils";

const EVENT_PAGE_SIZE = 500;
const EVENT_BATCH_SAFETY_LIMIT = 200;
const FINDINGS_REFRESH_INTERVAL = 10000;
const FINDINGS_PAGE_SIZE = 200;
const BOOTSTRAP_FINDING_PAGE_SIZE = 200;
const EVENT_DEDUP_WINDOW_SIZE = 5000;
const TERMINAL_RECOVERY_MAX_ATTEMPTS = 2;
const TERMINAL_RECOVERY_RETRY_INTERVAL_MS = 1500;
const TERMINAL_RECOVERY_DEBOUNCE_MS = 30_000;
const STREAM_SELF_HEAL_RETRY_MS = 4000;
const AGENT_LOG_BACKFILL_INTERVAL_MS = 5000;
const LOG_VIEWPORT_DEFAULT_HEIGHT_PX = 200;
const LOG_VIEWPORT_MIN_HEIGHT_PX = 96;
const FINDINGS_PANEL_MIN_HEIGHT_PX = 320;
const LOG_AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX = 24;
const TERMINAL_STATUSES = new Set([
	"completed",
	"failed",
	"cancelled",
	"aborted",
	"interrupted",
]);

const PROGRESS_PATTERNS: { pattern: RegExp; key: string }[] = [
	{ pattern: /索引进度[:：]?\s*\d+\/\d+/, key: "index_progress" },
	{ pattern: /克隆进度[:：]?\s*\d+%/, key: "clone_progress" },
	{ pattern: /下载进度[:：]?\s*\d+%/, key: "download_progress" },
	{ pattern: /上传进度[:：]?\s*\d+%/, key: "upload_progress" },
	{ pattern: /扫描进度[:：]?\s*\d+/, key: "scan_progress" },
	{ pattern: /分析进度[:：]?\s*\d+/, key: "analyze_progress" },
];

type RealtimeQueueSnapshot = {
	riskQueue: {
		recon: number;
		blrecon: number;
	};
	vulnerabilityQueue: {
		finding: number;
		blfinding: number;
	};
	resultQueue: number;
};

const DEFAULT_REALTIME_QUEUE_SNAPSHOT: RealtimeQueueSnapshot = {
	riskQueue: {
		recon: 0,
		blrecon: 0,
	},
	vulnerabilityQueue: {
		finding: 0,
		blfinding: 0,
	},
	resultQueue: 0,
};

function toNonNegativeInteger(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return 0;
	}
	return Math.max(0, Math.floor(parsed));
}

function buildRealtimeQueueSnapshot(
	progress: AgentTaskProgressResponse | null | undefined,
): RealtimeQueueSnapshot {
	const riskQueue = progress?.queue_overview?.risk_queue;
	const vulnerabilityQueue = progress?.queue_overview?.vulnerability_queue;
	const resultQueue = progress?.queue_overview?.result_queue;

	return {
		riskQueue: {
			recon: toNonNegativeInteger(
				riskQueue?.recon ?? progress?.recon_queue?.current_size,
			),
			blrecon: toNonNegativeInteger(
				riskQueue?.blrecon ?? progress?.business_logic_queue?.current_size,
			),
		},
		vulnerabilityQueue: {
			finding: toNonNegativeInteger(
				vulnerabilityQueue?.finding ??
					progress?.analysis_queue?.finding_current_size,
			),
			blfinding: toNonNegativeInteger(
				vulnerabilityQueue?.blfinding ??
					progress?.analysis_queue?.blfinding_current_size,
			),
		},
		resultQueue: toNonNegativeInteger(
			resultQueue?.current_size ?? progress?.result_queue?.current_size,
		),
	};
}

function arePanelLayoutsEqual(current: number[], next: number[]): boolean {
	if (current.length !== next.length) {
		return false;
	}

	return current.every((value, index) => Math.abs(value - next[index]) < 0.5);
}

type HomeScanCard = {
	key: "static" | "agent" | "hybrid";
	title: string;
	intro: string;
	icon: typeof Zap;
	accentClassName: string;
	targetRoute: string;
};

const createDefaultFindingsFilters = (): FindingsViewFilters => ({
	keyword: "",
	severity: "all",
});

type UnifiedAgentEvent = {
	type?: string;
	event_type?: string;
	timestamp?: string | null;
	message?: string | null;
	metadata?: Record<string, unknown> | null;
	sequence?: number;
	status?: string;
	tool_name?: string | null;
	tool_input?: unknown;
	tool_output?: unknown;
	tool_duration_ms?: number | null;
	tokens_used?: number | null;
	error?: string | null;
};

function matchProgressKey(message: string): string | null {
	const matched = PROGRESS_PATTERNS.find((item) => item.pattern.test(message));
	return matched?.key ?? null;
}

function eventToString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function extractToolOutputText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "object" && value !== null) {
		const data = value as Record<string, unknown>;
		const resultValue = data.result;
		if (typeof resultValue === "string") {
			return resultValue;
		}
	}
	return eventToString(value);
}

function resolveTaskToolEvidenceProtocol(
	task:
		| { tool_evidence_protocol?: "legacy" | "native_v1" | null }
		| null
		| undefined,
): "legacy" | "native_v1" | null {
	const protocol = task?.tool_evidence_protocol;
	return protocol === "native_v1"
		? "native_v1"
		: protocol === "legacy"
			? "legacy"
			: null;
}

function resolveToolEvidenceMissingState(input: {
	expectsNativeEvidence: boolean;
	taskProtocol: "legacy" | "native_v1" | null;
	toolStatus: "completed" | "failed" | "cancelled";
	hasNativePayload: boolean;
}): ToolEvidenceMissingState | null {
	if (!input.expectsNativeEvidence || input.hasNativePayload) {
		return null;
	}
	if (input.taskProtocol === "legacy") {
		return "historical_rerun_required";
	}
	if (input.taskProtocol !== "native_v1") {
		return null;
	}
	if (input.toolStatus === "failed") {
		return "missing_failed";
	}
	if (input.toolStatus === "cancelled") {
		return "missing_cancelled";
	}
	return "missing_completed";
}

function toNonEmptyId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function extractToolCallId(
	metadata: Record<string, unknown> | undefined,
	event?: UnifiedAgentEvent,
): string | null {
	const eventRecord = event as Record<string, unknown> | undefined;
	const toolRecord =
		eventRecord &&
		typeof eventRecord.tool === "object" &&
		eventRecord.tool !== null
			? (eventRecord.tool as Record<string, unknown>)
			: undefined;
	return (
		toNonEmptyId(metadata?.tool_call_id) ||
		toNonEmptyId(eventRecord?.tool_call_id) ||
		toNonEmptyId(toolRecord?.call_id) ||
		toNonEmptyId(toolRecord?.id)
	);
}

function buildToolBucketKey(
	agentRawName: string | undefined,
	agentName: string | undefined,
	toolName: string,
): string {
	const owner =
		String(agentRawName || agentName || "unknown")
			.trim()
			.toLowerCase() || "unknown";
	const tool =
		String(toolName || "unknown")
			.trim()
			.toLowerCase() || "unknown";
	return `${owner}|${tool}`;
}

function extractEventTimestamp(
	event: UnifiedAgentEvent,
	metadata?: Record<string, unknown>,
): string | null {
	const eventRecord = event as Record<string, unknown>;
	const timestampCandidates: unknown[] = [
		eventRecord.timestamp,
		metadata?.timestamp,
	];
	for (const candidate of timestampCandidates) {
		if (typeof candidate !== "string") continue;
		const trimmed = candidate.trim();
		if (!trimmed) continue;
		const ts = new Date(trimmed).getTime();
		if (Number.isFinite(ts)) {
			return trimmed;
		}
	}
	return null;
}

function buildToolTitle(
	statusLabel: string,
	toolName: string,
	metadata?: Record<string, unknown>,
): string {
	void metadata;
	return `${statusLabel}：${toolName}`;
}

function buildToolRouteContentPrefix(
	metadata?: Record<string, unknown>,
): string {
	void metadata;
	return "";
}

function buildEventDedupKey(
	eventType: string,
	sequence: number | undefined,
	toolCallId: string | null,
	message: string,
): string {
	if (typeof sequence === "number" && Number.isFinite(sequence)) {
		return `seq:${sequence}`;
	}
	const source = `${eventType}|${toolCallId || "none"}|${message}`;
	let hash = 0;
	for (let i = 0; i < source.length; i += 1) {
		hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
	}
	return `fallback:${eventType}:${toolCallId || "none"}:${hash.toString(16)}`;
}

function sanitizeAuditValue(value: unknown): unknown {
	if (typeof value === "string") {
		return sanitizeAuditText(value);
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeAuditValue(item));
	}
	if (value && typeof value === "object") {
		const output: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			output[key] = sanitizeAuditValue(item);
		}
		return output;
	}
	return value;
}

function extractStepName(message: string): string | null {
	const matched = message.trim().match(/^\[([A-Z0-9_]+)\]/);
	return matched?.[1] ?? null;
}

function normalizeToolStatus(
	statusValue: unknown,
	fallbackEventType: string,
): "completed" | "failed" | "cancelled" {
	const normalized = String(statusValue || "")
		.trim()
		.toLowerCase();
	if (normalized === "failed" || normalized === "error") {
		return "failed";
	}
	if (
		normalized === "cancelled" ||
		normalized === "canceled" ||
		normalized === "aborted"
	) {
		return "cancelled";
	}
	if (fallbackEventType === "tool_call_error") {
		return "failed";
	}
	return "completed";
}

function toCnVerificationStatus(value: unknown): string {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	if (normalized === "verified" || normalized === "confirmed") return "确报";
	if (normalized === "running") return "验证中";
	if (
		normalized === "pending" ||
		normalized === "open" ||
		normalized === "needs_review" ||
		normalized === "likely" ||
		normalized === "uncertain" ||
		normalized === "new" ||
		normalized === "analyzing"
	) {
		return "待确认";
	}
	if (normalized === "false_positive") return "误报";
	return normalized || "未知状态";
}

function classifyTerminalFailure(
	reasonText: string,
	metadata?: Record<string, unknown>,
	userCancelled = false,
): {
	failureClass: TerminalFailureClass;
	retryable: boolean;
	cancelOrigin: "user" | "system" | "none";
} {
	const retryClass = String(metadata?.retry_error_class || "")
		.trim()
		.toLowerCase();
	const retryableFromMetadata =
		typeof metadata?.retryable === "boolean"
			? Boolean(metadata.retryable)
			: null;
	const cancelOriginRaw = String(metadata?.cancel_origin || "")
		.trim()
		.toLowerCase();
	const cancelOrigin: "user" | "system" | "none" =
		cancelOriginRaw === "user"
			? "user"
			: cancelOriginRaw === "system"
				? "system"
				: userCancelled
					? "user"
					: "none";
	const reason = String(reasonText || "")
		.trim()
		.toLowerCase();

	if (cancelOrigin === "user" || retryClass === "cancelled_user") {
		return {
			failureClass: "cancelled_user",
			retryable: false,
			cancelOrigin: "user",
		};
	}
	if (retryClass === "cancelled_system") {
		return {
			failureClass: "cancelled_system",
			retryable: true,
			cancelOrigin: "system",
		};
	}
	if (retryClass === "timeout_error" || /timeout|超时/.test(reason)) {
		return {
			failureClass: "timeout",
			retryable: retryableFromMetadata ?? true,
			cancelOrigin,
		};
	}
	if (
		retryClass === "tool_runtime_error" ||
		/runtime|adapter|command_not_found|tool_unavailable/.test(reason)
	) {
		return {
			failureClass: "runtime",
			retryable: retryableFromMetadata ?? true,
			cancelOrigin,
		};
	}
	if (
		retryClass === "network_transient_error" ||
		/network|connection|dns|503|502|429/.test(reason)
	) {
		return {
			failureClass: "network",
			retryable: retryableFromMetadata ?? true,
			cancelOrigin,
		};
	}
	if (
		retryClass === "repairable_validation_error" ||
		/参数校验失败|缺少|missing required|required field/.test(reason)
	) {
		return {
			failureClass: "validation_repairable",
			retryable: retryableFromMetadata ?? true,
			cancelOrigin,
		};
	}
	if (retryClass === "schema_hard_error") {
		return { failureClass: "non_retryable", retryable: false, cancelOrigin };
	}
	if (typeof retryableFromMetadata === "boolean") {
		return {
			failureClass: retryableFromMetadata ? "unknown" : "non_retryable",
			retryable: retryableFromMetadata,
			cancelOrigin,
		};
	}
	return { failureClass: "unknown", retryable: false, cancelOrigin };
}

function isTruthyMetadataFlag(value: unknown): boolean {
	return (
		value === true ||
		String(value || "")
			.trim()
			.toLowerCase() === "true"
	);
}

function isRetryingTimeoutWarning(
	eventType: string,
	metadata?: Record<string, unknown>,
): boolean {
	if (eventType !== "warning") {
		return false;
	}
	const retryClass = String(metadata?.retry_error_class || "")
		.trim()
		.toLowerCase();
	const retryable =
		typeof metadata?.retryable === "boolean"
			? metadata.retryable
			: isTruthyMetadataFlag(metadata?.retryable);
	const terminal = isTruthyMetadataFlag(metadata?.is_terminal);
	return retryClass === "timeout_error" && retryable && !terminal;
}

function toSafeNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return null;
}

function toSafeTrimmedString(value: unknown): string {
	return String(value ?? "").trim();
}

function toDialogFinding(item: RealtimeMergedFindingItem): AgentFinding {
	const aiStatus = getAgentAuditFindingDisplayStatus(item);
	const manualStatus = getAgentAuditFindingManualDisplayStatus(item);
	const falsePositive = aiStatus === "false_positive";
	const isVerified = manualStatus === "verified";
	return {
		id: item.id,
		task_id: "",
		vulnerability_type: item.vulnerability_type,
		severity: item.severity,
		title: item.title,
		display_title: item.display_title ?? null,
		description: item.description ?? null,
		description_markdown: item.description_markdown ?? null,
		file_path: item.file_path ?? null,
		line_start: item.line_start ?? null,
		line_end: item.line_end ?? null,
		code_snippet: item.code_snippet ?? null,
		code_context: item.code_context ?? null,
		cwe_id: item.cwe_id ?? null,
		context_start_line: item.context_start_line ?? null,
		context_end_line: item.context_end_line ?? null,
		status: falsePositive
			? "false_positive"
			: aiStatus === "verified"
				? "verified"
				: "pending",
		manual_status:
			manualStatus === "false_positive"
				? "false_positive"
				: manualStatus === "verified"
					? "verified"
					: "needs_review",
		is_verified: isVerified,
		verdict: item.verdict ?? item.authenticity ?? null,
		reachability: null,
		authenticity: item.authenticity ?? null,
		verification_evidence: item.verification_evidence ?? null,
		verification_todo_id: item.verification_todo_id ?? null,
		verification_fingerprint: item.verification_fingerprint ?? null,
		reachability_file: item.reachability_file ?? null,
		reachability_function: item.reachability_function ?? null,
		reachability_function_start_line:
			item.reachability_function_start_line ?? null,
		reachability_function_end_line: item.reachability_function_end_line ?? null,
		has_poc: false,
		poc_code: null,
		suggestion: null,
		fix_code: null,
		ai_explanation: null,
		ai_confidence: item.confidence ?? null,
		confidence: item.confidence ?? null,
		function_trigger_flow: item.function_trigger_flow ?? null,
		created_at: item.timestamp ?? new Date().toISOString(),
	};
}

function applyManualStatusToPersistedFinding(
	finding: AgentFinding,
	target: Exclude<AgentAuditFindingDisplayStatus, "open">,
): AgentFinding {
	return {
		...finding,
		manual_status: target,
		is_verified: target === "verified",
	};
}

function applyManualStatusToRealtimeFinding(
	item: RealtimeMergedFindingItem,
	target: Exclude<AgentAuditFindingDisplayStatus, "open">,
): RealtimeMergedFindingItem {
	return {
		...item,
		manual_status: target,
		is_verified: target === "verified",
	};
}

function AgentAuditPageContent() {
	const { taskId } = useParams<{ taskId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const {
		task,
		findings,
		agentTree,
		logs,
		isLoading,
		isAutoScroll,
		treeNodes,
		filteredLogs,
		isRunning,
		setTask,
		setFindings,
		setAgentTree,
		updateLog,
		removeLog,
		selectAgent,
		setLoading,
		setAutoScroll,
		setCurrentAgentName,
		getCurrentAgentName,
		setCurrentThinkingId,
		getCurrentThinkingId,
		dispatch,
		reset,
	} = useAgentAuditState();

	const [showSplash, setShowSplash] = useState(!taskId);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const [activeMainTab, setActiveMainTab] = useState<"logs" | "findings">(
		"logs",
	);
	const [isFindingsLoading, setIsFindingsLoading] = useState(Boolean(taskId));
	const [, setFindingsError] = useState<string | null>(null);
	const [findingsFilters, setFindingsFilters] = useState<FindingsViewFilters>(
		() => createDefaultFindingsFilters(),
	);
	// NOTE: bootstrap (opengrep) input UI is currently not shown in the new realtime layout,
	// but we keep the plumbing in place for future toggles.
	const [bootstrapInputsSummary, setBootstrapInputsSummary] =
		useState<BootstrapInputsSummary | null>(null);
	const [, setBootstrapInputFindings] = useState<OpengrepFinding[]>([]);
	const [, setBootstrapInputsLoading] = useState(false);
	const [, setBootstrapInputsError] = useState<string | null>(null);
	const [detailViewState, setDetailViewState] =
		useState<DetailViewState | null>(null);
	const [detailDialog, setDetailDialog] = useState<{
		type: "log" | "finding" | "agent";
		id: string;
	} | null>(null);
	const [terminalFailureReason, setTerminalFailureReason] = useState<
		string | null
	>(null);
	const displayLogs = useMemo(
		() => compactAgentAuditDisplayLogs(filteredLogs),
		[filteredLogs],
	);
	const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);
	const [, setHighlightedFindingId] = useState<string | null>(null);
	const [, setHighlightedAgentId] = useState<string | null>(null);
	const [realtimeQueueSnapshot, setRealtimeQueueSnapshot] =
		useState<RealtimeQueueSnapshot>(DEFAULT_REALTIME_QUEUE_SNAPSHOT);

	// Realtime panels state
	const [realtimeFindings, setRealtimeFindings] = useState<RealtimeMergedFindingItem[]>([]);
	const [findingStatusUpdatingKey, setFindingStatusUpdatingKey] = useState<
		string | null
	>(null);
	const [projectName, setProjectName] = useState<string | null>(null);
	const [tokenUsage, setTokenUsage] = useState(() =>
		createTokenUsageAccumulator(),
	);
	const [statsNow, setStatsNow] = useState(() => new Date());
	const [detailSplitHeight, setDetailSplitHeight] = useState(0);
	const [detailSplitWidth, setDetailSplitWidth] = useState(0);
	const [desktopLogsPanelRatio, setDesktopLogsPanelRatio] = useState<
		number | null
	>(() => {
		return readAgentAuditSplitLayout()?.logsPanelRatio ?? null;
	});
	const [detailSplitContainerElement, setDetailSplitContainerElement] =
		useState<HTMLDivElement | null>(null);
	const detailSplitGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
	const splitDraggingRef = useRef(false);
	const setDetailSplitContainerNode = useCallback(
		(node: HTMLDivElement | null) => {
			setDetailSplitContainerElement(node);
			setDetailSplitHeight(node?.clientHeight ?? 0);
			setDetailSplitWidth(node?.clientWidth ?? 0);
		},
		[],
	);
	const detailSplitConstraints = useMemo(
		() =>
			resolveSplitConstraints({
				containerHeight: detailSplitHeight,
				defaultLogsHeightPx: LOG_VIEWPORT_DEFAULT_HEIGHT_PX,
				minLogsHeightPx: LOG_VIEWPORT_MIN_HEIGHT_PX,
				minFindingsHeightPx: FINDINGS_PANEL_MIN_HEIGHT_PX,
			}),
		[detailSplitHeight],
	);
	const resolvedDesktopLogsPanelRatio = useMemo(() => {
		const requestedRatio =
			desktopLogsPanelRatio ?? detailSplitConstraints.defaultLogsPanelRatio;
		if (!detailSplitConstraints.canResize) {
			return detailSplitConstraints.logsPanelRatio;
		}
		return clampLogsPanelRatio(
			requestedRatio,
			detailSplitConstraints.minLogsPanelRatio,
			detailSplitConstraints.maxLogsPanelRatio,
		);
	}, [desktopLogsPanelRatio, detailSplitConstraints]);
	const desktopSplitLayout = useMemo(() => {
		const logsSize = resolvedDesktopLogsPanelRatio * 100;
		return [100 - logsSize, logsSize];
	}, [resolvedDesktopLogsPanelRatio]);
	const detailSplitHandlePositionPx = useMemo(() => {
		if (detailSplitWidth <= 0) {
			return undefined;
		}
		return Math.round(detailSplitWidth / 2);
	}, [detailSplitWidth]);
	const desktopLogsPanelPercent = useMemo(
		() => desktopSplitLayout[1] ?? resolvedDesktopLogsPanelRatio * 100,
		[desktopSplitLayout, resolvedDesktopLogsPanelRatio],
	);
	const verifiedFindingsManuallyClearedRef = useRef(false);

	const logsContainerRef = useRef<HTMLDivElement | null>(null);
	const hasInitializedLogViewportRef = useRef(false);
	const findingsContainerRef = useRef<HTMLDivElement | null>(null);
	const agentContainerRef = useRef<HTMLDivElement | null>(null);
	const logsRef = useRef(logs);
	const findingsRef = useRef(findings);
	const taskSnapshotRef = useRef(task);
	const toolLogIdByCallIdRef = useRef<Map<string, string>>(new Map());
	const pendingToolBucketsRef = useRef<Map<string, string[]>>(new Map());
	const agentTreeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const scrollGuardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastAgentTreeRefreshTime = useRef<number>(0);
	const previousTaskIdRef = useRef<string | undefined>(undefined);
	const initialBootstrapTaskIdRef = useRef<string | null>(null);
	const disconnectStreamRef = useRef<(() => void) | null>(null);
	const lastEventSequenceRef = useRef<number>(0);
	const seenEventKeysRef = useRef<Set<string>>(new Set());
	const seenEventOrderRef = useRef<string[]>([]);
	const hasConnectedRef = useRef<boolean>(false); //  追踪是否已连接 SSE
	const streamConnectedStateRef = useRef(false);
	const hasLoadedHistoricalEventsRef = useRef<boolean>(false); //  追踪是否已加载历史事件
	const isBackfillingRef = useRef(false);
	const previousTaskStatusRef = useRef<string | undefined>(undefined);
	const taskStatusRef = useRef<string | undefined>(undefined);
	const terminalBoundarySequenceRef = useRef<number | null>(null);
	const taskStartedAtRef = useRef<string | null>(null);
	const currentLogPhaseLabelRef = useRef<string | null>(null);
	const userCancelSeenRef = useRef(false);
	const ignoreScrollUntilRef = useRef(0);
	const lastStreamSelfHealAttemptRef = useRef(0);
	const terminalRecoveryStateRef = useRef<TerminalRecoveryState>({
		active: false,
		attempts: 0,
		reasonKey: "",
		triggeredAt: 0,
	});
	const runTerminalRecoveryRef = useRef<
		((triggerReason: string, metadata?: Record<string, unknown>) => void) | null
	>(null);
	//  使用 state 来标记历史事件加载状态和触发 streamOptions 重新计算
	const [afterSequence, setAfterSequence] = useState<number>(0);
	const [historicalEventsLoaded, setHistoricalEventsLoaded] =
		useState<boolean>(false);
	const { logoSrc, cycleLogoVariant } = useLogoVariant();
	const cachedTaskDetailSnapshot = useMemo(
		() => (taskId ? getAgentAuditTaskDetailSnapshot(taskId) : null),
		[taskId],
	);
	const persistedFindingRouteItems = useMemo(
		() => findings.map(agentFindingToRealtimeItem),
		[findings],
	);
	const visibleManagedFindings = useMemo(() => {
		// NOTE: 关闭“实时/历史事件漏洞”前端解析展示，统一仅展示持久化 findings。
		// 这样可以避免事件态条目（无置信度/不可操作）干扰终态列表。
		return persistedFindingRouteItems;
	}, [persistedFindingRouteItems]);
	const failedReason = useMemo(() => {
		if (task?.status !== "failed") return null;
		const reason = terminalFailureReason || task.error_message || "";
		const normalized = reason.trim();
		return normalized || "任务执行失败";
	}, [task?.status, task?.error_message, terminalFailureReason]);
	const failedStep = useMemo(
		() => (failedReason ? extractStepName(failedReason) : null),
		[failedReason],
	);
	const hydrateTaskDetailSnapshot = useCallback(() => {
		if (!cachedTaskDetailSnapshot) {
			return;
		}

		const snapshot = cachedTaskDetailSnapshot.data;
		if (snapshot.task) {
			setTask(snapshot.task);
		}
		setFindings(snapshot.findings);
		if (snapshot.agentTree) {
			setAgentTree(snapshot.agentTree);
		}
		dispatch({ type: "SET_LOGS", payload: snapshot.logs });
		setProjectName(snapshot.projectName);
		setRealtimeFindings(snapshot.realtimeFindings);
		setTokenUsage({
			...snapshot.tokenUsage,
			seenSequences: new Set(snapshot.tokenUsage.seenSequences),
		});
		setTerminalFailureReason(snapshot.terminalFailureReason);
		logsRef.current = snapshot.logs;
		findingsRef.current = snapshot.findings;
		taskSnapshotRef.current = snapshot.task;
		taskStatusRef.current = snapshot.task?.status;
		taskStartedAtRef.current =
			typeof snapshot.task?.started_at === "string"
				? snapshot.task.started_at.trim() || null
				: null;
		currentLogPhaseLabelRef.current = normalizeEventLogPhaseLabel({
			rawPhase: snapshot.task?.current_phase,
			taskStatus: snapshot.task?.status,
		});
		lastEventSequenceRef.current = Math.max(0, snapshot.afterSequence);
		setAfterSequence(lastEventSequenceRef.current);
		hasLoadedHistoricalEventsRef.current = snapshot.historicalEventsLoaded;
		setHistoricalEventsLoaded(snapshot.historicalEventsLoaded);
		previousTaskStatusRef.current = snapshot.task?.status;
	}, [
		cachedTaskDetailSnapshot,
		dispatch,
		setAgentTree,
		setFindings,
		setTask,
	]);

	useEffect(() => {
		const node = detailSplitContainerElement;
		if (!node) {
			return;
		}

		const updateSize = (nextRect?: DOMRectReadOnly) => {
			const measuredHeight = nextRect?.height ?? node.clientHeight;
			const measuredWidth = nextRect?.width ?? node.clientWidth;
			setDetailSplitHeight((current) =>
				current === measuredHeight ? current : measuredHeight,
			);
			setDetailSplitWidth((current) =>
				current === measuredWidth ? current : measuredWidth,
			);
		};

		updateSize();
		if (typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			updateSize(entry?.contentRect);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [detailSplitContainerElement]);

	useEffect(() => {
		const nextRatio = resolvedDesktopLogsPanelRatio;
		if (
			desktopLogsPanelRatio === null ||
			Math.abs(desktopLogsPanelRatio - nextRatio) > 0.001
		) {
			setDesktopLogsPanelRatio(nextRatio);
		}
		writeAgentAuditSplitLayout({ logsPanelRatio: nextRatio });
	}, [desktopLogsPanelRatio, resolvedDesktopLogsPanelRatio]);

	useEffect(() => {
		const group = detailSplitGroupRef.current;
		if (!group) {
			return;
		}

		const nextLayout = desktopSplitLayout;
		const currentLayout = group.getLayout();
		if (!arePanelLayoutsEqual(currentLayout, nextLayout)) {
			group.setLayout(nextLayout);
		}
	}, [desktopSplitLayout]);

	const statsSummary = useMemo(
		() =>
			task
				? buildStatsSummary({
						task,
						displayFindings: visibleManagedFindings,
						tokenUsage,
						now: statsNow,
					})
				: null,
		[statsNow, task, tokenUsage, visibleManagedFindings],
	);
	const stageSummary = useMemo(
		() =>
			buildAgentDisplayStageSummary({
				task,
				logs,
			}),
		[logs, task],
	);
	const selectedLogItem = useMemo(
		() =>
			detailDialog?.type === "log"
				? logs.find((item) => item.id === detailDialog.id) || null
				: null,
		[detailDialog, logs],
	);
	const selectedFinding = useMemo(() => {
		if (detailDialog?.type !== "finding") return null;
		const persistedFinding = findings.find(
			(item) => item.id === detailDialog.id,
		);
		if (persistedFinding) return persistedFinding;
		const realtimeFinding = visibleManagedFindings.find(
			(item) => item.id === detailDialog.id,
		);
		return realtimeFinding ? toDialogFinding(realtimeFinding) : null;
	}, [detailDialog, findings, visibleManagedFindings]);
	const handleFindingsFiltersChange = useCallback(
		(
			nextFilters: FindingsViewFilters,
			_options?: FindingsFiltersChangeOptions,
		) => {
			setFindingsFilters(nextFilters);
		},
		[],
	);
	const handleToggleFindingStatus = useCallback(
		async (
			item: RealtimeMergedFindingItem,
			target: Exclude<AgentAuditFindingDisplayStatus, "open">,
		) => {
			if (!taskId) return;

			const updatingKey = `${item.id}:${target}`;
			setFindingStatusUpdatingKey(updatingKey);
			try {
				await updateAgentFindingStatus(taskId, item.id, target);

				const currentFindings = findingsRef.current;
				const currentTask = taskSnapshotRef.current;
				const nextFindings = currentFindings.map((finding) =>
					finding.id === item.id
						? applyManualStatusToPersistedFinding(finding, target)
						: finding,
				);
				setFindings(nextFindings);
				if (currentTask) {
					setTask({
						...currentTask,
						...buildAgentAuditTaskFindingCountersPatch({
							task: currentTask,
							findings: nextFindings,
						}),
					});
				}
				setRealtimeFindings((prev) =>
					prev.map((current) =>
						current.id === item.id
							? applyManualStatusToRealtimeFinding(current, target)
							: current,
					),
				);
				void getAgentTask(taskId)
					.then((snapshot) => {
						setTask(snapshot);
					})
					.catch((reloadError) => {
						console.warn(
							"[AgentAudit] failed to refresh task counters after manual status update",
							reloadError,
						);
					});

				toast.success(target === "verified" ? "已标记为确报" : "已标记为误报");
			} catch (error) {
				console.error(error);
				const message =
					typeof (error as { response?: { data?: { detail?: string } } })
						?.response?.data?.detail === "string"
						? (error as { response?: { data?: { detail?: string } } }).response
								?.data?.detail
						: "更新漏洞状态失败";
				toast.error(message || "更新漏洞状态失败");
			} finally {
				setFindingStatusUpdatingKey((current) =>
					current === updatingKey ? null : current,
				);
			}
		},
		[setFindings, setTask, taskId],
	);
	const selectedAgentNode = useMemo(
		() =>
			detailDialog?.type === "agent"
				? treeNodes.find((item) => item.agent_id === detailDialog.id) || null
				: null,
		[detailDialog, treeNodes],
	);
	const detailTitle = useMemo(() => {
		const searchParams = new URLSearchParams(location.search);
		return resolveAgentAuditDetailTitle({
			returnTo: searchParams.get("returnTo"),
			name: task?.name,
			description: task?.description,
		});
	}, [location.search, task?.description, task?.name]);
	const currentRoute = `${location.pathname}${location.search}`;
	const findingsPagination = useMemo(
		() =>
			readAgentAuditFindingsPagination(new URLSearchParams(location.search)),
		[location.search],
	);
	const homeScanCards: HomeScanCard[] = useMemo(
		() => [
			{
				key: "static",
				title: "静态扫描",
				intro: "通过严重规则快速、准确定位漏洞",
				icon: Zap,
				accentClassName:
					"from-sky-500/25 via-cyan-500/10 to-transparent border-sky-400/40",
				targetRoute: "/tasks/static?openCreate=1&source=home-card",
			},
			{
				key: "agent",
				title: "智能扫描",
				intro: "智能体上下文推理扫描",
				icon: Bot,
				accentClassName:
					"from-violet-500/25 via-indigo-500/10 to-transparent border-violet-400/40",
				targetRoute: "/tasks/intelligent?openCreate=1&source=home-card",
			},
			{
				key: "hybrid",
				title: "混合扫描",
				intro: "静态 + 智能双阶段链路",
				icon: Layers,
				accentClassName:
					"from-emerald-500/25 via-cyan-500/10 to-transparent border-emerald-400/40",
				targetRoute: "/tasks/hybrid?openCreate=1&source=home-card",
			},
		],
		[],
	);
	const currentPhaseLabel = useMemo(() => {
		if (stageSummary?.currentStageLabel) {
			return stageSummary.currentStageLabel;
		}
		if (stageSummary?.headline) {
			return stageSummary.headline;
		}
		const fallbackStatusLabel = toAgentAuditStatusLabel(task?.status);
		if (fallbackStatusLabel) {
			return fallbackStatusLabel;
		}
		return null;
	}, [stageSummary, task?.status]);
	const phaseHint = useMemo(() => {
		if (stageSummary?.hint) return stageSummary.hint;
		const currentStep = String(task?.current_step || "").trim();
		if (currentStep) return currentStep;
		if (!isRunning) return null;
		if (currentPhaseLabel) return `当前阶段：${currentPhaseLabel}`;
		return null;
	}, [stageSummary?.hint, task?.current_step, isRunning, currentPhaseLabel]);
	const setDetailQuery = useCallback(
		(nextDetail: { type: "log" | "finding" | "agent"; id: string } | null) => {
			const params = new URLSearchParams(location.search);
			if (nextDetail) {
				params.set("detailType", nextDetail.type);
				params.set("detailId", nextDetail.id);
			} else {
				params.delete("detailType");
				params.delete("detailId");
			}
			const search = params.toString();
			navigate(
				{
					pathname: location.pathname,
					search: search ? `?${search}` : "",
				},
				{ replace: true },
			);
		},
		[location.pathname, location.search, navigate],
	);

	const handleFindingsPaginationChange = useCallback(
		(next: { page: number; pageSize: number }) => {
			const params = writeAgentAuditFindingsPagination(
				new URLSearchParams(location.search),
				next,
			);
			const search = params.toString();
			navigate(
				{
					pathname: location.pathname,
					search: search ? `?${search}` : "",
				},
				{ replace: true },
			);
		},
		[location.pathname, location.search, navigate],
	);

	const clearHighlights = useCallback(() => {
		setHighlightedLogId(null);
		setHighlightedFindingId(null);
		setHighlightedAgentId(null);
	}, []);

	const restoreAndScrollToAnchor = useCallback(
		(state: DetailViewState | null) => {
			if (!state) return;
			// Legacy: preserve stored tab state, but current UI is split into realtime+right-panel.
			setActiveMainTab(state.activeTab);
			handleFindingsFiltersChange(state.filters, { source: "user" });
			selectAgent(null);

			requestAnimationFrame(() => {
				if (logsContainerRef.current) {
					logsContainerRef.current.scrollTop = state.logsScrollTop;
				}
				if (findingsContainerRef.current) {
					findingsContainerRef.current.scrollTop = state.findingsScrollTop;
				}
				if (agentContainerRef.current) {
					agentContainerRef.current.scrollTop = state.agentScrollTop;
				}

				clearHighlights();
				if (state.detailType === "log") {
					setHighlightedLogId(state.detailId);
				} else if (state.detailType === "finding") {
					setHighlightedFindingId(state.detailId);
				} else if (state.detailType === "agent") {
					setHighlightedAgentId(state.detailId);
				}

				const anchor = document.getElementById(state.anchorId);
				const container =
					state.detailType === "log"
						? logsContainerRef.current
						: state.detailType === "finding"
							? findingsContainerRef.current
							: agentContainerRef.current;
				if (anchor && container) {
					const containerRect = container.getBoundingClientRect();
					const anchorRect = anchor.getBoundingClientRect();
					container.scrollTop = computeContainerAnchorScrollTop({
						containerScrollTop: container.scrollTop,
						containerClientHeight: container.clientHeight,
						containerTop: containerRect.top,
						anchorTop: anchorRect.top,
						anchorHeight: anchorRect.height,
					});
				}
				if (highlightClearTimerRef.current) {
					clearTimeout(highlightClearTimerRef.current);
				}
				highlightClearTimerRef.current = setTimeout(() => {
					highlightClearTimerRef.current = null;
					clearHighlights();
				}, 1800);
			});
		},
		[clearHighlights, handleFindingsFiltersChange, selectAgent],
	);

	const openDetailDialog = useCallback(
		(detail: {
			type: "log" | "finding" | "agent";
			id: string;
			anchorId: string;
		}) => {
			setDetailViewState({
				detailType: detail.type,
				detailId: detail.id,
				anchorId: detail.anchorId,
				activeTab: activeMainTab,
				logsScrollTop: logsContainerRef.current?.scrollTop ?? 0,
				findingsScrollTop: findingsContainerRef.current?.scrollTop ?? 0,
				agentScrollTop: agentContainerRef.current?.scrollTop ?? 0,
				filters: findingsFilters,
			});
			setDetailDialog({
				type: detail.type,
				id: detail.id,
			});
			setDetailQuery({ type: detail.type, id: detail.id });
		},
		[activeMainTab, findingsFilters, setDetailQuery],
	);

	const handleOpenLogDetail = useCallback(
		(id: string, anchorId: string) => {
			openDetailDialog({
				type: "log",
				id,
				anchorId,
			});
		},
		[openDetailDialog],
	);

	const openFindingDetailPage = useCallback(
		(item: RealtimeMergedFindingItem) => {
			if (!taskId) return;
			const snapshot = toDialogFinding(item);
			const findingId = resolveAgentFindingDetailId({
				requestedId: item.id,
				realtimeFinding: item,
				persistedFindings: persistedFindingRouteItems,
			});
			const target = buildAgentFindingDetailNavigation({
				taskId,
				findingId,
				currentRoute,
				snapshot,
			});
			navigate(target.route, { state: target.state });
		},
		[currentRoute, navigate, persistedFindingRouteItems, taskId],
	);

	const handleDetailBack = useCallback(() => {
		if (!detailDialog) return;
		setDetailDialog(null);
		setDetailQuery(null);
		restoreAndScrollToAnchor(detailViewState);
		setDetailViewState(null);
	}, [detailDialog, detailViewState, restoreAndScrollToAnchor, setDetailQuery]);

	const handleBack = useCallback(() => {
		const searchParams = new URLSearchParams(location.search);
		const target = resolveAgentAuditBackTarget(
			searchParams.get("returnTo"),
			typeof window !== "undefined" && window.history.length > 1,
		);
		if (target === -1) {
			navigate(-1);
			return;
		}
		navigate(target);
	}, [location.search, navigate]);

	useEffect(() => {
		logsRef.current = logs;
	}, [logs]);

	useEffect(() => {
		findingsRef.current = findings;
	}, [findings]);

	useEffect(() => {
		taskSnapshotRef.current = task;
	}, [task]);

	useEffect(() => {
		taskStatusRef.current = task?.status;
	}, [task?.status]);

	useEffect(() => {
		currentLogPhaseLabelRef.current = normalizeEventLogPhaseLabel({
			rawPhase: task?.current_phase,
			taskStatus: task?.status,
		});
	}, [task?.current_phase, task?.status]);

	useEffect(() => {
		if (!taskId) {
			return;
		}
		if (
			!task &&
			!findings.length &&
			!logs.length &&
			!agentTree &&
			!projectName &&
			!visibleManagedFindings.length &&
			!terminalFailureReason
		) {
			return;
		}
		saveAgentAuditTaskDetailSnapshot(taskId, {
			task,
			findings,
			logs,
			agentTree,
			projectName,
			realtimeFindings: visibleManagedFindings,
			tokenUsage,
			afterSequence,
			historicalEventsLoaded,
			terminalFailureReason,
		});
	}, [
		afterSequence,
		agentTree,
		findings,
		historicalEventsLoaded,
		logs,
		projectName,
		task,
		taskId,
		terminalFailureReason,
		tokenUsage,
		visibleManagedFindings,
	]);

	const markTerminalBoundary = useCallback(
		(status: string, sequence?: number) => {
			const normalizedStatus = String(status || "")
				.trim()
				.toLowerCase();
			if (!TERMINAL_STATUSES.has(normalizedStatus)) return;
			taskStatusRef.current = normalizedStatus;
			if (typeof sequence === "number") {
				const current = terminalBoundarySequenceRef.current;
				terminalBoundarySequenceRef.current =
					typeof current === "number" ? Math.max(current, sequence) : sequence;
			}
		},
		[],
	);

	const resolveLogPhaseLabel = useCallback(
		(input: {
			rawPhase?: unknown;
			eventType?: unknown;
			taskStatus?: unknown;
			message?: unknown;
			fallbackPhaseLabel?: string | null;
			useCurrentSnapshot?: boolean;
		}): string | null => {
			const phaseLabel = normalizeEventLogPhaseLabel({
				rawPhase: input.rawPhase,
				eventType: input.eventType,
				taskStatus: input.taskStatus ?? taskStatusRef.current,
				message: input.message,
				fallbackPhaseLabel:
					input.fallbackPhaseLabel ??
					(input.useCurrentSnapshot === false
						? null
						: currentLogPhaseLabelRef.current),
			});
			if (phaseLabel) {
				currentLogPhaseLabelRef.current = phaseLabel;
			}
			return phaseLabel;
		},
		[],
	);

	useEffect(() => {
		const startedAt =
			typeof task?.started_at === "string" ? task.started_at.trim() : "";
		taskStartedAtRef.current = startedAt || null;
	}, [task?.started_at]);

	useEffect(() => {
		setStatsNow(new Date());
		const status = String(task?.status || "")
			.trim()
			.toLowerCase();
		if (!isAgentAuditActiveStatus(status) || !taskStartedAtRef.current) {
			return;
		}
		const timer = setInterval(() => {
			setStatsNow(new Date());
		}, 1000);
		return () => clearInterval(timer);
	}, [task?.status]);

	useEffect(() => {
		const startedAt = taskStartedAtRef.current;
		if (!startedAt || !logsRef.current.length) return;

		let changed = false;
		const nextLogs = logsRef.current.map((item) => {
			const eventTimestamp =
				typeof item.eventTimestamp === "string"
					? item.eventTimestamp.trim()
					: "";
			if (!eventTimestamp) return item;
			const nextTime = resolveLogDisplayTime(
				startedAt,
				eventTimestamp,
				item.time,
			);
			if (nextTime === item.time) return item;
			changed = true;
			return {
				...item,
				time: nextTime,
			};
		});

		if (changed) {
			logsRef.current = nextLogs;
			dispatch({ type: "SET_LOGS", payload: nextLogs });
		}
	}, [dispatch]);

	//  当 taskId 变化时立即重置状态（新建任务时清理旧日志）
	useEffect(() => {
		// 如果 taskId 发生变化，立即重置
		if (taskId !== previousTaskIdRef.current) {
			// 1. 先断开旧的 SSE 流连接
			if (disconnectStreamRef.current) {
				disconnectStreamRef.current();
				disconnectStreamRef.current = null;
			}
			// 2. 重置所有状态
			reset();
			setShowSplash(!taskId);
			hasInitializedLogViewportRef.current = false;

			// 2.1 重置 realtime 面板
			setRealtimeFindings([]);
			verifiedFindingsManuallyClearedRef.current = false;
			// 3. 重置事件序列号和加载状态
			lastEventSequenceRef.current = 0;
			hasConnectedRef.current = false; //  重置 SSE 连接标志
			streamConnectedStateRef.current = false;
			hasLoadedHistoricalEventsRef.current = false; //  重置历史事件加载标志
			isBackfillingRef.current = false;
			previousTaskStatusRef.current = undefined;
			setHistoricalEventsLoaded(false); //  重置历史事件加载状态
			setAfterSequence(0); //  重置 afterSequence state
			setActiveMainTab("logs");
			setFindingsError(null);
			setIsFindingsLoading(Boolean(taskId));
			handleFindingsFiltersChange(createDefaultFindingsFilters(), {
				source: "system",
			});
			setTokenUsage(createTokenUsageAccumulator());
			setStatsNow(new Date());
			setBootstrapInputsSummary(null);
			setBootstrapInputFindings([]);
			setBootstrapInputsLoading(false);
			setBootstrapInputsError(null);
			setDetailViewState(null);
			setDetailDialog(null);
			setHighlightedLogId(null);
			setHighlightedFindingId(null);
			setHighlightedAgentId(null);
			setTerminalFailureReason(null);
			toolLogIdByCallIdRef.current.clear();
			pendingToolBucketsRef.current.clear();
			seenEventKeysRef.current.clear();
			seenEventOrderRef.current = [];
			userCancelSeenRef.current = false;
			lastStreamSelfHealAttemptRef.current = 0;
			terminalRecoveryStateRef.current = {
				active: false,
				attempts: 0,
				reasonKey: "",
				triggeredAt: 0,
			};
			terminalBoundarySequenceRef.current = null;
			if (cachedTaskDetailSnapshot) {
				hydrateTaskDetailSnapshot();
				setShowSplash(false);
				setLoading(false);
			}
		}
		setAutoScroll(getTaskAutoScroll(taskId || null));
		previousTaskIdRef.current = taskId;
	}, [
		cachedTaskDetailSnapshot,
		handleFindingsFiltersChange,
		hydrateTaskDetailSnapshot,
		reset,
		setAutoScroll,
		setLoading,
		taskId,
	]);

	useEffect(() => {
		return () => {
			if (agentTreeRefreshTimer.current) {
				clearTimeout(agentTreeRefreshTimer.current);
				agentTreeRefreshTimer.current = null;
			}
			if (highlightClearTimerRef.current) {
				clearTimeout(highlightClearTimerRef.current);
				highlightClearTimerRef.current = null;
			}
			if (scrollGuardTimeoutRef.current) {
				clearTimeout(scrollGuardTimeoutRef.current);
				scrollGuardTimeoutRef.current = null;
			}
			if (disconnectStreamRef.current) {
				disconnectStreamRef.current();
				disconnectStreamRef.current = null;
			}
			toolLogIdByCallIdRef.current.clear();
			pendingToolBucketsRef.current.clear();
			seenEventKeysRef.current.clear();
			seenEventOrderRef.current = [];
		};
	}, []);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const detailType = params.get("detailType");
		const detailId = params.get("detailId");
		if (!detailType || !detailId) return;
		if (detailType === "finding") {
			if (!taskId) return;
			const selectedRealtimeFinding =
				visibleManagedFindings.find((item) => item.id === detailId) ?? null;
			const resolvedDetailId = resolveAgentFindingDetailId({
				requestedId: detailId,
				realtimeFinding: selectedRealtimeFinding,
				persistedFindings: persistedFindingRouteItems,
			});
			if (
				findings.some(
					(item) =>
						!isFalsePositiveFinding(item) && item.id === resolvedDetailId,
				) ||
				visibleManagedFindings.some((item) => item.id === detailId)
			) {
				navigate(
					buildAgentFindingDetailRoute({
						taskId,
						findingId: resolvedDetailId,
						currentRoute,
					}),
					{ replace: true },
				);
			}
			return;
		}
		if (detailDialog?.type === detailType && detailDialog?.id === detailId)
			return;
		if (detailType === "log") {
			if (logs.some((item) => item.id === detailId)) {
				setDetailDialog({ type: "log", id: detailId });
			}
			return;
		}
		if (detailType === "agent") {
			if (treeNodes.some((item) => item.agent_id === detailId)) {
				setDetailDialog({ type: "agent", id: detailId });
			}
		}
	}, [
		currentRoute,
		detailDialog?.id,
		detailDialog?.type,
		findings,
		location.search,
		logs,
		navigate,
		persistedFindingRouteItems,
		taskId,
		treeNodes,
		visibleManagedFindings,
	]);

	// ============ Data Loading ============

	const loadTask = useCallback(async (): Promise<AgentTask | null> => {
		if (!taskId) return null;
		try {
			const data = await getAgentTask(taskId);
			setTask(data);
			if (data.status === "failed" && typeof data.error_message === "string") {
				const message = data.error_message.trim();
				if (message) {
					setTerminalFailureReason(message);
				}
			}
			return data;
		} catch {
			toast.error("加载任务失败");
			return null;
		}
	}, [taskId, setTask]);

	useEffect(() => {
		let cancelled = false;

		async function loadProjectName() {
			const projectId = String(task?.project_id || "").trim();
			if (!projectId) {
				setProjectName(null);
				return;
			}

			try {
				const project = await api.getProjectById(projectId);
				if (cancelled) return;
				setProjectName(String(project?.name || "").trim() || "-");
			} catch {
				if (!cancelled) {
					setProjectName("-");
				}
			}
		}

		void loadProjectName();
		return () => {
			cancelled = true;
		};
	}, [task?.project_id]);

	const loadFindings = useCallback(
		async (options?: { silent?: boolean; taskStatusOverride?: string | null }) => {
			if (!taskId) return;
			const silent = options?.silent ?? false;
			if (!silent) {
				setIsFindingsLoading(true);
			}
			setFindingsError(null);
			const normalizedTaskStatus = String(
				options?.taskStatusOverride ?? task?.status ?? "",
			)
				.trim()
				.toLowerCase();
			if (!TERMINAL_STATUSES.has(normalizedTaskStatus)) {
				// 仅在明确可判定为非终态时清空；避免首屏并发加载时用空状态误清空已落库漏洞。
				if (normalizedTaskStatus) {
					setFindings([]);
				}
				if (!silent) {
					setIsFindingsLoading(false);
				}
				return;
			}
			try {
				const allFindings: AgentFinding[] = [];
				let skip = 0;
				for (let batch = 0; batch < EVENT_BATCH_SAFETY_LIMIT; batch += 1) {
					const page = await getAgentFindings(taskId, {
						include_false_positive: true,
						skip,
						limit: FINDINGS_PAGE_SIZE,
					});
					if (!page.length) break;
					allFindings.push(...page);
					skip += page.length;
					if (page.length < FINDINGS_PAGE_SIZE) break;
				}
				setFindings(allFindings);
			} catch (err) {
				console.error(err);
				const message = err instanceof Error ? err.message : "加载扫描结果失败";
				setFindingsError(message);
			} finally {
				if (!silent) {
					setIsFindingsLoading(false);
				}
			}
		},
		[task?.status, taskId, setFindings],
	);

	const loadBootstrapInputFindings = useCallback(async (scanTaskId: string) => {
		setBootstrapInputsLoading(true);
		setBootstrapInputsError(null);
		try {
			const allFindings: OpengrepFinding[] = [];
			let skip = 0;
			for (let batch = 0; batch < EVENT_BATCH_SAFETY_LIMIT; batch += 1) {
				const page = await getOpengrepScanFindings({
					taskId: scanTaskId,
					skip,
					limit: BOOTSTRAP_FINDING_PAGE_SIZE,
				});
				if (!page.length) break;
				allFindings.push(...page);
				skip += page.length;
				if (page.length < BOOTSTRAP_FINDING_PAGE_SIZE) break;
			}

			const filtered = allFindings.filter((item) => {
				const severity = String(item.severity || "")
					.trim()
					.toUpperCase();
				const confidence = String(item.confidence || "")
					.trim()
					.toUpperCase();
				return (
					severity === "ERROR" &&
					(confidence === "HIGH" || confidence === "MEDIUM")
				);
			});

			setBootstrapInputFindings(filtered);
			setBootstrapInputsSummary((prev) =>
				prev && prev.taskId === scanTaskId
					? {
							...prev,
							candidateCount: Math.max(prev.candidateCount, filtered.length),
							totalFindings: Math.max(prev.totalFindings, allFindings.length),
						}
					: prev,
			);
		} catch (error) {
			console.error("Failed to load bootstrap input findings:", error);
			setBootstrapInputsError("加载静态输入失败");
			setBootstrapInputFindings([]);
		} finally {
			setBootstrapInputsLoading(false);
		}
	}, []);

	const loadAgentTree = useCallback(async () => {
		if (!taskId) return;
		try {
			const data = await getAgentTree(taskId);
			setAgentTree(data);
		} catch (err) {
			console.error(err);
		}
	}, [taskId, setAgentTree]);

	const loadTaskProgress = useCallback(async () => {
		if (!taskId) return;
		try {
			const progress = await getAgentTaskProgress(taskId);
			setRealtimeQueueSnapshot(buildRealtimeQueueSnapshot(progress));
		} catch (error) {
			console.error("[AgentAudit] Failed to load task progress:", error);
		}
	}, [taskId]);

	const debouncedLoadAgentTree = useCallback(() => {
		const now = Date.now();
		const minInterval = POLLING_INTERVALS.AGENT_TREE_DEBOUNCE;

		if (agentTreeRefreshTimer.current) {
			clearTimeout(agentTreeRefreshTimer.current);
		}

		const timeSinceLastRefresh = now - lastAgentTreeRefreshTime.current;
		if (timeSinceLastRefresh < minInterval) {
			agentTreeRefreshTimer.current = setTimeout(() => {
				lastAgentTreeRefreshTime.current = Date.now();
				loadAgentTree();
			}, minInterval - timeSinceLastRefresh);
		} else {
			agentTreeRefreshTimer.current = setTimeout(() => {
				lastAgentTreeRefreshTime.current = Date.now();
				loadAgentTree();
			}, POLLING_INTERVALS.AGENT_TREE_MIN_DELAY);
		}
	}, [loadAgentTree]);

	const fetchAllHistoricalEvents = useCallback(
		async (targetTaskId: string, startAfter = 0): Promise<AgentEvent[]> => {
			let afterSequenceCursor = startAfter;
			const allEvents: AgentEvent[] = [];

			for (let batch = 0; batch < EVENT_BATCH_SAFETY_LIMIT; batch += 1) {
				const page = await getAgentEvents(targetTaskId, {
					after_sequence: afterSequenceCursor,
					limit: EVENT_PAGE_SIZE,
				});
				if (!page.length) {
					break;
				}
				page.sort((a, b) => a.sequence - b.sequence);
				allEvents.push(...page);
				afterSequenceCursor = page[page.length - 1].sequence;

				if (page.length < EVENT_PAGE_SIZE) {
					break;
				}
			}

			return allEvents;
		},
		[],
	);

	const reconcileTerminalLogs = useCallback(
		(finalStatus: string, terminalSequence?: number) => {
			const normalized = String(finalStatus || "")
				.trim()
				.toLowerCase();
			if (!TERMINAL_STATUSES.has(normalized)) {
				return;
			}

			const nextToolStatus: "completed" | "failed" | "cancelled" =
				normalized === "completed"
					? "completed"
					: normalized === "failed"
						? "failed"
						: "cancelled";
			const nextToolLabel =
				nextToolStatus === "completed"
					? "已完成"
					: nextToolStatus === "failed"
						? "失败"
						: "已取消";

			let changed = false;
			const reconciled = logsRef.current.map((item) => {
				let nextItem: LogItem = item;
				if (item.type === "tool" && item.tool?.status === "running") {
					const title =
						item.title.startsWith("运行中：") && item.tool?.name
							? `${nextToolLabel}：${item.tool.name}`
							: item.title;
					nextItem = {
						...item,
						title,
						tool: {
							...item.tool,
							status: nextToolStatus,
						},
						detail: {
							...(item.detail || {}),
							terminal_reconciled: true,
							terminal_status: normalized,
							terminal_sequence:
								typeof terminalSequence === "number"
									? terminalSequence
									: undefined,
						},
					};
					changed = true;
				} else if (
					item.type === "progress" &&
					item.progressStatus === "running"
				) {
					nextItem = {
						...item,
						progressStatus: "completed",
						detail: {
							...(item.detail || {}),
							terminal_reconciled: true,
							terminal_status: normalized,
							terminal_sequence:
								typeof terminalSequence === "number"
									? terminalSequence
									: undefined,
						},
					};
					changed = true;
				}
				return nextItem;
			});

			if (changed) {
				logsRef.current = reconciled;
				dispatch({ type: "SET_LOGS", payload: reconciled });
			}
		},
		[dispatch],
	);

	const compactToolLogsAfterReplay = useCallback(() => {
		const currentLogs = logsRef.current;
		if (!currentLogs.length) return;

		const terminalByCallId = new Map<
			string,
			{ id: string; sequence: number }
		>();
		const terminalByBucket = new Map<string, number>();
		const getSequence = (item: LogItem): number => {
			const seq = toSafeNumber(item.detail?.sequence);
			return seq ?? -1;
		};

		for (const item of currentLogs) {
			if (item.type !== "tool") continue;
			const toolStatus = item.tool?.status;
			const toolName = String(item.tool?.name || "").trim();
			if (!toolName) continue;
			const callId =
				toNonEmptyId(item.tool?.callId) ||
				toNonEmptyId(
					(item.detail?.metadata as Record<string, unknown> | undefined)
						?.tool_call_id,
				);
			const bucketKey = buildToolBucketKey(
				item.agentRawName,
				item.agentName,
				toolName,
			);
			const sequence = getSequence(item);
			const isTerminal =
				toolStatus === "completed" ||
				toolStatus === "failed" ||
				toolStatus === "cancelled";
			if (!isTerminal) continue;

			if (callId) {
				const previous = terminalByCallId.get(callId);
				if (!previous || sequence >= previous.sequence) {
					terminalByCallId.set(callId, { id: item.id, sequence });
				}
			}
			const previousBucketSeq = terminalByBucket.get(bucketKey);
			if (previousBucketSeq === undefined || sequence >= previousBucketSeq) {
				terminalByBucket.set(bucketKey, sequence);
			}
		}

		const compacted: LogItem[] = [];
		let changed = false;
		for (const item of currentLogs) {
			if (item.type !== "tool") {
				compacted.push(item);
				continue;
			}
			const toolName = String(item.tool?.name || "").trim();
			const toolStatus = item.tool?.status;
			const sequence = getSequence(item);
			const callId =
				toNonEmptyId(item.tool?.callId) ||
				toNonEmptyId(
					(item.detail?.metadata as Record<string, unknown> | undefined)
						?.tool_call_id,
				);
			const bucketKey = buildToolBucketKey(
				item.agentRawName,
				item.agentName,
				toolName,
			);

			if (callId) {
				const terminal = terminalByCallId.get(callId);
				if (terminal) {
					if (toolStatus === "running") {
						changed = true;
						continue;
					}
					const isTerminal =
						toolStatus === "completed" ||
						toolStatus === "failed" ||
						toolStatus === "cancelled";
					if (isTerminal && item.id !== terminal.id) {
						changed = true;
						continue;
					}
				}
			} else if (toolStatus === "running") {
				const bucketTerminalSeq = terminalByBucket.get(bucketKey);
				if (bucketTerminalSeq !== undefined && sequence <= bucketTerminalSeq) {
					changed = true;
					continue;
				}
			}

			compacted.push(item);
		}

		const rebuiltCallIdMap = new Map<string, string>();
		const rebuiltPendingBuckets = new Map<string, string[]>();
		for (const item of compacted) {
			if (item.type !== "tool") continue;
			const toolName = String(item.tool?.name || "").trim();
			const callId =
				toNonEmptyId(item.tool?.callId) ||
				toNonEmptyId(
					(item.detail?.metadata as Record<string, unknown> | undefined)
						?.tool_call_id,
				);
			if (callId) {
				rebuiltCallIdMap.set(callId, item.id);
			} else if (toolName && item.tool?.status === "running") {
				const bucket = buildToolBucketKey(
					item.agentRawName,
					item.agentName,
					toolName,
				);
				const queue = rebuiltPendingBuckets.get(bucket) ?? [];
				queue.push(item.id);
				rebuiltPendingBuckets.set(bucket, queue);
			}
		}
		toolLogIdByCallIdRef.current = rebuiltCallIdMap;
		pendingToolBucketsRef.current = rebuiltPendingBuckets;

		if (changed) {
			logsRef.current = compacted;
			dispatch({ type: "SET_LOGS", payload: compacted });
		}
	}, [dispatch]);

	const appendLogFromEvent = useCallback(
		(event: UnifiedAgentEvent) => {
			const eventRecord = event as Record<string, unknown>;
			const eventType = String(
				event.event_type ?? event.type ?? "",
			).toLowerCase();
			const rawMessage = eventToString(event.message).trim();
			const message = sanitizeAuditText(rawMessage);
			const metadata = (event.metadata ?? undefined) as
				| Record<string, unknown>
				| undefined;
			const rawPhase =
				(typeof eventRecord.phase === "string" && eventRecord.phase) ||
				(typeof metadata?.phase === "string" && metadata.phase) ||
				undefined;
			const eventPhaseLabel = resolveLogPhaseLabel({
				rawPhase,
				eventType,
				message,
			});
			const eventKey = buildEventDedupKey(
				eventType,
				event.sequence,
				extractToolCallId(metadata, event),
				message,
			);
			if (seenEventKeysRef.current.has(eventKey)) {
				return;
			}
			seenEventKeysRef.current.add(eventKey);
			seenEventOrderRef.current.push(eventKey);
			if (seenEventOrderRef.current.length > EVENT_DEDUP_WINDOW_SIZE) {
				const expired = seenEventOrderRef.current.shift();
				if (expired) {
					seenEventKeysRef.current.delete(expired);
				}
			}

			const sanitizedMetadata = sanitizeAuditValue(metadata ?? {}) as Record<
				string,
				unknown
			>;
			const eventTimestamp = extractEventTimestamp(event, metadata);
			const displayTime = resolveLogDisplayTime(
				taskStartedAtRef.current,
				eventTimestamp,
				getTimeString(),
			);
			const agentRawName =
				(typeof metadata?.agent_name === "string" && metadata.agent_name) ||
				(typeof metadata?.agent === "string" && metadata.agent) ||
				undefined;
			const agentRole =
				typeof metadata?.agent_role === "string" && metadata.agent_role
					? String(metadata.agent_role)
					: undefined;
			const agentModuleName =
				(typeof metadata?.module_name === "string" && metadata.module_name) ||
				(typeof metadata?.module_id === "string" && metadata.module_id) ||
				undefined;
			const agentName =
				typeof agentRawName === "string" && agentRawName.trim()
					? toZhAgentName(agentRawName, {
							agentRole,
							moduleName: agentModuleName,
						})
					: undefined;
			const baseDetail = {
				event_type: eventType,
				message,
				metadata: sanitizedMetadata,
				sequence: event.sequence ?? null,
				status: event.status ?? null,
				tool_name:
					typeof event.tool_name === "string"
						? sanitizeAuditText(event.tool_name)
						: (event.tool_name ?? null),
				tool_input: sanitizeAuditValue(event.tool_input ?? null),
				tool_output: sanitizeAuditValue(event.tool_output ?? null),
				tool_duration_ms: event.tool_duration_ms ?? null,
				event_timestamp: eventTimestamp,
			};
			const bootstrapTaskId =
				typeof metadata?.bootstrap_task_id === "string"
					? metadata.bootstrap_task_id.trim()
					: "";
			if (
				bootstrapTaskId &&
				(metadata?.bootstrap === true ||
					typeof metadata?.bootstrap_source === "string")
			) {
				const totalFindings = toSafeNumber(metadata?.bootstrap_total_findings);
				const candidateCount = toSafeNumber(
					metadata?.bootstrap_candidate_count,
				);
				const sourceValue =
					typeof metadata?.bootstrap_source === "string"
						? metadata.bootstrap_source
						: "scan_forced";
				setBootstrapInputsSummary((prev) => ({
					taskId: bootstrapTaskId,
					source: sourceValue || prev?.source || "scan_forced",
					totalFindings: totalFindings ?? prev?.totalFindings ?? 0,
					candidateCount: candidateCount ?? prev?.candidateCount ?? 0,
				}));
			}

			if (typeof event.sequence === "number") {
				lastEventSequenceRef.current = Math.max(
					lastEventSequenceRef.current,
					event.sequence,
				);
			}

			if (eventType === "heartbeat") {
				return;
			}

			if (eventType === "llm_observation" && metadata?.deduped === true) {
				return;
			}

			if (
				eventType === "thinking_start" ||
				eventType === "thinking_end" ||
				eventType === "thinking_token"
			) {
				return;
			}

			if (eventType.startsWith("llm_") || eventType === "thinking") {
				const thought =
					typeof metadata?.thought === "string"
						? sanitizeAuditText(metadata.thought)
						: "";
				const content = thought || message || "";
				if (!content) {
					return;
				}
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "thinking",
						phaseLabel: eventPhaseLabel,
						title:
							content.length > 100 ? `${content.slice(0, 100)}...` : content,
						content,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}

			if (eventType === "tool_call" || eventType === "tool_call_start") {
				const toolName = sanitizeAuditText(event.tool_name || "未知") || "未知";
				const runningTitle = buildToolTitle("运行中", toolName, metadata);
				const routePrefix = buildToolRouteContentPrefix(metadata);
				const boundarySequence = terminalBoundarySequenceRef.current;
				const isLateAfterTerminal =
					typeof boundarySequence === "number" &&
					(typeof event.sequence !== "number" ||
						event.sequence > boundarySequence);
				if (isLateAfterTerminal) {
					const statusSnapshot = String(
						taskStatusRef.current || "",
					).toLowerCase();
					const latePolicy: LateToolCallPolicy =
						statusSnapshot === "completed" ? "ignore" : "recovery";
					dispatch({
						type: "ADD_LOG",
						payload: {
							time: displayTime,
							eventTimestamp,
							type: "info",
							phaseLabel: eventPhaseLabel,
							title:
								latePolicy === "ignore"
									? `终态后忽略迟到工具调用：${toolName}`
									: `终态后收到迟到工具调用，触发恢复重试：${toolName}`,
							content: message || "",
							agentName,
							agentRawName: agentRawName || undefined,
							detail: baseDetail,
						},
					});
					if (latePolicy === "recovery") {
						runTerminalRecoveryRef.current?.("late_tool_call", metadata);
					}
					return;
				}
				const inputText = sanitizeAuditText(eventToString(event.tool_input));
				const runningContent = inputText
					? `${routePrefix ? `${routePrefix}\n\n` : ""}输入：\n${inputText}`
					: routePrefix;
				const toolCallId = extractToolCallId(metadata, event);
				const bucketKey = buildToolBucketKey(agentRawName, agentName, toolName);
				const existingLogId = toolCallId
					? toolLogIdByCallIdRef.current.get(toolCallId) ||
						logsRef.current.find((item) => item.id === `tool-${toolCallId}`)
							?.id ||
						logsRef.current.find((item) => {
							if (item.type !== "tool") return false;
							const metadataCallId = toNonEmptyId(
								(item.detail?.metadata as Record<string, unknown> | undefined)
									?.tool_call_id,
							);
							return metadataCallId === toolCallId;
						})?.id ||
						null
					: null;
				if (existingLogId) {
					const existing = logsRef.current.find(
						(item) => item.id === existingLogId,
					);
					if (
						shouldIgnoreStaleToolEvent({
							existingLog: existing,
							incomingEventType: eventType,
							incomingSequence: event.sequence ?? null,
							incomingToolCallId: toolCallId,
						})
					) {
						return;
					}
					updateLog(existingLogId, {
						time: displayTime,
						eventTimestamp,
						type: "tool",
						phaseLabel: eventPhaseLabel ?? existing?.phaseLabel ?? null,
						title: runningTitle,
						content: runningContent,
						tool: {
							name: toolName,
							status: "running",
							callId: toolCallId || undefined,
						},
						agentName,
						toolEvidence: existing?.toolEvidence ?? null,
						toolEvidenceMissingState: null,
						detail: baseDetail,
					});
					return;
				}

				const logId = toolCallId
					? `tool-${toolCallId}`
					: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

				if (toolCallId) {
					toolLogIdByCallIdRef.current.set(toolCallId, logId);
				} else {
					const queue = pendingToolBucketsRef.current.get(bucketKey) ?? [];
					queue.push(logId);
					pendingToolBucketsRef.current.set(bucketKey, queue);
				}

				dispatch({
					type: "ADD_LOG",
					payload: {
						id: logId,
						time: displayTime,
						eventTimestamp,
						type: "tool",
						phaseLabel: eventPhaseLabel,
						title: runningTitle,
						content: runningContent,
						tool: {
							name: toolName,
							status: "running",
							callId: toolCallId || undefined,
						},
						agentName,
						agentRawName: agentRawName || undefined,
						toolEvidence: null,
						toolEvidenceMissingState: null,
						detail: baseDetail,
					},
				});
				return;
			}

			if (
				eventType === "tool_result" ||
				eventType === "tool_call_end" ||
				eventType === "tool_call_error"
			) {
				const toolName = sanitizeAuditText(event.tool_name || "未知") || "未知";
				const toolStatus = normalizeToolStatus(
					metadata?.tool_status,
					eventType,
				);
				const statusSnapshot = String(
					taskStatusRef.current || "",
				).toLowerCase();
				const boundarySequence = terminalBoundarySequenceRef.current;
				const isLateAfterTerminal =
					typeof boundarySequence === "number" &&
					(typeof event.sequence !== "number" ||
						event.sequence > boundarySequence);
				if (
					isLateAfterTerminal &&
					TERMINAL_STATUSES.has(statusSnapshot) &&
					statusSnapshot !== "completed" &&
					toolStatus === "completed"
				) {
					dispatch({
						type: "ADD_LOG",
						payload: {
							time: displayTime,
							eventTimestamp,
							type: "info",
							phaseLabel: eventPhaseLabel,
							title: `终态后收到迟到工具结果，触发恢复重试：${toolName}`,
							content: message || "",
							agentName,
							agentRawName: agentRawName || undefined,
							detail: baseDetail,
						},
					});
					runTerminalRecoveryRef.current?.("late_tool_result", metadata);
				}
				const statusLabel =
					toolStatus === "completed"
						? "已完成"
						: toolStatus === "failed"
							? "失败"
							: "已取消";
				const resolvedToolTitle = buildToolTitle(
					statusLabel,
					toolName,
					metadata,
				);
				const routePrefix = buildToolRouteContentPrefix(metadata);
				const outputText = sanitizeAuditText(
					extractToolOutputText(event.tool_output),
				);
				const expectsStructuredEvidence = isToolEvidenceCapableTool(toolName);
				const expectsNativeEvidence = expectsNativeToolEvidence(toolName);
				const toolCallId = extractToolCallId(metadata, event);
				const writeScopeAllowed =
					typeof metadata?.write_scope_allowed === "boolean"
						? (metadata.write_scope_allowed as boolean)
						: null;
				const writeScopeReason = toSafeTrimmedString(
					metadata?.write_scope_reason,
				);
				const writeScopeFile = toSafeTrimmedString(metadata?.write_scope_file);
				const writeScopeTotal = toSafeNumber(metadata?.write_scope_total_files);
				const writeScopeHint =
					writeScopeAllowed === false
						? `写入已拒绝（${writeScopeReason || "write_scope_not_allowed"}）` +
							(writeScopeFile ? ` 文件: ${writeScopeFile}` : "") +
							(writeScopeTotal !== null
								? `，当前可写文件数: ${writeScopeTotal}`
								: "")
						: "";

				const bucketKey = buildToolBucketKey(agentRawName, agentName, toolName);
				let targetLogId: string | null = null;
				if (toolCallId) {
					targetLogId =
						toolLogIdByCallIdRef.current.get(toolCallId) ||
						logsRef.current.find((item) => item.id === `tool-${toolCallId}`)
							?.id ||
						logsRef.current.find((item) => {
							if (item.type !== "tool") return false;
							const metadataCallId = toNonEmptyId(
								(item.detail?.metadata as Record<string, unknown> | undefined)
									?.tool_call_id,
							);
							return metadataCallId === toolCallId;
						})?.id ||
						null;
				}
				if (!targetLogId && !toolCallId) {
					const queue = pendingToolBucketsRef.current.get(bucketKey) ?? [];
					while (queue.length > 0 && !targetLogId) {
						const candidate = queue.shift() ?? null;
						if (
							candidate &&
							logsRef.current.some((item) => item.id === candidate)
						) {
							targetLogId = candidate;
						}
					}
					if (queue.length > 0) {
						pendingToolBucketsRef.current.set(bucketKey, queue);
					} else {
						pendingToolBucketsRef.current.delete(bucketKey);
					}
				}
				if (!targetLogId) {
					const fallbackLog = [...logsRef.current].reverse().find((item) => {
						if (item.type !== "tool" || item.tool?.status !== "running")
							return false;
						if (item.tool?.name !== toolName) return false;
						if (agentName && item.agentName && item.agentName !== agentName)
							return false;
						return true;
					});
					targetLogId = fallbackLog?.id || null;
				}
				if (
					targetLogId &&
					!logsRef.current.some((item) => item.id === targetLogId)
				) {
					targetLogId = null;
				}

				if (targetLogId) {
					const existing = logsRef.current.find(
						(item) => item.id === targetLogId,
					);
					if (
						shouldIgnoreStaleToolEvent({
							existingLog: existing,
							incomingEventType: eventType,
							incomingSequence: event.sequence ?? null,
							incomingToolCallId: toolCallId,
						})
					) {
						return;
					}
					if (existing && existing.tool?.status === toolStatus && toolCallId) {
						return;
					}
					const priorDetail = (existing?.detail ?? null) as Record<
						string,
						unknown
					> | null;
					const effectiveToolInput =
						baseDetail.tool_input ?? priorDetail?.tool_input ?? null;
					const effectiveMetadata = {
						...((priorDetail?.metadata as
							| Record<string, unknown>
							| undefined) ?? {}),
						...sanitizedMetadata,
					};
					const parsedToolEvidence = parseToolEvidenceFromLog({
						toolName,
						toolOutput: baseDetail.tool_output,
						toolMetadata: effectiveMetadata,
						toolInput: effectiveToolInput,
						logContent: existing?.content,
					});
					const toolEvidenceMissingState = resolveToolEvidenceMissingState({
						expectsNativeEvidence,
						taskProtocol: resolveTaskToolEvidenceProtocol(task),
						toolStatus,
						hasNativePayload: Boolean(parsedToolEvidence?.payload),
					});

					const previousContent = existing?.content
						? `${existing.content}\n\n`
						: "";
					const outputBlock = outputText
						? `${routePrefix ? `${routePrefix}\n\n` : ""}输出：\n${outputText}${writeScopeHint ? `\n\n${writeScopeHint}` : ""}`
						: `${routePrefix}${writeScopeHint ? `${routePrefix ? "\n\n" : ""}${writeScopeHint}` : ""}`.trim();
					updateLog(targetLogId, {
						time: displayTime,
						eventTimestamp,
						type: "tool",
						phaseLabel: eventPhaseLabel ?? existing?.phaseLabel ?? null,
						title: resolvedToolTitle,
						content: outputBlock
							? `${previousContent}${outputBlock}`.trim()
							: previousContent.trim(),
						tool: {
							name: toolName,
							duration: event.tool_duration_ms ?? existing?.tool?.duration ?? 0,
							status: toolStatus,
							callId: toolCallId ?? existing?.tool?.callId,
						},
						agentName: agentName || existing?.agentName,
						toolEvidence:
							parsedToolEvidence ??
							(expectsStructuredEvidence
								? null
								: (existing?.toolEvidence ?? null)),
						toolEvidenceMissingState:
							toolEvidenceMissingState ??
							(expectsStructuredEvidence
								? null
								: (existing?.toolEvidenceMissingState ?? null)),
						detail: {
							...(priorDetail ?? {}),
							...baseDetail,
							metadata: effectiveMetadata,
							tool_input: effectiveToolInput,
						},
					});
					if (toolCallId) {
						toolLogIdByCallIdRef.current.set(toolCallId, targetLogId);
					}
					return;
				}

				const logId = toolCallId
					? `tool-${toolCallId}`
					: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
				if (toolCallId) {
					toolLogIdByCallIdRef.current.set(toolCallId, logId);
				}
				dispatch({
					type: "ADD_LOG",
					payload: {
						id: logId,
						time: displayTime,
						eventTimestamp,
						type: "tool",
						phaseLabel: eventPhaseLabel,
						title: resolvedToolTitle,
						content: outputText
							? `${routePrefix ? `${routePrefix}\n\n` : ""}输出：\n${outputText}${writeScopeHint ? `\n\n${writeScopeHint}` : ""}`
							: `${routePrefix}${writeScopeHint ? `${routePrefix ? "\n\n" : ""}${writeScopeHint}` : ""}`.trim(),
						tool: {
							name: toolName,
							duration: event.tool_duration_ms ?? 0,
							status: toolStatus,
							callId: toolCallId || undefined,
						},
						agentName,
						agentRawName: agentRawName || undefined,
						toolEvidence: (() => {
							const parsedToolEvidence = parseToolEvidenceFromLog({
								toolName,
								toolOutput: baseDetail.tool_output,
								toolMetadata: sanitizedMetadata,
								toolInput: baseDetail.tool_input,
								logContent: outputText,
							});
							return (
								parsedToolEvidence ??
								(expectsStructuredEvidence ? null : undefined)
							);
						})(),
						toolEvidenceMissingState: (() => {
							const parsedToolEvidence = parseToolEvidenceFromLog({
								toolName,
								toolOutput: baseDetail.tool_output,
								toolMetadata: sanitizedMetadata,
								toolInput: baseDetail.tool_input,
								logContent: outputText,
							});
							return resolveToolEvidenceMissingState({
								expectsNativeEvidence,
								taskProtocol: resolveTaskToolEvidenceProtocol(task),
								toolStatus,
								hasNativePayload: Boolean(parsedToolEvidence?.payload),
							});
						})(),
						detail: {
							...baseDetail,
							metadata: sanitizedMetadata,
						},
					},
				});
				return;
			}

			if (
				eventType === "finding" ||
				eventType === "finding_new" ||
				eventType === "finding_verified" ||
				eventType === "finding_update"
			) {
				// NOTE: 暂停事件态漏洞的前端解析与合并展示（仅保留事件日志）。
				// const normalizedEvent: AgentEvent = { ... };
				// const mergedFindingItem = agentEventToRealtimeItem(normalizedEvent);
				// if (mergedFindingItem) {
				// 	setRealtimeFindings((prev) =>
				// 		limitRealtimeFindings(
				// 			mergeRealtimeFindingsBatch(prev, [mergedFindingItem], {
				// 				source: "event",
				// 			}),
				// 		),
				// 	);
				// }

				const findingTitle =
					sanitizeAuditText(
						localizeAuditText(
							eventToString(metadata?.display_title) ||
								eventToString(metadata?.title) ||
								message ||
								"发现漏洞",
						),
					) || "发现漏洞";
				const falsePositiveSignal = [
					metadata?.status,
					metadata?.authenticity,
					metadata?.verdict,
				].some(
					(value) =>
						String(value || "")
							.trim()
							.toLowerCase() === "false_positive",
				);
				const findingSeverity = falsePositiveSignal
					? "invalid"
					: normalizeSeverityKey(metadata?.severity);

				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "finding",
						phaseLabel: eventPhaseLabel,
						title: findingTitle,
						severity: findingSeverity,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}

			if (eventType === "todo_update") {
				const todoScope = String(metadata?.todo_scope || "")
					.trim()
					.toLowerCase();
				const todoList = Array.isArray(metadata?.todo_list)
					? (metadata?.todo_list as Array<Record<string, unknown>>)
					: [];

				if (todoScope === "verification") {
					const verifiedCount = todoList.filter(
						(item) => item?.status === "verified",
					).length;
					const pendingCount = todoList.filter(
						(item) => item?.status === "pending" || item?.status === "running",
					).length;
					const falsePositiveCount = todoList.filter(
						(item) => item?.status === "false_positive",
					).length;
					const statusPreview = todoList
						.slice(0, 3)
						.map((item) => toCnVerificationStatus(item?.status))
						.join(" / ");
					const compactProgress = `逐漏洞验证进度：确报 ${verifiedCount}，待确认 ${pendingCount}，误报 ${falsePositiveCount}`;
					dispatch({
						type: "ADD_LOG",
						payload: {
							time: displayTime,
							eventTimestamp,
							type: "progress",
							phaseLabel: eventPhaseLabel,
							title: compactProgress,
							content: `${message || ""}${statusPreview ? `\n状态样例：${statusPreview}` : ""}`,
							agentName,
							agentRawName: agentRawName || undefined,
							detail: baseDetail,
						},
					});
					return;
				}

				if (todoScope === "finding_table") {
					const contextPending = toSafeNumber(metadata?.context_pending) ?? 0;
					const contextReady = toSafeNumber(metadata?.context_ready) ?? 0;
					const contextFailed = toSafeNumber(metadata?.context_failed) ?? 0;
					const verifyUnverified =
						toSafeNumber(metadata?.verify_unverified) ?? 0;
					const verified = toSafeNumber(metadata?.verified) ?? 0;
					const falsePositive = toSafeNumber(metadata?.false_positive) ?? 0;
					const round = toSafeNumber(metadata?.round) ?? 0;
					const compactProgress =
						`漏洞表收敛进度（第 ${round} 轮）：` +
						`上下文待收集 ${contextPending}，已就绪 ${contextReady}，失败 ${contextFailed}；` +
						`待确认 ${verifyUnverified}，确报 ${verified}，误报 ${falsePositive}`;
					dispatch({
						type: "ADD_LOG",
						payload: {
							time: displayTime,
							eventTimestamp,
							type: "progress",
							phaseLabel: eventPhaseLabel,
							title: compactProgress,
							content: message || "",
							agentName,
							agentRawName: agentRawName || undefined,
							detail: baseDetail,
						},
					});
					return;
				}
			}

			if (
				eventType === "dispatch" ||
				eventType === "dispatch_complete" ||
				eventType === "node_start" ||
				eventType === "node_complete" ||
				eventType === "node_end" ||
				eventType === "phase_start" ||
				eventType === "phase_complete" ||
				eventType === "phase_end"
			) {
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "dispatch",
						phaseLabel: eventPhaseLabel,
						title: message || `事件：${eventType}`,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				debouncedLoadAgentTree();
				return;
			}

			if (eventType === "task_complete" || eventType === "complete") {
				markTerminalBoundary("completed", event.sequence);
				reconcileTerminalLogs("completed", event.sequence);
				compactToolLogsAfterReplay();
				const completedPhaseLabel = resolveLogPhaseLabel({
					rawPhase,
					eventType,
					taskStatus: "completed",
					message,
					useCurrentSnapshot: false,
				});
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "info",
						phaseLabel: completedPhaseLabel,
						title: message || "任务已完成",
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}
			if (eventType === "task_error") {
				const taskErrorMessage =
					message ||
					sanitizeAuditText(eventToString(metadata?.error)) ||
					"任务执行出错";
				const cancelOrigin = String(metadata?.cancel_origin || "")
					.trim()
					.toLowerCase();
				if (cancelOrigin === "user") {
					userCancelSeenRef.current = true;
				}
				if (taskErrorMessage) {
					setTerminalFailureReason(taskErrorMessage);
				}
				const taskErrorPhaseLabel = resolveLogPhaseLabel({
					rawPhase,
					eventType,
					taskStatus: event.status ?? taskStatusRef.current,
					message: taskErrorMessage,
					useCurrentSnapshot: false,
				});
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "error",
						phaseLabel: taskErrorPhaseLabel,
						title: taskErrorMessage,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}
			if (eventType === "task_cancel") {
				userCancelSeenRef.current = true;
				const cancelledPhaseLabel = resolveLogPhaseLabel({
					rawPhase,
					eventType,
					taskStatus: "cancelled",
					message,
					useCurrentSnapshot: false,
				});
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "info",
						phaseLabel: cancelledPhaseLabel,
						title: message || "任务已取消",
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}
			if (eventType === "task_end") {
				const terminalStatus = String(event.status || "").toLowerCase();
				if (TERMINAL_STATUSES.has(terminalStatus)) {
					markTerminalBoundary(terminalStatus, event.sequence);
					reconcileTerminalLogs(terminalStatus, event.sequence);
					compactToolLogsAfterReplay();
				}
				const status = event.status ? `（${event.status}）` : "";
				const taskEndPhaseLabel = resolveLogPhaseLabel({
					rawPhase,
					eventType,
					taskStatus: terminalStatus || taskStatusRef.current,
					message,
					useCurrentSnapshot: false,
				});
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "info",
						phaseLabel: taskEndPhaseLabel,
						title: message || `任务流已结束${status}`,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				return;
			}

			if (
				eventType === "progress" ||
				eventType === "info" ||
				eventType === "warning" ||
				eventType === "error"
			) {
				const fallback = isRetryingTimeoutWarning(eventType, metadata)
					? "LLM 请求超时，重试中"
					: message || eventType;
				const progressKey = matchProgressKey(fallback);
				if (progressKey) {
					dispatch({
						type: "UPDATE_OR_ADD_PROGRESS_LOG",
						payload: {
							progressKey,
							title: fallback,
							agentName,
							phaseLabel: eventPhaseLabel,
							time: displayTime,
							eventTimestamp,
						},
					});
					return;
				}

				if (
					/索引.*完成/.test(fallback) ||
					/index(?:ing)?\s+(?:complete|completed)/i.test(fallback)
				) {
					dispatch({
						type: "UPDATE_OR_ADD_PROGRESS_LOG",
						payload: {
							progressKey: "index_progress",
							title: fallback,
							agentName,
							phaseLabel: eventPhaseLabel,
							progressStatus: "completed",
							time: displayTime,
							eventTimestamp,
						},
					});
					return;
				}

				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: eventType === "error" ? "error" : "info",
						phaseLabel: eventPhaseLabel,
						title: fallback,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
				if (
					eventType === "error" &&
					Boolean(metadata?.is_terminal) &&
					fallback
				) {
					setTerminalFailureReason(fallback);
				}
				return;
			}

			if (message) {
				dispatch({
					type: "ADD_LOG",
					payload: {
						time: displayTime,
						eventTimestamp,
						type: "info",
						phaseLabel: eventPhaseLabel,
						title: message,
						agentName,
						agentRawName: agentRawName || undefined,
						detail: baseDetail,
					},
				});
			}
		},
		[
			compactToolLogsAfterReplay,
			debouncedLoadAgentTree,
			dispatch,
			markTerminalBoundary,
			reconcileTerminalLogs,
			resolveLogPhaseLabel,
			task,
			updateLog,
		],
	);

	const buildNowRelativeLogTime = useCallback(() => {
		const nowIso = new Date().toISOString();
		return {
			time: resolveLogDisplayTime(
				taskStartedAtRef.current,
				nowIso,
				getTimeString(),
			),
			eventTimestamp: nowIso,
		};
	}, []);

	const ingestTokenEvents = useCallback((events: UnifiedAgentEvent[]) => {
		setTokenUsage((previous) => {
			let next = previous;
			for (const event of events) {
				next = accumulateTokenUsage(next, event);
			}
			return next;
		});
	}, []);

	const backfillEventsSince = useCallback(
		async (startAfter: number, reason: string) => {
			if (!taskId || isBackfillingRef.current) return;
			isBackfillingRef.current = true;
			try {
				const events = await fetchAllHistoricalEvents(taskId, startAfter);
				if (events.length === 0) {
					return;
				}

				ingestTokenEvents(events as UnifiedAgentEvent[]);
				// NOTE: 暂停历史事件中的漏洞条目解析，仅回放日志。
				// if (!verifiedFindingsManuallyClearedRef.current) {
				// 	const findingItems = events
				// 		.map(agentEventToRealtimeItem)
				// 		.filter((item): item is RealtimeMergedFindingItem => Boolean(item));
				// 	if (findingItems.length) {
				// 		setRealtimeFindings((prev) =>
				// 			limitRealtimeFindings(
				// 				mergeRealtimeFindingsBatch(prev, findingItems, {
				// 					source: "event",
				// 				}),
				// 			),
				// 		);
				// 	}
				// }
				events.forEach((event) => {
					appendLogFromEvent(event);
				});
				compactToolLogsAfterReplay();
				const lastSequence = events[events.length - 1]?.sequence ?? startAfter;
				lastEventSequenceRef.current = Math.max(
					lastEventSequenceRef.current,
					lastSequence,
				);
				setAfterSequence(lastEventSequenceRef.current);
				console.log(
					`[AgentAudit] Backfilled ${events.length} events (${reason}), last sequence=${lastEventSequenceRef.current}`,
				);
			} catch (error) {
				console.error("[AgentAudit] Backfill events failed:", error);
			} finally {
				isBackfillingRef.current = false;
			}
		},
		[
			appendLogFromEvent,
			compactToolLogsAfterReplay,
			fetchAllHistoricalEvents,
			ingestTokenEvents,
			taskId,
		],
	);

	const runTerminalRecovery = useCallback(
		async (triggerReason: string, metadata?: Record<string, unknown>) => {
			if (!taskId) return;
			const terminalStatus = String(taskStatusRef.current || "").toLowerCase();
			if (terminalStatus !== "failed" && terminalStatus !== "cancelled") return;

			const recentTaskErrorLog = [...logsRef.current]
				.reverse()
				.find(
					(item) =>
						item.type === "error" || item.detail?.event_type === "task_error",
				);
			const reasonText =
				terminalFailureReason ||
				String(recentTaskErrorLog?.title || "").trim() ||
				String(task?.error_message || "").trim();
			const classification = classifyTerminalFailure(
				reasonText,
				metadata,
				userCancelSeenRef.current,
			);
			if (classification.cancelOrigin === "user") {
				return;
			}
			if (!classification.retryable) {
				const nowTime = buildNowRelativeLogTime();
				dispatch({
					type: "ADD_LOG",
					payload: {
						...nowTime,
						type: "info",
						title: `终态恢复跳过：失败分类=${classification.failureClass}，不满足自动重试条件`,
					},
				});
				return;
			}

			const now = Date.now();
			const reasonKey = `${taskId}:${classification.failureClass}:${classification.cancelOrigin}:${triggerReason}`;
			const currentState = terminalRecoveryStateRef.current;
			if (currentState.active) {
				return;
			}
			if (
				currentState.reasonKey === reasonKey &&
				now - currentState.triggeredAt < TERMINAL_RECOVERY_DEBOUNCE_MS
			) {
				return;
			}

			terminalRecoveryStateRef.current = {
				active: true,
				attempts: 0,
				reasonKey,
				triggeredAt: now,
			};

			let recovered = false;
			let finalStatus = terminalStatus;
			try {
				for (
					let attempt = 1;
					attempt <= TERMINAL_RECOVERY_MAX_ATTEMPTS;
					attempt += 1
				) {
					terminalRecoveryStateRef.current = {
						...terminalRecoveryStateRef.current,
						attempts: attempt,
					};
					const nowTime = buildNowRelativeLogTime();
					dispatch({
						type: "ADD_LOG",
						payload: {
							...nowTime,
							type: "info",
							title: `终态恢复重试 ${attempt}/${TERMINAL_RECOVERY_MAX_ATTEMPTS}：原因=${reasonText || triggerReason}，分类=${classification.failureClass}`,
						},
					});

					await backfillEventsSince(
						lastEventSequenceRef.current,
						`terminal_recovery_retry_${attempt}`,
					);
					await loadTask();
					await loadFindings({ silent: true });

					try {
						const snapshot = await getAgentTask(taskId);
						setTask(snapshot);
						finalStatus = String(snapshot?.status || finalStatus).toLowerCase();
						if (finalStatus !== "failed" && finalStatus !== "cancelled") {
							recovered = true;
							break;
						}
					} catch {
						// keep retrying on snapshot fetch errors within budget
					}
					if (attempt < TERMINAL_RECOVERY_MAX_ATTEMPTS) {
						await new Promise((resolve) =>
							setTimeout(resolve, TERMINAL_RECOVERY_RETRY_INTERVAL_MS),
						);
					}
				}
			} finally {
				const nowTime = buildNowRelativeLogTime();
				dispatch({
					type: "ADD_LOG",
					payload: {
						...nowTime,
						type: "info",
						title: `终态恢复结束：状态=${finalStatus}，是否恢复=${recovered ? "是" : "否"}`,
					},
				});
				terminalRecoveryStateRef.current = {
					...terminalRecoveryStateRef.current,
					active: false,
					triggeredAt: Date.now(),
				};
			}
		},
		[
			backfillEventsSince,
			buildNowRelativeLogTime,
			dispatch,
			loadFindings,
			loadTask,
			setTask,
			task?.error_message,
			taskId,
			terminalFailureReason,
		],
	);

	useEffect(() => {
		runTerminalRecoveryRef.current = (
			triggerReason: string,
			metadata?: Record<string, unknown>,
		) => {
			void runTerminalRecovery(triggerReason, metadata);
		};
		return () => {
			runTerminalRecoveryRef.current = null;
		};
	}, [runTerminalRecovery]);

	//  NEW: 加载历史事件并转换为日志项
	const loadHistoricalEvents = useCallback(async () => {
		if (!taskId) return 0;

		if (hasLoadedHistoricalEventsRef.current) {
			return 0;
		}
		hasLoadedHistoricalEventsRef.current = true;

		try {
			const events = await fetchAllHistoricalEvents(taskId, 0);
			if (!events.length) {
				return 0;
			}

			ingestTokenEvents(events as UnifiedAgentEvent[]);
			// NOTE: 暂停历史事件中的漏洞条目解析，仅回放日志。
			// if (!verifiedFindingsManuallyClearedRef.current) {
			// 	const findingItems = events
			// 		.map(agentEventToRealtimeItem)
			// 		.filter((item): item is RealtimeMergedFindingItem => Boolean(item));
			// 	if (findingItems.length) {
			// 		setRealtimeFindings((prev) =>
			// 			mergeRealtimeFindingsBatch(prev, findingItems, { source: "event" }),
			// 		);
			// 	}
			// }
			events.forEach((event) => {
				appendLogFromEvent(event);
			});
			compactToolLogsAfterReplay();
			lastEventSequenceRef.current = Math.max(
				lastEventSequenceRef.current,
				events[events.length - 1].sequence,
			);
			setAfterSequence(lastEventSequenceRef.current);
			return events.length;
		} catch (err) {
			console.error("[AgentAudit] Failed to load historical events:", err);
			return 0;
		}
	}, [
		appendLogFromEvent,
		compactToolLogsAfterReplay,
		fetchAllHistoricalEvents,
		ingestTokenEvents,
		taskId,
	]);

	useEffect(() => {
		const bootstrapTaskId = bootstrapInputsSummary?.taskId;
		if (!bootstrapTaskId) return;
		void loadBootstrapInputFindings(bootstrapTaskId);
	}, [bootstrapInputsSummary?.taskId, loadBootstrapInputFindings]);

	// NOTE: 暂停 DB->realtime 的漏洞镜像合并，漏洞列表直接使用持久化 findings。
	useEffect(() => {
		if (!findings.length) return;
		// if (!verifiedFindingsManuallyClearedRef.current) {
		// 	const items = findings
		// 		.map(agentFindingToRealtimeItem)
		// 		.filter((item): item is RealtimeMergedFindingItem => Boolean(item));
		// 	if (items.length) {
		// 		setRealtimeFindings((prev) =>
		// 			limitRealtimeFindings(
		// 				mergeRealtimeFindingsBatch(prev, items, { source: "db" }),
		// 			),
		// 		);
		// 	}
		// }
	}, [findings]);

	// ============ Stream Event Handling ============

	const streamOptions = useMemo(
		() => ({
			includeThinking: true,
			includeToolCalls: true,
			afterSequence,
			onEvent: (event: UnifiedAgentEvent) => {
				if (event.metadata?.agent_name) {
					setCurrentAgentName(String(event.metadata.agent_name));
				}
				ingestTokenEvents([event]);
				appendLogFromEvent(event);
				if (String(event.type ?? "").toLowerCase() === "task_end") {
					void backfillEventsSince(
						lastEventSequenceRef.current,
						"task_end_event",
					);
				}
			},
			onThinkingStart: () => {
				const currentId = getCurrentThinkingId();
				if (currentId) {
					updateLog(currentId, { isStreaming: false });
				}
				setCurrentThinkingId(null);
			},
			onThinkingToken: (_token: string, accumulated: string) => {
				if (!accumulated?.trim()) return;
				const cleanContent = sanitizeAuditText(
					cleanThinkingContent(accumulated),
				);
				if (!cleanContent) return;

				const currentId = getCurrentThinkingId();
				const rawAgent = getCurrentAgentName();
				const displayAgent = rawAgent ? toZhAgentName(rawAgent) : undefined;
				if (!currentId) {
					// 预生成 ID，这样我们可以跟踪这个日志
					const newLogId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
					const nowTime = buildNowRelativeLogTime();
					const thinkingPhaseLabel = resolveLogPhaseLabel({});
					dispatch({
						type: "ADD_LOG",
						payload: {
							id: newLogId,
							...nowTime,
							type: "thinking",
							phaseLabel: thinkingPhaseLabel,
							title: "思考中...",
							content: cleanContent,
							isStreaming: true,
							agentName: displayAgent,
							agentRawName: rawAgent || undefined,
						},
					});
					setCurrentThinkingId(newLogId);
				} else {
					updateLog(currentId, { content: cleanContent });
				}
			},
			onThinkingEnd: (response: string) => {
				const cleanResponse = sanitizeAuditText(
					cleanThinkingContent(response || ""),
				);
				const currentId = getCurrentThinkingId();

				if (!cleanResponse) {
					if (currentId) {
						removeLog(currentId);
					}
					setCurrentThinkingId(null);
					return;
				}

				if (currentId) {
					updateLog(currentId, {
						title:
							cleanResponse.slice(0, 100) +
							(cleanResponse.length > 100 ? "..." : ""),
						content: cleanResponse,
						isStreaming: false,
					});
					setCurrentThinkingId(null);
				}
			},
			onFinding: () => {
				// Realtime findings are synchronized from onEvent to avoid duplicate merges.
			},
			onComplete: () => {
				void backfillEventsSince(lastEventSequenceRef.current, "on_complete");
				void loadTask();
				void loadFindings({ silent: true });
				void loadAgentTree();
			},
			onError: (err: string, context: StreamErrorContext) => {
				const source = context?.source ?? "event";
				const isTerminal = Boolean(context?.terminal);
				if (source === "event" && !isTerminal) {
					console.warn("[AgentAudit] non_terminal_error", {
						message: err,
						context,
					});
					return;
				}

				if (source === "event" && isTerminal) {
					console.error("[AgentAudit] terminal_error", {
						message: err,
						context,
					});
					if (err) {
						setTerminalFailureReason(err);
					}
				} else if (source === "transport" || source === "stream_end") {
					const nowTime = buildNowRelativeLogTime();
					dispatch({
						type: "ADD_LOG",
						payload: {
							...nowTime,
							type: "error",
							phaseLabel: resolveLogPhaseLabel({ useCurrentSnapshot: false }),
							title: buildAgentAuditStreamDisconnectTitle(source, err),
						},
					});
				}

				if (isTerminal || source === "transport" || source === "stream_end") {
					void backfillEventsSince(lastEventSequenceRef.current, "on_error");
					void loadTask();
					void loadFindings({ silent: true });
				}
			},
		}),
		[
			afterSequence,
			appendLogFromEvent,
			backfillEventsSince,
			buildNowRelativeLogTime,
			dispatch,
			getCurrentAgentName,
			getCurrentThinkingId,
			ingestTokenEvents,
			loadTask,
			loadFindings,
			loadAgentTree,
			removeLog,
			resolveLogPhaseLabel,
			setCurrentAgentName,
			setCurrentThinkingId,
			updateLog,
		],
	);

	const {
		connect: connectStream,
		disconnect: disconnectStream,
		isConnected,
	} = useAgentStream(taskId || null, streamOptions);

	// 保存 disconnect 函数到 ref，以便在 taskId 变化时使用
	useEffect(() => {
		disconnectStreamRef.current = disconnectStream;
	}, [disconnectStream]);

	// ============ Effects ============

	// Initial load -  加载任务数据和历史事件
	useEffect(() => {
		if (!taskId) {
			setShowSplash(true);
			initialBootstrapTaskIdRef.current = null;
			return;
		}
		if (initialBootstrapTaskIdRef.current === taskId) {
			return;
		}
		initialBootstrapTaskIdRef.current = taskId;
		setShowSplash(false);
		const cachedSnapshot = cachedTaskDetailSnapshot;
		const cachedTaskStatus = String(cachedSnapshot?.data.task?.status || "")
			.trim()
			.toLowerCase();
		const shouldSkipInitialReload = false;
		const shouldReuseSnapshot = Boolean(
			cachedSnapshot &&
				(isAgentAuditTaskDetailSnapshotReusable(cachedSnapshot) ||
					isAgentAuditTaskDetailSnapshotFresh(cachedSnapshot)),
		);
		if (!shouldReuseSnapshot) {
			setLoading(true);
			setHistoricalEventsLoaded(false);
		}
		if (shouldSkipInitialReload) {
			setLoading(false);
			setHistoricalEventsLoaded(true);
			return;
		}

		const loadAllData = async () => {
			try {
				// 先拿到任务终态，再决定是否拉取持久化 findings，避免并发竞态导致误清空。
				const taskSnapshot = await loadTask();
				await Promise.all([
					loadFindings({
						silent: shouldReuseSnapshot,
						taskStatusOverride: taskSnapshot?.status ?? null,
					}),
					loadAgentTree(),
				]);

				//  优先回补 snapshot 之后的新事件，避免重进页面整页重拉。
				if (
					shouldReuseSnapshot &&
					cachedSnapshot?.data.historicalEventsLoaded &&
					cachedSnapshot.data.afterSequence > 0
				) {
					await backfillEventsSince(
						cachedSnapshot.data.afterSequence,
						"task_detail_snapshot_revalidate",
					);
				} else {
					//  加载历史事件 - 无论任务是否运行都需要加载
					hasLoadedHistoricalEventsRef.current = false;
					await loadHistoricalEvents();
				}

				// 标记历史事件已加载完成 (setAfterSequence 已在 loadHistoricalEvents 中调用)
				setHistoricalEventsLoaded(true);
			} catch (error) {
				console.error("[AgentAudit] Failed to load data:", error);
				setHistoricalEventsLoaded(true); // 即使出错也标记为完成，避免无限等待
			} finally {
				setLoading(false);
			}
		};

		loadAllData();
	}, [
		backfillEventsSince,
		cachedTaskDetailSnapshot,
		loadAgentTree,
		loadFindings,
		loadHistoricalEvents,
		loadTask,
		setLoading,
		taskId,
	]);

	// Stream connection -  任务运行后尽早连接，历史事件回放通过并行回补完成
	useEffect(() => {
		// 任务正在运行时尽早连接 SSE，避免预扫长阶段日志空窗
		if (!taskId || !isRunning) return;

		//  避免重复连接 - 只连接一次
		if (hasConnectedRef.current) return;

		hasConnectedRef.current = true;
		console.log(
			`[AgentAudit] Connecting to stream (afterSequence will be passed via streamOptions)`,
		);
		connectStream();

		return () => {
			console.log("[AgentAudit] Cleanup: disconnecting stream");
			disconnectStream();
		};
		//  CRITICAL FIX: 移除 afterSequence 依赖！
		// afterSequence 通过 streamOptions 传递，不需要在这里触发重连
		// 如果包含它，当 loadHistoricalEvents 更新 afterSequence 时会触发断开重连
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [taskId, isRunning, connectStream, disconnectStream]);

	useEffect(() => {
		if (!taskId || !isRunning) return;
		if (!hasConnectedRef.current) return;
		if (isConnected) return;

		const elapsed = Date.now() - lastStreamSelfHealAttemptRef.current;
		const delay =
			elapsed >= STREAM_SELF_HEAL_RETRY_MS
				? 0
				: STREAM_SELF_HEAL_RETRY_MS - elapsed;
		const timer = setTimeout(() => {
			if (!isAgentAuditActiveStatus(taskStatusRef.current)) return;
			lastStreamSelfHealAttemptRef.current = Date.now();
			console.warn("[AgentAudit] stream_self_heal_reconnect", {
				taskId,
				lastSequence: lastEventSequenceRef.current,
			});
			connectStream();
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [taskId, isRunning, isConnected, connectStream]);

	useEffect(() => {
		if (!taskId || !isRunning) return;
		const interval = setInterval(() => {
			void backfillEventsSince(
				lastEventSequenceRef.current,
				"running_periodic_backfill",
			);
		}, AGENT_LOG_BACKFILL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [backfillEventsSince, isRunning, taskId]);

	useEffect(() => {
		if (!taskId || !isRunning) {
			streamConnectedStateRef.current = false;
			return;
		}
		const wasConnected = streamConnectedStateRef.current;
		streamConnectedStateRef.current = isConnected;
		if (!wasConnected && isConnected) {
			const nowTime = buildNowRelativeLogTime();
			dispatch({
				type: "ADD_LOG",
				payload: { ...nowTime, type: "info", title: "已连接扫描事件流" },
			});
		}
	}, [taskId, isRunning, isConnected, dispatch, buildNowRelativeLogTime]);

	// Polling
	useEffect(() => {
		if (!taskId || !isRunning) return;
		const interval = setInterval(loadAgentTree, POLLING_INTERVALS.AGENT_TREE);
		return () => clearInterval(interval);
	}, [taskId, isRunning, loadAgentTree]);

	useEffect(() => {
		if (!taskId || !isRunning) return;
		const interval = setInterval(loadTask, POLLING_INTERVALS.TASK_STATS);
		return () => clearInterval(interval);
	}, [taskId, isRunning, loadTask]);

	useEffect(() => {
		if (!taskId) {
			setRealtimeQueueSnapshot(DEFAULT_REALTIME_QUEUE_SNAPSHOT);
			return;
		}
		if (!isRunning) {
			setRealtimeQueueSnapshot(DEFAULT_REALTIME_QUEUE_SNAPSHOT);
			return;
		}
		void loadTaskProgress();
		const interval = setInterval(() => {
			void loadTaskProgress();
		}, POLLING_INTERVALS.TASK_STATS);
		return () => clearInterval(interval);
	}, [taskId, isRunning, loadTaskProgress]);

	useEffect(() => {
		if (!taskId || !isRunning) return;
		const interval = setInterval(() => {
			void loadFindings({ silent: true });
		}, FINDINGS_REFRESH_INTERVAL);
		return () => clearInterval(interval);
	}, [taskId, isRunning, loadFindings]);

	useEffect(() => {
		const previousStatus = previousTaskStatusRef.current;
		const currentStatus = task?.status;
		const normalizedCurrentStatus = String(currentStatus || "")
			.trim()
			.toLowerCase();
		const terminalPolicy = getTerminalStatusTransitionPolicy({
			previousStatus,
			currentStatus,
		});
		if (terminalPolicy.didEnterTerminal) {
			if (terminalPolicy.shouldReconcileLogs) {
				reconcileTerminalLogs(
					normalizedCurrentStatus,
					lastEventSequenceRef.current,
				);
			}
			compactToolLogsAfterReplay();
			if (terminalPolicy.shouldBackfill) {
				void backfillEventsSince(
					lastEventSequenceRef.current,
					"status_transition_to_terminal",
				);
			}
			void loadFindings({ silent: true });
		}
		previousTaskStatusRef.current = currentStatus;
	}, [
		task?.status,
		backfillEventsSince,
		compactToolLogsAfterReplay,
		loadFindings,
		reconcileTerminalLogs,
	]);

	useEffect(() => {
		if (!historicalEventsLoaded) return;
		const currentStatus = String(task?.status || "").toLowerCase();
		if (!TERMINAL_STATUSES.has(currentStatus)) return;
		reconcileTerminalLogs(currentStatus, lastEventSequenceRef.current);
		compactToolLogsAfterReplay();
	}, [
		compactToolLogsAfterReplay,
		historicalEventsLoaded,
		reconcileTerminalLogs,
		task?.status,
	]);

	const markProgrammaticScroll = useCallback(() => {
		ignoreScrollUntilRef.current = Math.max(
			ignoreScrollUntilRef.current,
			Date.now() + PROGRAMMATIC_SCROLL_GUARD_MS,
		);
	}, []);

	const scrollLogsToBottom = useCallback(
		(behavior: ScrollBehavior = "auto") => {
			const container = logsContainerRef.current;
			if (!container) return;
			markProgrammaticScroll();
			container.scrollTo({ top: container.scrollHeight, behavior });
				if (typeof window !== "undefined") {
					window.requestAnimationFrame(() => {
						markProgrammaticScroll();
					});
					if (scrollGuardTimeoutRef.current) {
						clearTimeout(scrollGuardTimeoutRef.current);
					}
					scrollGuardTimeoutRef.current = setTimeout(() => {
						markProgrammaticScroll();
						scrollGuardTimeoutRef.current = null;
					}, 120);
				}
		},
		[markProgrammaticScroll],
	);

	const handleLogsScroll = useCallback(() => {
		const container = logsContainerRef.current;
		if (!container || !isAutoScroll) return;
		const distanceToBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight;
		const isProgrammaticScroll = Date.now() < ignoreScrollUntilRef.current;
		if (
			!shouldDisableAutoScrollOnScroll({
				isAutoScrollEnabled: isAutoScroll,
				isProgrammaticScroll,
				distanceToBottom,
				thresholdPx: LOG_AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX,
			})
		) {
			return;
		}
		setAutoScroll(false);
		if (taskId) {
			persistTaskAutoScroll(taskId, false);
		}
	}, [isAutoScroll, setAutoScroll, taskId]);

	// Default viewport: show latest logs (about 3 visible rows) when opening a task.
	useEffect(() => {
		if (!taskId || hasInitializedLogViewportRef.current) return;
		if (displayLogs.length === 0) return;
		requestAnimationFrame(() => {
			scrollLogsToBottom("auto");
			hasInitializedLogViewportRef.current = true;
		});
	}, [displayLogs.length, scrollLogsToBottom, taskId]);

	// Auto scroll while stream keeps appending logs.
	useEffect(() => {
		const logCount = displayLogs.length;
		if (!isAutoScroll) return;
		if (logCount === 0) return;
		scrollLogsToBottom("smooth");
	}, [displayLogs.length, isAutoScroll, scrollLogsToBottom]);

	// ============ Handlers ============

	const handleCancel = async () => {
		if (!taskId || isCancelling) return;
		userCancelSeenRef.current = true;
		setIsCancelling(true);
		const nowTime = buildNowRelativeLogTime();
		dispatch({
			type: "ADD_LOG",
			payload: { ...nowTime, type: "info", title: "正在请求中止任务..." },
		});

		try {
			await cancelAgentTask(taskId);
			toast.success("已提交中止请求");
			const confirmedNow = buildNowRelativeLogTime();
			dispatch({
				type: "ADD_LOG",
				payload: { ...confirmedNow, type: "info", title: "任务中止请求已确认" },
			});
			await loadTask();
			disconnectStream();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "未知错误";
			toast.error(`中止任务失败：${errorMessage}`);
			const failedNow = buildNowRelativeLogTime();
			dispatch({
				type: "ADD_LOG",
				payload: {
					...failedNow,
					type: "error",
					title: `中止失败：${errorMessage}`,
				},
			});
		} finally {
			setIsCancelling(false);
		}
	};

	const handleExportReport = () => {
		if (!task) return;
		setShowExportDialog(true);
	};

	const handleExportLogs = useCallback(
		async (format: "json" | "markdown") => {
			if (!task) {
				toast.error("任务信息未加载，无法导出");
				return;
			}
			try {
				await downloadAgentLogs(task.id, format, {
					taskName: task.name,
				});
				toast.success(
					format === "json"
						? "活动日志已导出为 JSON"
						: "活动日志已导出为 Markdown",
				);
			} catch (error) {
				console.error("Failed to export agent logs:", error);
				toast.error("导出活动日志失败，请重试");
			}
		},
		[task],
	);

	const handleToggleAutoScroll = useCallback(() => {
		const nextEnabled = !isAutoScroll;
		setAutoScroll(nextEnabled);
		if (taskId) {
			persistTaskAutoScroll(taskId, nextEnabled);
		}
		if (nextEnabled) {
			requestAnimationFrame(() => {
				scrollLogsToBottom("smooth");
			});
		}
	}, [isAutoScroll, scrollLogsToBottom, setAutoScroll, taskId]);

	const handleDetailSplitLayout = useCallback(
		(layout: number[]) => {
			if (layout.length < 2) {
				return;
			}

			const nextRatio = clampLogsPanelRatio(
				layout[1] / 100,
				detailSplitConstraints.minLogsPanelRatio,
				detailSplitConstraints.maxLogsPanelRatio,
			);
			setDesktopLogsPanelRatio((current) =>
				current !== null && Math.abs(current - nextRatio) < 0.001
					? current
					: nextRatio,
			);
			writeAgentAuditSplitLayout({ logsPanelRatio: nextRatio });

			if (isAutoScroll && !splitDraggingRef.current) {
				requestAnimationFrame(() => {
					scrollLogsToBottom("auto");
				});
			}
		},
		[
			detailSplitConstraints.maxLogsPanelRatio,
			detailSplitConstraints.minLogsPanelRatio,
			isAutoScroll,
			scrollLogsToBottom,
		],
	);

	const handleDetailSplitDragging = useCallback(
		(isDragging: boolean) => {
			splitDraggingRef.current = isDragging;
			if (!isDragging && isAutoScroll) {
				requestAnimationFrame(() => {
					scrollLogsToBottom("auto");
				});
			}
		},
		[isAutoScroll, scrollLogsToBottom],
	);
	const riskQueueCount =
		realtimeQueueSnapshot.riskQueue.recon +
		realtimeQueueSnapshot.riskQueue.blrecon;
	const vulnerabilityQueueCount =
		realtimeQueueSnapshot.vulnerabilityQueue.finding +
		realtimeQueueSnapshot.vulnerabilityQueue.blfinding;

	const renderEventLogsPanel = () => (
		<div className="h-full min-h-0 overflow-hidden rounded-xl bg-card/50 flex flex-col">
			<div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
				<div className="flex items-center gap-2 flex-wrap">
					<Terminal className="w-4 h-4 text-primary" />
					<span className="text-sm font-semibold">事件日志</span>
					{isConnected ? (
						<Badge
							variant="outline"
							className="text-[11px] border-emerald-500/40 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
						>
							已连接
						</Badge>
					) : null}
					{isRunning ? (
						<div className="flex items-center gap-2 flex-wrap text-[11px] font-mono normal-case tracking-normal tabular-nums">
							<span className="rounded-md bg-muted/50 px-2.5 py-1 text-foreground/80">
								风险队列: {riskQueueCount} 个
							</span>
							<span className="rounded-md bg-muted/50 px-2.5 py-1 text-foreground/80">
								漏洞队列: {vulnerabilityQueueCount} 个
							</span>
							{/* <span className="rounded-md bg-muted/50 px-2.5 py-1 text-foreground/80">
								结果队列: {realtimeQueueSnapshot.resultQueue} 个
							</span> */}
						</div>
					) : null}
				</div>

				<div className="flex items-center gap-2">
					{(() => {
						const logExportDisabled = isRunning;

						const triggerButton = (
							<button
								type="button"
								disabled={logExportDisabled}
								className={
									logExportDisabled
										? "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground/40 cursor-not-allowed"
										: "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
								}
							>
								<Download className="w-3.5 h-3.5" />
								<span>导出日志</span>
							</button>
						);

						return logExportDisabled ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<span tabIndex={0} className="inline-flex">
										{triggerButton}
									</span>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									扫描任务执行中，完成后可导出日志
								</TooltipContent>
							</Tooltip>
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									{triggerButton}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => handleExportLogs("json")}>
										导出为 JSON
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => handleExportLogs("markdown")}>
										导出为 Markdown
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => toast.info("导出范围：全部活动日志")}
									>
										当前为全部导出
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						);
					})()}

					<button
						type="button"
						onClick={handleToggleAutoScroll}
						className={
							isAutoScroll
								? "flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs text-primary"
								: "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
						}
					>
						<ArrowDown className="w-3.5 h-3.5" />
						<span>自动滚动</span>
					</button>
				</div>
			</div>

			<div className="pt-2 min-h-0 flex-1">
				<div className="overflow-x-auto custom-scrollbar h-full">
					<div
						style={{ minWidth: `${EVENT_LOG_TABLE_MIN_WIDTH_PX}px` }}
						className="h-full min-h-0 flex flex-col"
					>
							<div
								className="grid items-center gap-3 border-b border-border/60 px-5 py-2 text-[11px] font-mono uppercase tracking-[0.24em] text-muted-foreground/80"
								style={{ gridTemplateColumns: EVENT_LOG_GRID_TEMPLATE }}
							>
								<span>时间戳</span>
								<span>类型</span>
								<span>事件概况</span>
								<span>操作</span>
							</div>
						{displayLogs.length === 0 ? (
							<div
								ref={logsContainerRef}
								onScroll={handleLogsScroll}
								className="overflow-y-auto custom-scrollbar-dark h-full min-h-0"
							>
								<div className="flex h-full items-center justify-center px-3">
									<div className="text-center text-muted-foreground">
										{isRunning ? (
											<div className="flex flex-col items-center gap-3">
												<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
												<span className="text-sm font-mono tracking-wide">
													等待活动日志...
												</span>
											</div>
										) : (
											<span className="text-sm font-mono tracking-wide">
												暂无活动日志
											</span>
										)}
									</div>
								</div>
							</div>
						) : (
							<EventLogVirtualList
								items={displayLogs}
								highlightedLogId={highlightedLogId}
								onOpenDetail={handleOpenLogDetail}
								scrollContainerRef={logsContainerRef}
								onScroll={handleLogsScroll}
								className="overflow-y-auto custom-scrollbar-dark h-full min-h-0"
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	const findingsPanel = (
		<div className="h-full">
			<RealtimeFindingsPanel
				taskId={task?.id || ""}
				items={visibleManagedFindings}
				isRunning={isRunning}
				isLoading={isFindingsLoading}
				currentPhase={task?.current_phase ?? null}
				filters={findingsFilters}
				onFiltersChange={handleFindingsFiltersChange}
				scrollContainerRef={findingsContainerRef}
				page={findingsPagination.page}
				pageSize={findingsPagination.pageSize}
				onPaginationChange={handleFindingsPaginationChange}
				updatingKey={findingStatusUpdatingKey}
				onToggleStatus={handleToggleFindingStatus}
				onOpenDetail={openFindingDetailPage}
			/>
		</div>
	);

	// ============ Render ============

	if (showSplash && !taskId) {
		return (
			<div className="min-h-[100dvh] bg-background flex items-center justify-center relative overflow-y-auto overflow-x-hidden">
				<div className="absolute inset-0 cyber-grid opacity-20" />
				<div className="absolute inset-0 vignette pointer-events-none" />

				<div className="relative z-10 w-full max-w-[1800px] mx-auto px-6 text-center py-[5vh]">
					{/* Logo + Title + Description */}
					<div className="mb-[6vh]">
						<button
							type="button"
							onClick={cycleLogoVariant}
							className="mx-auto mb-[3vh] w-48 h-48 rounded-[2.5rem] border border-primary/40 bg-primary/10 flex items-center justify-center shadow-[0_0_48px_rgba(59,130,246,0.4)] cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
							title="点击切换 Logo"
						>
							<img
								src={logoSrc}
								alt="VulHunter"
								className="w-32 h-32 object-contain"
							/>
						</button>

						<h1 className="text-6xl md:text-7xl font-mono font-bold tracking-wider text-foreground">
							VulHunter
						</h1>

						<p className="mt-[2vh] text-lg md:text-xl text-muted-foreground leading-relaxed">
							VulHunter 让你以静态、智能或混合方式快速发起代码安全扫描。
						</p>
					</div>

					{/* 快速扫描按钮 - 在卡片上方 */}
					<div className="mb-[6vh]">
						<button
							type="button"
							onClick={() =>
								navigate("/tasks/hybrid?openCreate=1&source=home-primary")
							}
							className="group relative px-10 md:px-14 py-4 md:py-5 text-lg md:text-xl font-bold text-white bg-gradient-to-r from-primary via-primary to-primary/90 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-primary/60 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 overflow-hidden"
						>
							{/* 背景动画效果 */}
							<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
							<span className="relative flex items-center justify-center gap-2">
								一键开始扫描
								<svg
									aria-hidden="true"
									className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
									fill="none"
									focusable="false"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2.5}
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
							</span>
						</button>
					</div>

					{/* 三种扫描方式卡片 */}
					<div className="mx-auto w-full md:w-[85%] grid grid-cols-1 md:grid-cols-[repeat(3,1fr)] gap-5">
						{homeScanCards.map((card) => {
							const Icon = card.icon;
							return (
								<button
									key={card.key}
									type="button"
									onClick={() => navigate(card.targetRoute)}
									aria-label={`${card.title}，点击快速开启扫描`}
									className="group relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_22px_48px_-28px_rgba(56,189,248,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
								>
									<div
										className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 ${card.accentClassName}`}
									/>

									{/* 内容容器 */}
									<div className="relative z-10 flex h-full flex-col pr-16">
										{/* 头部：Icon + Title */}
										<div className="flex-shrink-0 flex items-center gap-3 mb-6">
											<span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary flex-shrink-0">
												<Icon className="w-5 h-5" />
											</span>
											<h3 className="text-lg md:text-xl font-semibold text-foreground">
												{card.title}
											</h3>
										</div>

										{/* Intro 文本 - 偏中间位置 */}
										<div className="flex-1 flex flex-col justify-center">
											<p className="text-base md:text-lg text-foreground/80 leading-relaxed break-words font-medium">
												{card.intro}
											</p>
										</div>
									</div>

									{/* 右侧竖直大箭头 */}
									<div className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none">
										<svg
											aria-hidden="true"
											className="w-24 h-24 md:w-32 md:h-32 text-primary/60 transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:text-primary/90 group-hover:translate-x-2"
											fill="none"
											focusable="false"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={0.8}
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			</div>
		);
	}

	if (isLoading && !task) {
		return (
			<div className="h-[100dvh] max-h-[100dvh] bg-background flex items-center justify-center relative overflow-hidden">
				{/* Grid background */}
				<div className="absolute inset-0 cyber-grid opacity-30" />
				{/* Vignette */}
				<div className="absolute inset-0 vignette pointer-events-none" />
				<div className="flex items-center gap-3 text-muted-foreground relative z-10">
					<Loader2 className="w-5 h-5 animate-spin text-primary" />
					<span className="font-mono text-sm tracking-wide">
						正在加载扫描任务...
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="h-[100dvh] max-h-[100dvh] bg-background flex flex-col overflow-hidden relative">
			{/* Header */}
			<Header
				title={detailTitle}
				task={task}
				isRunning={isRunning}
				isCancelling={isCancelling}
				phaseLabel={currentPhaseLabel}
				phaseHint={phaseHint}
				onBack={handleBack}
				onCancel={handleCancel}
				onExport={handleExportReport}
			/>

			{/* Main content */}
			<div className="flex-1 overflow-hidden relative p-3 bg-muted/10">
				<div className="h-full flex flex-col gap-3">
					{failedReason && (
						<div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3">
							<div className="text-sm font-semibold text-rose-600 dark:text-rose-300">
								智能扫描失败{failedStep ? `（${failedStep}）` : ""}
							</div>
							<div className="mt-1 text-xs font-mono text-rose-700 dark:text-rose-200 whitespace-pre-wrap break-words">
								{failedReason}
							</div>
						</div>
					)}

					{/* Full-width stats row */}
					<div className="flex-shrink-0">
						<div
							ref={agentContainerRef}
							className="overflow-x-auto custom-scrollbar"
						>
							<StatsPanel
								summary={statsSummary}
								stageSummary={stageSummary}
								projectName={projectName}
							/>
						</div>
					</div>

					<div
						ref={setDetailSplitContainerNode}
						className="min-h-0 flex-1 overflow-hidden"
					>
						<ResizablePanelGroup
							ref={detailSplitGroupRef}
							direction="vertical"
							onLayout={handleDetailSplitLayout}
							className="min-h-0"
						>
							<ResizablePanel
								defaultSize={100 - desktopLogsPanelPercent}
								minSize={(1 - detailSplitConstraints.maxLogsPanelRatio) * 100}
								maxSize={(1 - detailSplitConstraints.minLogsPanelRatio) * 100}
								className="min-h-0"
							>
								{findingsPanel}
							</ResizablePanel>
							<ResizableHandle
								withHandle
								handlePositionPx={detailSplitHandlePositionPx}
								onDragging={handleDetailSplitDragging}
								className="bg-border/70 hover:bg-primary/40 transition-colors"
							/>
							<ResizablePanel
								defaultSize={desktopLogsPanelPercent}
								minSize={detailSplitConstraints.minLogsPanelRatio * 100}
								maxSize={detailSplitConstraints.maxLogsPanelRatio * 100}
								className="min-h-0"
							>
								{renderEventLogsPanel()}
							</ResizablePanel>
						</ResizablePanelGroup>
					</div>
				</div>
			</div>
			{/* Export dialog */}
			<ReportExportDialog
				open={showExportDialog}
				onOpenChange={setShowExportDialog}
				task={task}
				projectName={projectName}
				findings={findings}
			/>

			<AuditDetailDialog
				open={detailDialog !== null}
				detailType={detailDialog?.type ?? null}
				logItem={selectedLogItem}
				finding={selectedFinding}
				agentNode={selectedAgentNode}
				onBack={handleDetailBack}
				onOpenChange={(open) => {
					if (!open) {
						handleDetailBack();
					}
				}}
			/>
		</div>
	);
}

// Wrapped export with Error Boundary
export default function AgentAuditTaskDetailPage() {
	const { taskId } = useParams<{ taskId: string }>();

	return (
		<AgentErrorBoundary
			taskId={taskId}
			onRetry={() => window.location.reload()}
		>
			<AgentAuditPageContent />
		</AgentErrorBoundary>
	);
}
