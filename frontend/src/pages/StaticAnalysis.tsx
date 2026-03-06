import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
	AlertCircle,
	ArrowLeft,
	Ban,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	getGitleaksFindings,
	getGitleaksScanTask,
	interruptGitleaksScanTask,
	updateGitleaksFindingStatus,
	type GitleaksFinding,
	type GitleaksScanTask,
} from "@/shared/api/gitleaks";
import {
	getOpengrepScanFindings,
	getOpengrepScanTask,
	interruptOpengrepScanTask,
	updateOpengrepFindingStatus,
	type OpengrepFinding,
	type OpengrepScanTask,
} from "@/shared/api/opengrep";
import {
	appendReturnTo,
	buildFindingDetailPath,
} from "@/shared/utils/findingRoute";

type Engine = "opengrep" | "gitleaks";
type EngineFilter = "all" | Engine;
type FindingStatus = "open" | "verified" | "false_positive" | "fixed";
type StatusFilter = "all" | FindingStatus;
type ConfidenceFilter = "all" | "HIGH" | "MEDIUM" | "LOW";
type NormalizedSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type NormalizedConfidence = "HIGH" | "MEDIUM" | "LOW";

type UnifiedFindingRow = {
	key: string;
	id: string;
	taskId: string;
	engine: Engine;
	rule: string;
	filePath: string;
	line: number | null;
	severity: NormalizedSeverity;
	severityScore: number;
	confidence: NormalizedConfidence;
	confidenceScore: number;
	status: string;
};

const PAGE_SIZE = 10;
const FINDING_BATCH_SIZE = 200;
const MAX_FINDING_BATCH_PAGES = 500;

const YES_BADGE_CLASS = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
const NO_BADGE_CLASS = "bg-muted text-muted-foreground border-border";

const SEVERITY_SCORE: Record<NormalizedSeverity, number> = {
	CRITICAL: 4,
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
};

const CONFIDENCE_SCORE: Record<NormalizedConfidence, number> = {
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
};

function decodePathParam(raw: string | undefined): string {
	try {
		return decodeURIComponent(String(raw || "")).trim();
	} catch {
		return String(raw || "").trim();
	}
}

function normalizePath(path?: string | null): string {
	const raw = String(path || "").trim();
	if (!raw) return "-";
	const unified = raw.replace(/\\/g, "/");
	const tmpIndex = unified.indexOf("/tmp/");
	if (tmpIndex >= 0) {
		const trimmed = unified.slice(tmpIndex + 5);
		const parts = trimmed.split("/").filter(Boolean);
		if (parts.length > 1) {
			return parts.slice(1).join("/");
		}
	}
	return unified.replace(/^\/+/, "") || "-";
}

function normalizeSeverity(severity?: string | null): NormalizedSeverity {
	const normalized = String(severity || "").trim().toUpperCase();
	if (normalized === "CRITICAL") return "CRITICAL";
	if (normalized === "HIGH") return "HIGH";
	if (normalized === "ERROR" || normalized === "WARNING" || normalized === "MEDIUM") {
		return "MEDIUM";
	}
	return "LOW";
}

function getSeverityLabel(severity: NormalizedSeverity): string {
	if (severity === "CRITICAL") return "严重";
	if (severity === "HIGH") return "高危";
	if (severity === "MEDIUM") return "中危";
	return "低危";
}

function getSeverityBadgeClass(severity: NormalizedSeverity): string {
	if (severity === "CRITICAL") {
		return "bg-rose-500/20 text-rose-300 border-rose-500/30";
	}
	if (severity === "HIGH") {
		return "bg-amber-500/20 text-amber-300 border-amber-500/30";
	}
	if (severity === "MEDIUM") {
		return "bg-sky-500/20 text-sky-300 border-sky-500/30";
	}
	return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
}

function normalizeConfidence(confidence?: string | null): NormalizedConfidence {
	const normalized = String(confidence || "").trim().toUpperCase();
	if (normalized === "HIGH") return "HIGH";
	if (normalized === "LOW") return "LOW";
	return "MEDIUM";
}

function getConfidenceLabel(confidence: NormalizedConfidence): string {
	if (confidence === "HIGH") return "高";
	if (confidence === "LOW") return "低";
	return "中";
}

function getConfidenceBadgeClass(confidence: NormalizedConfidence): string {
	if (confidence === "HIGH") {
		return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
	}
	if (confidence === "LOW") {
		return "bg-sky-500/20 text-sky-300 border-sky-500/30";
	}
	return "bg-amber-500/20 text-amber-300 border-amber-500/30";
}

function getSeverityScore(severity: NormalizedSeverity): number {
	return SEVERITY_SCORE[severity];
}

function getConfidenceScore(confidence: NormalizedConfidence): number {
	return CONFIDENCE_SCORE[confidence];
}

function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	const seconds = ms / 1000;
	if (seconds < 60) return `${seconds.toFixed(2)} s`;
	const minutes = Math.floor(seconds / 60);
	const remainSeconds = Math.round(seconds % 60);
	return `${minutes}m ${remainSeconds}s`;
}

function toPositiveLine(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPollableStatus(status?: string | null): boolean {
	const normalized = String(status || "").trim().toLowerCase();
	return normalized === "pending" || normalized === "running";
}

function isInterruptibleStatus(status?: string | null): boolean {
	return isPollableStatus(status);
}

function isCompletedStatus(status?: string | null): boolean {
	return String(status || "").trim().toLowerCase() === "completed";
}

function toSafeMetric(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getOpengrepRuleName(finding: OpengrepFinding): string {
	const rule = (finding.rule || {}) as Record<string, unknown>;
	const byField = String(finding.rule_name || "").trim();
	if (byField) return byField;
	const byCheckId = String(rule.check_id || rule.id || "").trim();
	if (byCheckId) return byCheckId;
	return "-";
}

async function fetchAllOpengrepFindings(taskId: string): Promise<OpengrepFinding[]> {
	const allFindings: OpengrepFinding[] = [];
	for (let page = 0; page < MAX_FINDING_BATCH_PAGES; page += 1) {
		const batch = await getOpengrepScanFindings({
			taskId,
			skip: page * FINDING_BATCH_SIZE,
			limit: FINDING_BATCH_SIZE,
		});
		allFindings.push(...batch);
		if (batch.length < FINDING_BATCH_SIZE) break;
	}
	return allFindings;
}

async function fetchAllGitleaksFindings(taskId: string): Promise<GitleaksFinding[]> {
	const allFindings: GitleaksFinding[] = [];
	for (let page = 0; page < MAX_FINDING_BATCH_PAGES; page += 1) {
		const batch = await getGitleaksFindings({
			taskId,
			skip: page * FINDING_BATCH_SIZE,
			limit: FINDING_BATCH_SIZE,
		});
		allFindings.push(...batch);
		if (batch.length < FINDING_BATCH_SIZE) break;
	}
	return allFindings;
}

export default function StaticAnalysis() {
	const { taskId: rawTaskId } = useParams<{ taskId: string }>();
	const location = useLocation();
	const navigate = useNavigate();

	const searchParams = useMemo(
		() => new URLSearchParams(location.search),
		[location.search],
	);

	const taskId = useMemo(() => decodePathParam(rawTaskId), [rawTaskId]);
	const toolParam = searchParams.get("tool");
	const returnToParam = searchParams.get("returnTo") || "";
	const returnTo =
		returnToParam.startsWith("/") && !returnToParam.startsWith("//")
			? returnToParam
			: "";
	const currentRoute = `${location.pathname}${location.search}`;

	const opengrepTaskId = useMemo(() => {
		const explicit = searchParams.get("opengrepTaskId");
		if (explicit) return explicit;
		if (toolParam === "gitleaks") return "";
		return taskId;
	}, [searchParams, taskId, toolParam]);

	const gitleaksTaskId = useMemo(() => {
		const explicit = searchParams.get("gitleaksTaskId");
		if (explicit) return explicit;
		if (toolParam === "gitleaks") return taskId;
		return "";
	}, [searchParams, taskId, toolParam]);

	const hasEnabledEngine = Boolean(opengrepTaskId || gitleaksTaskId);

	const [opengrepTask, setOpengrepTask] = useState<OpengrepScanTask | null>(null);
	const [gitleaksTask, setGitleaksTask] = useState<GitleaksScanTask | null>(null);
	const [opengrepFindings, setOpengrepFindings] = useState<OpengrepFinding[]>([]);
	const [gitleaksFindings, setGitleaksFindings] = useState<GitleaksFinding[]>([]);

	const [loadingInitial, setLoadingInitial] = useState(true);
	const [loadingTask, setLoadingTask] = useState(false);
	const [loadingFindings, setLoadingFindings] = useState(false);
	const [updatingKey, setUpdatingKey] = useState<string | null>(null);
	const [interruptTarget, setInterruptTarget] = useState<Engine | null>(null);
	const [interrupting, setInterrupting] = useState(false);

	const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [confidenceFilter, setConfidenceFilter] =
		useState<ConfidenceFilter>("all");
	const [page, setPage] = useState(1);

	const opengrepSilentRefreshRef = useRef(false);
	const gitleaksSilentRefreshRef = useRef(false);

	const loadOpengrepTask = useCallback(
		async (silent: boolean = false) => {
			if (!opengrepTaskId) {
				setOpengrepTask(null);
				return;
			}
			try {
				if (!silent) setLoadingTask(true);
				const task = await getOpengrepScanTask(opengrepTaskId);
				setOpengrepTask(task);
			} catch (error) {
				setOpengrepTask(null);
				if (!silent) {
					toast.error("加载 Opengrep 任务失败");
				}
			} finally {
				if (!silent) setLoadingTask(false);
			}
		},
		[opengrepTaskId],
	);

	const loadGitleaksTask = useCallback(
		async (silent: boolean = false) => {
			if (!gitleaksTaskId) {
				setGitleaksTask(null);
				return;
			}
			try {
				if (!silent) setLoadingTask(true);
				const task = await getGitleaksScanTask(gitleaksTaskId);
				setGitleaksTask(task);
			} catch (error) {
				setGitleaksTask(null);
				if (!silent) {
					toast.error("加载 Gitleaks 任务失败");
				}
			} finally {
				if (!silent) setLoadingTask(false);
			}
		},
		[gitleaksTaskId],
	);

	const loadOpengrepFindings = useCallback(
		async (silent: boolean = false) => {
			if (!opengrepTaskId) {
				setOpengrepFindings([]);
				return;
			}
			try {
				if (!silent) setLoadingFindings(true);
				const findings = await fetchAllOpengrepFindings(opengrepTaskId);
				setOpengrepFindings(findings);
			} catch (error) {
				setOpengrepFindings([]);
				if (!silent) {
					toast.error("加载 Opengrep 漏洞失败");
				}
			} finally {
				if (!silent) setLoadingFindings(false);
			}
		},
		[opengrepTaskId],
	);

	const loadGitleaksFindings = useCallback(
		async (silent: boolean = false) => {
			if (!gitleaksTaskId) {
				setGitleaksFindings([]);
				return;
			}
			try {
				if (!silent) setLoadingFindings(true);
				const findings = await fetchAllGitleaksFindings(gitleaksTaskId);
				setGitleaksFindings(findings);
			} catch (error) {
				setGitleaksFindings([]);
				if (!silent) {
					toast.error("加载 Gitleaks 漏洞失败");
				}
			} finally {
				if (!silent) setLoadingFindings(false);
			}
		},
		[gitleaksTaskId],
	);

	const refreshAll = useCallback(
		async (silent: boolean = false) => {
			if (!hasEnabledEngine) {
				setLoadingInitial(false);
				return;
			}
			if (!silent) setLoadingInitial(true);
			try {
				await Promise.all([
					loadOpengrepTask(silent),
					loadGitleaksTask(silent),
					loadOpengrepFindings(silent),
					loadGitleaksFindings(silent),
				]);
			} finally {
				if (!silent) setLoadingInitial(false);
			}
		},
		[
			hasEnabledEngine,
			loadGitleaksFindings,
			loadGitleaksTask,
			loadOpengrepFindings,
			loadOpengrepTask,
		],
	);

	const refreshOpengrepSilently = useCallback(async () => {
		if (!opengrepTaskId || opengrepSilentRefreshRef.current) return;
		opengrepSilentRefreshRef.current = true;
		try {
			await loadOpengrepTask(true);
			await loadOpengrepFindings(true);
		} finally {
			opengrepSilentRefreshRef.current = false;
		}
	}, [loadOpengrepFindings, loadOpengrepTask, opengrepTaskId]);

	const refreshGitleaksSilently = useCallback(async () => {
		if (!gitleaksTaskId || gitleaksSilentRefreshRef.current) return;
		gitleaksSilentRefreshRef.current = true;
		try {
			await loadGitleaksTask(true);
			await loadGitleaksFindings(true);
		} finally {
			gitleaksSilentRefreshRef.current = false;
		}
	}, [gitleaksTaskId, loadGitleaksFindings, loadGitleaksTask]);

	const unifiedRows = useMemo<UnifiedFindingRow[]>(() => {
		const opengrepRows = opengrepFindings.map((finding) => {
			const severity = normalizeSeverity(finding.severity);
			const confidence = normalizeConfidence(finding.confidence);
			return {
				key: `opengrep:${finding.id}`,
				id: finding.id,
				taskId: finding.scan_task_id || opengrepTaskId,
				engine: "opengrep" as const,
				rule: getOpengrepRuleName(finding),
				filePath: normalizePath(finding.file_path),
				line: toPositiveLine(finding.start_line),
				severity,
				severityScore: getSeverityScore(severity),
				confidence,
				confidenceScore: getConfidenceScore(confidence),
				status: String(finding.status || "open").trim().toLowerCase(),
			};
		});

		const gitleaksRows = gitleaksFindings.map((finding) => ({
			key: `gitleaks:${finding.id}`,
			id: finding.id,
			taskId: finding.scan_task_id || gitleaksTaskId,
			engine: "gitleaks" as const,
			rule: String(finding.rule_id || "").trim() || "-",
			filePath: normalizePath(finding.file_path),
			line: toPositiveLine(finding.start_line),
			severity: "LOW" as const,
			severityScore: getSeverityScore("LOW"),
			confidence: "MEDIUM" as const,
			confidenceScore: getConfidenceScore("MEDIUM"),
			status: String(finding.status || "open").trim().toLowerCase(),
		}));

		return [...opengrepRows, ...gitleaksRows];
	}, [gitleaksFindings, gitleaksTaskId, opengrepFindings, opengrepTaskId]);

	const filteredRows = useMemo(() => {
		const nextRows = unifiedRows
			.filter((row) => {
				if (engineFilter === "all") return true;
				return row.engine === engineFilter;
			})
			.filter((row) => {
				if (statusFilter === "all") return true;
				return row.status === statusFilter;
			})
			.filter((row) => {
				if (confidenceFilter === "all") return true;
				if (row.engine !== "opengrep") return true;
				return row.confidence === confidenceFilter;
			})
			.sort((a, b) => {
				if (a.severityScore !== b.severityScore) {
					return b.severityScore - a.severityScore;
				}
				if (a.confidenceScore !== b.confidenceScore) {
					return b.confidenceScore - a.confidenceScore;
				}
				const pathCompare = a.filePath.localeCompare(b.filePath);
				if (pathCompare !== 0) return pathCompare;
				const lineA = a.line ?? Number.MAX_SAFE_INTEGER;
				const lineB = b.line ?? Number.MAX_SAFE_INTEGER;
				if (lineA !== lineB) return lineA - lineB;
				return a.key.localeCompare(b.key);
			});
		return nextRows;
	}, [confidenceFilter, engineFilter, statusFilter, unifiedRows]);

	const totalRows = filteredRows.length;
	const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
	const clampedPage = Math.min(page, totalPages);
	const pageStart = (clampedPage - 1) * PAGE_SIZE;
	const pagedRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

	const enabledEngines = useMemo(() => {
		const engines: Engine[] = [];
		if (opengrepTaskId) engines.push("opengrep");
		if (gitleaksTaskId) engines.push("gitleaks");
		return engines;
	}, [gitleaksTaskId, opengrepTaskId]);

	const enabledEngineCount = enabledEngines.length;
	const completedEngineCount = useMemo(() => {
		let count = 0;
		if (opengrepTaskId && isCompletedStatus(opengrepTask?.status)) count += 1;
		if (gitleaksTaskId && isCompletedStatus(gitleaksTask?.status)) count += 1;
		return count;
	}, [gitleaksTask?.status, gitleaksTaskId, opengrepTask?.status, opengrepTaskId]);

	const progressPercent = Math.max(
		0,
		Math.min(
			100,
			enabledEngineCount > 0
				? Math.round((completedEngineCount / enabledEngineCount) * 100)
				: 0,
		),
	);

	const totalScanDurationMs =
		toSafeMetric(opengrepTask?.scan_duration_ms) +
		toSafeMetric(gitleaksTask?.scan_duration_ms);
	const totalFindings =
		toSafeMetric(opengrepTask?.total_findings) +
		toSafeMetric(gitleaksTask?.total_findings);
	const totalFilesScanned =
		toSafeMetric(opengrepTask?.files_scanned) +
		toSafeMetric(gitleaksTask?.files_scanned);

	const canInterruptOpengrep = Boolean(
		opengrepTaskId && isInterruptibleStatus(opengrepTask?.status),
	);
	const canInterruptGitleaks = Boolean(
		gitleaksTaskId && isInterruptibleStatus(gitleaksTask?.status),
	);

	const handleBack = () => {
		if (returnTo) {
			navigate(returnTo);
			return;
		}
		navigate(-1);
	};

	const handleRefresh = async () => {
		await refreshAll(false);
	};

	const handleInterrupt = async () => {
		if (!interruptTarget) return;
		setInterrupting(true);
		try {
			if (interruptTarget === "opengrep" && opengrepTaskId) {
				await interruptOpengrepScanTask(opengrepTaskId);
				toast.success("Opengrep 任务已中止");
			}
			if (interruptTarget === "gitleaks" && gitleaksTaskId) {
				await interruptGitleaksScanTask(gitleaksTaskId);
				toast.success("Gitleaks 任务已中止");
			}
			await refreshAll(true);
		} catch (error) {
			toast.error("中止任务失败");
		} finally {
			setInterrupting(false);
			setInterruptTarget(null);
		}
	};

	const handleToggleStatus = async (
		row: UnifiedFindingRow,
		target: FindingStatus,
	) => {
		if (row.engine === "opengrep" && target === "fixed") return;
		const currentStatus = String(row.status || "open").toLowerCase();
		const nextStatus: FindingStatus =
			currentStatus === target ? "open" : target;
		const updateKey = `${row.engine}:${row.id}:${target}`;
		setUpdatingKey(updateKey);
		try {
			if (row.engine === "opengrep") {
				await updateOpengrepFindingStatus({
					findingId: row.id,
					status: nextStatus === "fixed" ? "open" : nextStatus,
				});
				setOpengrepFindings((prev) =>
					prev.map((finding) =>
						finding.id === row.id ? { ...finding, status: nextStatus } : finding,
					),
				);
			} else {
				await updateGitleaksFindingStatus({
					findingId: row.id,
					status: nextStatus,
				});
				setGitleaksFindings((prev) =>
					prev.map((finding) =>
						finding.id === row.id ? { ...finding, status: nextStatus } : finding,
					),
				);
			}
		} catch (error) {
			toast.error("更新状态失败");
		} finally {
			setUpdatingKey(null);
		}
	};

	useEffect(() => {
		void refreshAll(false);
	}, [refreshAll]);

	useEffect(() => {
		setPage(1);
	}, [engineFilter, statusFilter, confidenceFilter]);

	useEffect(() => {
		if (page !== clampedPage) {
			setPage(clampedPage);
		}
	}, [clampedPage, page]);

	useEffect(() => {
		if (!opengrepTaskId || !isPollableStatus(opengrepTask?.status)) return;
		const timer = setInterval(() => {
			void refreshOpengrepSilently();
		}, 5000);
		return () => clearInterval(timer);
	}, [opengrepTask?.status, opengrepTaskId, refreshOpengrepSilently]);

	useEffect(() => {
		if (!gitleaksTaskId || !isPollableStatus(gitleaksTask?.status)) return;
		const timer = setInterval(() => {
			void refreshGitleaksSilently();
		}, 5000);
		return () => clearInterval(timer);
	}, [gitleaksTask?.status, gitleaksTaskId, refreshGitleaksSilently]);

	if (!hasEnabledEngine) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="cyber-card p-8 text-center space-y-4">
					<AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
					<p className="text-sm text-muted-foreground">
						静态分析任务参数无效，无法加载详情。
					</p>
					<Button variant="outline" className="cyber-btn-outline" onClick={handleBack}>
						<ArrowLeft className="w-4 h-4 mr-2" />
						返回
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5 p-6 bg-background min-h-screen">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold tracking-wider uppercase text-foreground">
						静态分析详情
					</h1>
				</div>
				<div className="flex items-center gap-2">
					{canInterruptOpengrep ? (
						<Button
							variant="outline"
							className="cyber-btn-outline h-8"
							onClick={() => setInterruptTarget("opengrep")}
						>
							<Ban className="w-3.5 h-3.5 mr-1.5" />
							中止 Opengrep
						</Button>
					) : null}
					{canInterruptGitleaks ? (
						<Button
							variant="outline"
							className="cyber-btn-outline h-8"
							onClick={() => setInterruptTarget("gitleaks")}
						>
							<Ban className="w-3.5 h-3.5 mr-1.5" />
							中止 Gitleaks
						</Button>
					) : null}
					<Button
						variant="outline"
						className="cyber-btn-outline h-8"
						onClick={handleRefresh}
						disabled={loadingInitial || loadingTask || loadingFindings}
					>
						<RefreshCw
							className={`w-3.5 h-3.5 mr-1.5 ${loadingInitial ? "animate-spin" : ""}`}
						/>
						刷新
					</Button>
					<Button variant="outline" className="cyber-btn-outline h-8" onClick={handleBack}>
						<ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
						返回
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
				<div className="cyber-card p-4 space-y-2">
					<p className="text-xs font-semibold uppercase text-muted-foreground">
						进度比例
					</p>
					<p className="text-xl font-bold text-foreground">
						{progressPercent}%
					</p>
					<Progress
						value={progressPercent}
						className="h-1.5 bg-muted [&>div]:bg-emerald-500"
					/>
					<p className="text-xs text-muted-foreground">
						已完成 {completedEngineCount} / {enabledEngineCount}
					</p>
				</div>
				<div className="cyber-card p-4 space-y-1">
					<p className="text-xs font-semibold uppercase text-muted-foreground">
						扫描时间
					</p>
					<p className="text-xl font-bold text-foreground">
						{formatDuration(totalScanDurationMs)}
					</p>
					<p className="text-xs text-muted-foreground">
						合计 {totalScanDurationMs.toLocaleString()} ms
					</p>
				</div>
				<div className="cyber-card p-4 space-y-1">
					<p className="text-xs font-semibold uppercase text-muted-foreground">
						扫描漏洞数量
					</p>
					<p className="text-xl font-bold text-foreground">
						{totalFindings.toLocaleString()}
					</p>
					<p className="text-xs text-muted-foreground">多引擎总计</p>
				</div>
				<div className="cyber-card p-4 space-y-1">
					<p className="text-xs font-semibold uppercase text-muted-foreground">
						使用引擎数量
					</p>
					<p className="text-xl font-bold text-foreground">
						{enabledEngineCount.toLocaleString()}
					</p>
					<p className="text-xs text-muted-foreground">
						{enabledEngines
							.map((engine) => (engine === "opengrep" ? "Opengrep" : "Gitleaks"))
							.join(" / ") || "-"}
					</p>
				</div>
				<div className="cyber-card p-4 space-y-1">
					<p className="text-xs font-semibold uppercase text-muted-foreground">
						涉及文件
					</p>
					<p className="text-xl font-bold text-foreground">
						{totalFilesScanned.toLocaleString()}
					</p>
					<p className="text-xs text-muted-foreground">多引擎总计</p>
				</div>
			</div>

			<div className="cyber-card p-4 space-y-3">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
							引擎筛选
						</label>
						<Select
							value={engineFilter}
							onValueChange={(value) => setEngineFilter(value as EngineFilter)}
						>
							<SelectTrigger className="cyber-input">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="cyber-dialog border-border">
								<SelectItem value="all">全部</SelectItem>
								<SelectItem value="opengrep">Opengrep</SelectItem>
								<SelectItem value="gitleaks">Gitleaks</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
							状态筛选
						</label>
						<Select
							value={statusFilter}
							onValueChange={(value) => setStatusFilter(value as StatusFilter)}
						>
							<SelectTrigger className="cyber-input">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="cyber-dialog border-border">
								<SelectItem value="all">全部</SelectItem>
								<SelectItem value="open">未处理</SelectItem>
								<SelectItem value="verified">已验证</SelectItem>
								<SelectItem value="false_positive">误报</SelectItem>
								<SelectItem value="fixed">已修复</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
							置信度筛选（仅 Opengrep）
						</label>
						<Select
							value={confidenceFilter}
							onValueChange={(value) =>
								setConfidenceFilter(value as ConfidenceFilter)
							}
						>
							<SelectTrigger className="cyber-input">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="cyber-dialog border-border">
								<SelectItem value="all">全部</SelectItem>
								<SelectItem value="HIGH">高</SelectItem>
								<SelectItem value="MEDIUM">中</SelectItem>
								<SelectItem value="LOW">低</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
					<span>
						符合筛选 {totalRows.toLocaleString()} 条，当前第 {clampedPage} /{" "}
						{totalPages.toLocaleString()} 页
					</span>
					<span>排序规则：危害降序；同危害按置信度降序；其后按路径+行号升序</span>
				</div>

				<div className="border border-border rounded-md overflow-x-auto">
					<Table className="min-w-[1400px]">
						<TableHeader>
							<TableRow>
								<TableHead className="w-[72px]">序号</TableHead>
								<TableHead className="w-[110px]">所属引擎</TableHead>
								<TableHead className="min-w-[220px]">命中规则</TableHead>
								<TableHead className="min-w-[240px]">命中位置</TableHead>
								<TableHead className="w-[120px]">漏洞危害</TableHead>
								<TableHead className="w-[110px]">置信度</TableHead>
								<TableHead className="w-[220px]">处理状态</TableHead>
								<TableHead className="min-w-[280px]">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loadingInitial ? (
								<TableRow>
									<TableCell colSpan={8} className="py-12 text-center">
										<div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
											<Loader2 className="w-4 h-4 animate-spin" />
											加载扫描数据中...
										</div>
									</TableCell>
								</TableRow>
							) : pagedRows.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="py-12 text-center">
										<div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
											<AlertCircle className="w-4 h-4" />
											暂无符合条件的漏洞
										</div>
									</TableCell>
								</TableRow>
							) : (
								pagedRows.map((row, index) => {
									const rowStatus = String(row.status || "open").toLowerCase();
									const processed = rowStatus !== "open";
									const verified = rowStatus === "verified";
									const falsePositive = rowStatus === "false_positive";
									const isOpengrep = row.engine === "opengrep";
									const verifyUpdating = updatingKey === `${row.engine}:${row.id}:verified`;
									const falsePositiveUpdating =
										updatingKey === `${row.engine}:${row.id}:false_positive`;
									const fixedUpdating = updatingKey === `${row.engine}:${row.id}:fixed`;

									const detailRoute = appendReturnTo(
										buildFindingDetailPath({
											source: "static",
											taskId: row.taskId,
											findingId: row.id,
											engine: row.engine,
										}),
										currentRoute,
									);

									return (
										<TableRow key={row.key}>
											<TableCell className="font-mono text-xs">
												{(pageStart + index + 1).toLocaleString()}
											</TableCell>
											<TableCell>
												<Badge
													className={
														row.engine === "opengrep"
															? "bg-sky-500/20 text-sky-300 border-sky-500/30"
															: "bg-amber-500/20 text-amber-300 border-amber-500/30"
													}
												>
													{row.engine === "opengrep" ? "Opengrep" : "Gitleaks"}
												</Badge>
											</TableCell>
											<TableCell className="text-sm break-all">
												{row.rule || "-"}
											</TableCell>
											<TableCell className="font-mono text-xs break-all">
												{row.filePath}
												{row.line ? `:${row.line}` : ""}
											</TableCell>
											<TableCell>
												<Badge className={getSeverityBadgeClass(row.severity)}>
													{getSeverityLabel(row.severity)}
												</Badge>
											</TableCell>
											<TableCell>
												<Badge className={getConfidenceBadgeClass(row.confidence)}>
													{getConfidenceLabel(row.confidence)}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
													<Badge className={processed ? YES_BADGE_CLASS : NO_BADGE_CLASS}>
														处理：{processed ? "是" : "否"}
													</Badge>
													<Badge className={verified ? YES_BADGE_CLASS : NO_BADGE_CLASS}>
														验证：{verified ? "是" : "否"}
													</Badge>
													<Badge
														className={falsePositive ? YES_BADGE_CLASS : NO_BADGE_CLASS}
													>
														误报：{falsePositive ? "是" : "否"}
													</Badge>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5 flex-wrap">
													<Button
														asChild
														size="sm"
														variant="outline"
														className="cyber-btn-outline h-7 px-2.5"
													>
														<Link to={detailRoute}>详情</Link>
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="cyber-btn-outline h-7 px-2.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
														disabled={Boolean(updatingKey)}
														onClick={() => handleToggleStatus(row, "verified")}
													>
														{verifyUpdating ? (
															<Loader2 className="w-3 h-3 animate-spin" />
														) : rowStatus === "verified" ? (
															"取消验证"
														) : (
															"验证"
														)}
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="cyber-btn-outline h-7 px-2.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
														disabled={Boolean(updatingKey)}
														onClick={() => handleToggleStatus(row, "false_positive")}
													>
														{falsePositiveUpdating ? (
															<Loader2 className="w-3 h-3 animate-spin" />
														) : rowStatus === "false_positive" ? (
															"取消误报"
														) : (
															"误报"
														)}
													</Button>
													{isOpengrep ? null : (
														<Button
															size="sm"
															variant="outline"
															className="cyber-btn-outline h-7 px-2.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
															disabled={Boolean(updatingKey)}
															onClick={() => handleToggleStatus(row, "fixed")}
														>
															{fixedUpdating ? (
																<Loader2 className="w-3 h-3 animate-spin" />
															) : rowStatus === "fixed" ? (
																"取消修复"
															) : (
																"修复"
															)}
														</Button>
													)}
												</div>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				<div className="flex items-center justify-between gap-2 flex-wrap">
					<div className="text-xs text-muted-foreground">
						共 {totalRows.toLocaleString()} 条，当前显示{" "}
						{pagedRows.length.toLocaleString()} 条
					</div>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							className="cyber-btn-outline h-8"
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							disabled={clampedPage <= 1}
						>
							上一页
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="cyber-btn-outline h-8"
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							disabled={clampedPage >= totalPages}
						>
							下一页
						</Button>
					</div>
				</div>
			</div>

			<AlertDialog
				open={Boolean(interruptTarget)}
				onOpenChange={(open) => {
					if (!open) setInterruptTarget(null);
				}}
			>
				<AlertDialogContent className="cyber-dialog border-border">
					<AlertDialogHeader>
						<AlertDialogTitle>确认中止任务？</AlertDialogTitle>
						<AlertDialogDescription>
							即将中止
							{interruptTarget === "opengrep" ? " Opengrep " : " Gitleaks "}
							扫描任务。中止后任务状态将更新为已中断。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={interrupting}>取消</AlertDialogCancel>
						<AlertDialogAction
							disabled={interrupting}
							onClick={(event) => {
								event.preventDefault();
								void handleInterrupt();
							}}
							className="bg-rose-600 hover:bg-rose-500"
						>
							{interrupting ? (
								<span className="inline-flex items-center gap-1.5">
									<Loader2 className="w-3.5 h-3.5 animate-spin" />
									处理中...
								</span>
							) : (
								"确认中止"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
