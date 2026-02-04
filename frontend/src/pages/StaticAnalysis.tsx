import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    interruptOpengrepScanTask,
    getOpengrepFindingContext,
    getOpengrepScanFindings,
    getOpengrepScanProgress,
    getOpengrepScanTask,
    updateOpengrepFindingStatus,
    type OpengrepFindingContext,
    type OpengrepFinding,
    type OpengrepScanProgress,
    type OpengrepScanTask,
} from "@/shared/api/opengrep";
import {
    interruptGitleaksScanTask,
    getGitleaksFindings,
    getGitleaksScanTask,
    updateGitleaksFindingStatus,
    type GitleaksFinding,
    type GitleaksScanTask,
} from "@/shared/api/gitleaks";
import { showToastQueue } from "@/shared/utils/toastQueue";
import {
    runWithRefreshMode,
    type RefreshOptions,
} from "@/shared/utils/refreshMode";
import {
    AlertCircle,
    ArrowLeft,
    Ban,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Shield,
    Loader2,
} from "lucide-react";
import { useI18n } from "@/shared/i18n";

const STATUS_LABELS: Record<string, string> = {
    pending: "等待中",
    running: "运行中",
    completed: "已完成",
    failed: "失败",
    interrupted: "已中断",
};

const STATUS_CLASSES: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    running: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    failed: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    interrupted: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const SEVERITY_CLASSES: Record<string, string> = {
    ERROR: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    WARNING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    INFO: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

const FINDING_STATUS_CLASSES: Record<string, string> = {
    open: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    verified: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    false_positive: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const GITLEAKS_STATUS_CLASSES: Record<string, string> = {
    open: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    verified: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    false_positive: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    fixed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const VERIFICATION_BADGE_CLASSES = {
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    inactive: "bg-muted text-muted-foreground border-border",
};

const FALSE_POSITIVE_BADGE_CLASSES = {
    active: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    inactive: "bg-muted text-muted-foreground border-border",
};
const FINDINGS_PAGE_SIZE = 200;
const FINDINGS_MAX_PAGES = 500;

const normalizePath = (path?: string | null) => {
    if (!path) return "";
    const tmpIndex = path.indexOf("/tmp/");
    if (tmpIndex >= 0) {
        const trimmed = path.slice(tmpIndex + 5);
        const parts = trimmed.split("/");
        if (parts.length > 1) {
            return parts.slice(1).join("/");
        }
    }
    return path;
};

const stripRuntimeRulePrefix = (value?: string | null) =>
    String(value || "")
        .trim()
        .replace(/^(?:tmp[-_]+|tem[-_]+)/i, "");

const getCheckIdSuffix = (checkId?: string | null) => {
    const value = String(checkId || "").trim();
    if (!value) return "";
    const parts = value.split(".");
    const suffix = parts[parts.length - 1] || value;
    return stripRuntimeRulePrefix(suffix);
};

const parseConfidenceLevel = (
    confidence?: string | null,
): "HIGH" | "MEDIUM" | "LOW" | null => {
    const normalized = String(confidence || "").trim().toUpperCase();
    if (normalized === "HIGH") return "HIGH";
    if (normalized === "MEDIUM") return "MEDIUM";
    if (normalized === "LOW") return "LOW";
    return null;
};

const getRuleMeta = (finding: OpengrepFinding) => {
    const rule = (finding.rule || {}) as Record<string, any>;
    const extra = (rule.extra || {}) as Record<string, any>;
    const metadata = (extra.metadata || {}) as Record<string, any>;
    return {
        checkId: rule.check_id || rule.id || "unknown-rule",
        message: extra.message || finding.description || "",
        references: Array.isArray(metadata.references)
            ? metadata.references
            : [],
        path: rule.path || finding.file_path,
        line: rule.start?.line || finding.start_line,
        lines: extra.lines || finding.code_snippet || "",
        validationState: extra.validation_state,
        start: rule.start,
        end: rule.end,
        metadata,
        extra,
        rule,
    };
};

const isSameOpengrepTask = (
    prev: OpengrepScanTask | null,
    next: OpengrepScanTask,
) => {
    if (!prev) return false;
    return (
        prev.id === next.id &&
        prev.status === next.status &&
        prev.total_findings === next.total_findings &&
        prev.error_count === next.error_count &&
        prev.warning_count === next.warning_count &&
        prev.files_scanned === next.files_scanned &&
        prev.lines_scanned === next.lines_scanned &&
        prev.updated_at === next.updated_at
    );
};

const isSameGitleaksTask = (
    prev: GitleaksScanTask | null,
    next: GitleaksScanTask,
) => {
    if (!prev) return false;
    return (
        prev.id === next.id &&
        prev.status === next.status &&
        prev.total_findings === next.total_findings &&
        prev.files_scanned === next.files_scanned &&
        prev.error_message === next.error_message &&
        prev.updated_at === next.updated_at
    );
};

const isSameOpengrepFindings = (
    prev: OpengrepFinding[],
    next: OpengrepFinding[],
) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
        const a = prev[i];
        const b = next[i];
        if (
            a.id !== b.id ||
            a.status !== b.status ||
            a.severity !== b.severity ||
            a.confidence !== b.confidence ||
            a.rule_name !== b.rule_name
        ) {
            return false;
        }
    }
    return true;
};

const isSameGitleaksFindings = (
    prev: GitleaksFinding[],
    next: GitleaksFinding[],
) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
        const a = prev[i];
        const b = next[i];
        if (a.id !== b.id || a.status !== b.status) {
            return false;
        }
    }
    return true;
};

const isSameOpengrepProgress = (
    prev: OpengrepScanProgress | null,
    next: OpengrepScanProgress,
) => {
    if (!prev) return false;
    return (
        prev.status === next.status &&
        prev.progress === next.progress &&
        prev.current_stage === next.current_stage &&
        prev.message === next.message &&
        prev.logs.length === next.logs.length &&
        prev.updated_at === next.updated_at
    );
};

export default function StaticAnalysis() {
    const { isEnglish } = useI18n();
    const { taskId } = useParams<{ taskId: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<"opengrep" | "gitleaks">(
        "opengrep",
    );

    const [opengrepTask, setOpengrepTask] =
        useState<OpengrepScanTask | null>(null);
    const [opengrepFindings, setOpengrepFindings] = useState<
        OpengrepFinding[]
    >([]);
    const [loadingOpengrepTask, setLoadingOpengrepTask] = useState(false);
    const [loadingOpengrepFindings, setLoadingOpengrepFindings] =
        useState(false);
    const [opengrepProgress, setOpengrepProgress] =
        useState<OpengrepScanProgress | null>(null);
    const [showProgressLogs, setShowProgressLogs] = useState(false);

    const [gitleaksTask, setGitleaksTask] =
        useState<GitleaksScanTask | null>(null);
    const [gitleaksFindings, setGitleaksFindings] = useState<
        GitleaksFinding[]
    >([]);
    const [loadingGitleaksTask, setLoadingGitleaksTask] = useState(false);
    const [loadingGitleaksFindings, setLoadingGitleaksFindings] =
        useState(false);

    const [severityFilter, setSeverityFilter] = useState<string>("");
    const [confidenceFilter, setConfidenceFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [gitleaksStatusFilter, setGitleaksStatusFilter] =
        useState<string>("open");
    const [updatingFindingId, setUpdatingFindingId] = useState<string | null>(
        null,
    );
    const [updatingGitleaksFindingId, setUpdatingGitleaksFindingId] =
        useState<string | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedFinding, setSelectedFinding] =
        useState<OpengrepFinding | null>(null);
    const [showInterruptConfirm, setShowInterruptConfirm] = useState(false);
    const [interruptingTask, setInterruptingTask] = useState(false);
    const [findingContext, setFindingContext] =
        useState<OpengrepFindingContext | null>(null);
    const [loadingFindingContext, setLoadingFindingContext] = useState(false);
    const lastOpengrepNotifiedStatusRef = useRef<string | null>(null);
    const lastGitleaksNotifiedStatusRef = useRef<string | null>(null);
    const opengrepSilentRefreshRef = useRef(false);
    const gitleaksSilentRefreshRef = useRef(false);

    const searchParams = useMemo(
        () => new URLSearchParams(location.search),
        [location.search],
    );

    const toolParam = searchParams.get("tool");
    const muteToast = searchParams.get("muteToast") === "1";
    const opengrepTaskId =
        searchParams.get("opengrepTaskId") ||
        (toolParam === "gitleaks" ? null : taskId || null);
    const gitleaksTaskId =
        searchParams.get("gitleaksTaskId") ||
        (toolParam === "gitleaks" ? taskId || null : null);
    const showOpengrepTab = Boolean(opengrepTaskId);
    const showGitleaksTab = Boolean(gitleaksTaskId);
    const enabledToolsLabel = useMemo(() => {
        const tools: string[] = [];
        if (showOpengrepTab) tools.push("Opengrep");
        if (showGitleaksTab) tools.push("Gitleaks");
        return tools.join(" / ");
    }, [showOpengrepTab, showGitleaksTab]);

    const taskStatusLabel = useMemo(
        () =>
            opengrepTask?.status
                ? STATUS_LABELS[opengrepTask.status] || opengrepTask.status
                : "未知",
        [opengrepTask?.status],
    );

    const gitleaksStatusLabel = useMemo(
        () =>
            gitleaksTask?.status
                ? STATUS_LABELS[gitleaksTask.status] || gitleaksTask.status
                : "未知",
        [gitleaksTask?.status],
    );

    const getSeverityLabel = (severity: string) => {
        const normalized = String(severity || "").toUpperCase();
        if (isEnglish) return normalized;
        if (normalized === "ERROR") return "严重";
        if (normalized === "WARNING") return "警告";
        if (normalized === "INFO") return "提示";
        return severity;
    };

    const getStatusLabel = (status: string) => {
        const normalized = String(status || "").toLowerCase();
        if (isEnglish) return normalized;
        if (normalized === "open") return "未处理";
        if (normalized === "verified") return "已验证";
        if (normalized === "false_positive") return "误报";
        if (normalized === "fixed") return "已修复";
        return status;
    };

    const getConfidenceLabel = (confidence: string) => {
        const normalized = parseConfidenceLevel(confidence);
        if (isEnglish) {
            if (normalized === "HIGH") return "High";
            if (normalized === "MEDIUM") return "Medium";
            if (normalized === "LOW") return "Low";
            return String(confidence || "");
        }
        if (normalized === "HIGH") return "高";
        if (normalized === "MEDIUM") return "中";
        if (normalized === "LOW") return "低";
        return String(confidence || "");
    };

    const loadOpengrepTask = async (options?: RefreshOptions) => {
        if (!opengrepTaskId) return;
        try {
            const data = await runWithRefreshMode(
                () => getOpengrepScanTask(opengrepTaskId),
                { ...options, setLoading: setLoadingOpengrepTask },
            );
            setOpengrepTask((prev) => (isSameOpengrepTask(prev, data) ? prev : data));
        } catch (error) {
            if (!options?.silent) {
                toast.error("加载 Opengrep 任务失败");
            }
        }
    };

    const loadOpengrepFindings = async (options?: RefreshOptions) => {
        if (!opengrepTaskId) return;
        try {
            const data = await runWithRefreshMode(
                async () => {
                    const allFindings: OpengrepFinding[] = [];
                    let skip = 0;
                    for (let page = 0; page < FINDINGS_MAX_PAGES; page += 1) {
                        const pageFindings = await getOpengrepScanFindings({
                            taskId: opengrepTaskId,
                            severity: severityFilter || undefined,
                            confidence: confidenceFilter || undefined,
                            status: statusFilter || undefined,
                            skip,
                            limit: FINDINGS_PAGE_SIZE,
                        });
                        allFindings.push(...pageFindings);
                        if (pageFindings.length < FINDINGS_PAGE_SIZE) break;
                        skip += FINDINGS_PAGE_SIZE;
                    }
                    return allFindings;
                },
                { ...options, setLoading: setLoadingOpengrepFindings },
            );
            setOpengrepFindings((prev) =>
                isSameOpengrepFindings(prev, data) ? prev : data,
            );
        } catch (error) {
            if (!options?.silent) {
                toast.error("加载 Opengrep 结果失败");
            }
        }
    };

    const loadOpengrepProgress = async (withLogs: boolean = showProgressLogs) => {
        if (!opengrepTaskId) return;
        try {
            const data = await getOpengrepScanProgress(opengrepTaskId, withLogs);
            setOpengrepProgress((prev) =>
                isSameOpengrepProgress(prev, data) ? prev : data,
            );
        } catch (error) {
            // 不阻塞主流程，静默失败
        }
    };

    const loadGitleaksTask = async (options?: RefreshOptions) => {
        if (!gitleaksTaskId) return;
        try {
            const data = await runWithRefreshMode(
                () => getGitleaksScanTask(gitleaksTaskId),
                { ...options, setLoading: setLoadingGitleaksTask },
            );
            setGitleaksTask((prev) => (isSameGitleaksTask(prev, data) ? prev : data));
        } catch (error) {
            if (!options?.silent) {
                toast.error("加载 Gitleaks 任务失败");
            }
        }
    };

    const loadGitleaksFindings = async (options?: RefreshOptions) => {
        if (!gitleaksTaskId) return;
        try {
            const data = await runWithRefreshMode(
                async () => {
                    const allFindings: GitleaksFinding[] = [];
                    let skip = 0;
                    for (let page = 0; page < FINDINGS_MAX_PAGES; page += 1) {
                        const pageFindings = await getGitleaksFindings({
                            taskId: gitleaksTaskId,
                            status: gitleaksStatusFilter || undefined,
                            skip,
                            limit: FINDINGS_PAGE_SIZE,
                        });
                        allFindings.push(...pageFindings);
                        if (pageFindings.length < FINDINGS_PAGE_SIZE) break;
                        skip += FINDINGS_PAGE_SIZE;
                    }
                    return allFindings;
                },
                { ...options, setLoading: setLoadingGitleaksFindings },
            );
            setGitleaksFindings((prev) =>
                isSameGitleaksFindings(prev, data) ? prev : data,
            );
        } catch (error) {
            if (!options?.silent) {
                toast.error("加载 Gitleaks 结果失败");
            }
        }
    };

    const refreshOpengrepSilently = async () => {
        if (opengrepSilentRefreshRef.current) return;
        opengrepSilentRefreshRef.current = true;
        try {
            await Promise.all([
                loadOpengrepTask({ silent: true }),
                loadOpengrepFindings({ silent: true }),
                loadOpengrepProgress(showProgressLogs),
            ]);
        } finally {
            opengrepSilentRefreshRef.current = false;
        }
    };

    const refreshGitleaksSilently = async () => {
        if (gitleaksSilentRefreshRef.current) return;
        gitleaksSilentRefreshRef.current = true;
        try {
            await Promise.all([
                loadGitleaksTask({ silent: true }),
                loadGitleaksFindings({ silent: true }),
            ]);
        } finally {
            gitleaksSilentRefreshRef.current = false;
        }
    };

    useEffect(() => {
        if (toolParam === "gitleaks" && showGitleaksTab) {
            setActiveTab("gitleaks");
            return;
        }
        if (showOpengrepTab) {
            setActiveTab("opengrep");
            return;
        }
        if (showGitleaksTab) {
            setActiveTab("gitleaks");
        }
    }, [toolParam, showOpengrepTab, showGitleaksTab]);

    useEffect(() => {
        loadOpengrepTask();
        loadOpengrepProgress(false);
    }, [opengrepTaskId]);

    useEffect(() => {
        loadOpengrepFindings();
    }, [opengrepTaskId, severityFilter, confidenceFilter, statusFilter]);

    useEffect(() => {
        loadGitleaksTask();
    }, [gitleaksTaskId]);

    useEffect(() => {
        loadGitleaksFindings();
    }, [gitleaksTaskId, gitleaksStatusFilter]);

    useEffect(() => {
        if (!opengrepTaskId) return;
        if (!opengrepTask || !["pending", "running"].includes(opengrepTask.status)) {
            return;
        }
        const timer = setInterval(() => {
            refreshOpengrepSilently();
        }, 5000);
        return () => clearInterval(timer);
    }, [opengrepTaskId, opengrepTask?.status, showProgressLogs]);

    useEffect(() => {
        if (!opengrepTaskId || !showProgressLogs) return;
        loadOpengrepProgress(true);
    }, [opengrepTaskId, showProgressLogs]);

    useEffect(() => {
        if (!gitleaksTaskId) return;
        if (!gitleaksTask || !["pending", "running"].includes(gitleaksTask.status)) {
            return;
        }
        const timer = setInterval(() => {
            refreshGitleaksSilently();
        }, 5000);
        return () => clearInterval(timer);
    }, [gitleaksTaskId, gitleaksTask?.status]);

    useEffect(() => {
        if (muteToast) return;
        if (!opengrepTask?.status) return;
        if (lastOpengrepNotifiedStatusRef.current === null) {
            lastOpengrepNotifiedStatusRef.current = opengrepTask.status;
            return;
        }
        if (lastOpengrepNotifiedStatusRef.current === opengrepTask.status) return;
        lastOpengrepNotifiedStatusRef.current = opengrepTask.status;

        if (opengrepTask.status === "pending") {
            void showToastQueue(
                [{ level: "info", message: "Opengrep 任务已创建，等待执行..." }],
                { durationMs: 2200 },
            );
            return;
        }

        if (opengrepTask.status === "running") {
            void showToastQueue(
                [{ level: "info", message: "Opengrep 扫描进行中，请稍候..." }],
                { durationMs: 2200 },
            );
            return;
        }

        if (opengrepTask.status === "completed") {
            const hasFindings = (opengrepTask.total_findings || 0) > 0;
            void showToastQueue(
                hasFindings
                    ? [
                          {
                              level: "success",
                              message: `Opengrep 完成，共发现 ${opengrepTask.total_findings} 条结果`,
                          },
                      ]
                    : [
                          {
                              level: "success",
                              message:
                                  "Opengrep 扫描完成，未发现规则命中（结果为 0 也视为成功）",
                          },
                      ],
                { durationMs: 2600 },
            );
            return;
        }

        if (opengrepTask.status === "failed") {
            void showToastQueue(
                [
                    {
                        level: "error",
                        message: "Opengrep 扫描失败：规则执行异常或规则配置错误",
                    },
                ],
                { durationMs: 2600 },
            );
            return;
        }

        if (opengrepTask.status === "interrupted") {
            void showToastQueue(
                [
                    {
                        level: "warning",
                        message: "Opengrep 扫描已中断：服务中止或沙箱停止",
                    },
                ],
                { durationMs: 2600 },
            );
        }
    }, [muteToast, opengrepTask?.status, opengrepTask?.total_findings]);

    useEffect(() => {
        if (muteToast) return;
        if (!gitleaksTask?.status) return;
        if (lastGitleaksNotifiedStatusRef.current === null) {
            lastGitleaksNotifiedStatusRef.current = gitleaksTask.status;
            return;
        }
        if (lastGitleaksNotifiedStatusRef.current === gitleaksTask.status) return;
        lastGitleaksNotifiedStatusRef.current = gitleaksTask.status;

        if (gitleaksTask.status === "pending") {
            void showToastQueue(
                [{ level: "info", message: "Gitleaks 任务已创建，等待执行..." }],
                { durationMs: 2200 },
            );
            return;
        }

        if (gitleaksTask.status === "running") {
            void showToastQueue(
                [{ level: "info", message: "Gitleaks 扫描进行中，请稍候..." }],
                { durationMs: 2200 },
            );
            return;
        }

        if (gitleaksTask.status === "completed") {
            const hasFindings = (gitleaksTask.total_findings || 0) > 0;
            void showToastQueue(
                hasFindings
                    ? [
                          {
                              level: "success",
                              message: `Gitleaks 完成，共发现 ${gitleaksTask.total_findings} 条结果`,
                          },
                      ]
                    : [
                          {
                              level: "success",
                              message:
                                  "Gitleaks 扫描完成，未发现密钥泄露（结果为 0 也视为成功）",
                          },
                      ],
                { durationMs: 2600 },
            );
            return;
        }

        if (gitleaksTask.status === "failed") {
            void showToastQueue(
                [
                    {
                        level: "error",
                        message: "Gitleaks 扫描失败：执行异常或配置错误",
                    },
                ],
                { durationMs: 2600 },
            );
            return;
        }

        if (gitleaksTask.status === "interrupted") {
            void showToastQueue(
                [
                    {
                        level: "warning",
                        message: "Gitleaks 扫描已中断：服务中止或沙箱停止",
                    },
                ],
                { durationMs: 2600 },
            );
        }
    }, [muteToast, gitleaksTask?.status, gitleaksTask?.total_findings]);

    const handleUpdateStatus = async (
        findingId: string,
        status: "open" | "verified" | "false_positive",
    ) => {
        setUpdatingFindingId(findingId);
        try {
            await updateOpengrepFindingStatus({ findingId, status });
            setOpengrepFindings((prev) => {
                if (statusFilter && statusFilter !== status) {
                    return prev.filter((item) => item.id !== findingId);
                }
                return prev.map((item) =>
                    item.id === findingId ? { ...item, status } : item,
                );
            });
            toast.success("状态已更新");
        } catch (error) {
            toast.error("更新状态失败");
        } finally {
            setUpdatingFindingId(null);
        }
    };

    const handleUpdateGitleaksStatus = async (
        findingId: string,
        status: "open" | "verified" | "false_positive" | "fixed",
    ) => {
        setUpdatingGitleaksFindingId(findingId);
        try {
            await updateGitleaksFindingStatus({ findingId, status });
            setGitleaksFindings((prev) => {
                if (gitleaksStatusFilter && gitleaksStatusFilter !== status) {
                    return prev.filter((item) => item.id !== findingId);
                }
                return prev.map((item) =>
                    item.id === findingId ? { ...item, status } : item,
                );
            });
            toast.success("状态已更新");
        } catch (error) {
            toast.error("更新状态失败");
        } finally {
            setUpdatingGitleaksFindingId(null);
        }
    };

    const resolveNextStatus = (
        currentStatus: string,
        targetStatus: "verified" | "false_positive",
    ) => {
        return currentStatus === targetStatus ? "open" : targetStatus;
    };

    const resolveNextGitleaksStatus = (
        currentStatus: string,
        targetStatus: "verified" | "false_positive" | "fixed",
    ) => {
        return currentStatus === targetStatus ? "open" : targetStatus;
    };

    const isInterruptibleStatus = (status?: string | null) =>
        status === "pending" || status === "running";

    const hasInterruptibleTask =
        isInterruptibleStatus(opengrepTask?.status) ||
        isInterruptibleStatus(gitleaksTask?.status);

    const loadFindingContext = async (finding: OpengrepFinding) => {
        if (!opengrepTaskId) return;
        setLoadingFindingContext(true);
        try {
            const context = await getOpengrepFindingContext({
                taskId: opengrepTaskId,
                findingId: finding.id,
                before: 5,
                after: 5,
            });
            setFindingContext(context);
        } catch (error) {
            setFindingContext(null);
        } finally {
            setLoadingFindingContext(false);
        }
    };

    const openDetail = (finding: OpengrepFinding) => {
        setSelectedFinding(finding);
        setFindingContext(null);
        setShowDetail(true);
        void loadFindingContext(finding);
    };

    const handleJumpToRule = (checkId: string, ruleName?: string | null) => {
        const currentRoute = `${location.pathname}${location.search}`;
        const fallbackKeyword =
            getCheckIdSuffix(checkId) || stripRuntimeRulePrefix(checkId);
        const highlightKeyword =
            stripRuntimeRulePrefix(ruleName) || fallbackKeyword;
        const query = new URLSearchParams();
        query.set("highlightRule", highlightKeyword);
        query.set("returnTo", currentRoute);
        navigate(`/opengrep-rules?${query.toString()}`);
    };

    const handleInterruptTasks = async () => {
        setInterruptingTask(true);
        try {
            const actions: Promise<unknown>[] = [];

            if (opengrepTaskId && isInterruptibleStatus(opengrepTask?.status)) {
                actions.push(interruptOpengrepScanTask(opengrepTaskId));
            }
            if (gitleaksTaskId && isInterruptibleStatus(gitleaksTask?.status)) {
                actions.push(interruptGitleaksScanTask(gitleaksTaskId));
            }

            if (actions.length === 0) {
                toast.info("当前没有可中止的运行中任务");
                setShowInterruptConfirm(false);
                return;
            }

            const results = await Promise.allSettled(actions);
            const successCount = results.filter((item) => item.status === "fulfilled").length;
            const failedCount = results.length - successCount;

            if (successCount > 0) {
                toast.success("已发送中止请求，任务状态正在更新");
            }
            if (failedCount > 0) {
                toast.error("部分任务中止失败，请稍后重试");
            }

            setShowInterruptConfirm(false);
            await Promise.all([
                loadOpengrepTask({ silent: true }),
                loadOpengrepFindings({ silent: true }),
                loadOpengrepProgress(showProgressLogs),
                loadGitleaksTask({ silent: true }),
                loadGitleaksFindings({ silent: true }),
            ]);
        } finally {
            setInterruptingTask(false);
        }
    };

    const activeTask = activeTab === "opengrep" ? opengrepTask : gitleaksTask;
    const activeTaskStatusLabel =
        activeTab === "opengrep" ? taskStatusLabel : gitleaksStatusLabel;
    const activeLoadingTask =
        activeTab === "opengrep" ? loadingOpengrepTask : loadingGitleaksTask;
    const activeLoadingFindings =
        activeTab === "opengrep"
            ? loadingOpengrepFindings
            : loadingGitleaksFindings;
    const opengrepProgressPercent = useMemo(() => {
        const rawProgress = opengrepProgress?.progress;
        if (typeof rawProgress === "number") {
            return Math.max(0, Math.min(100, rawProgress));
        }
        if (opengrepTask?.status === "completed") return 100;
        if (opengrepTask?.status === "failed") return 100;
        if (opengrepTask?.status === "interrupted") return 100;
        if (opengrepTask?.status === "running") return 10;
        return 0;
    }, [opengrepProgress?.progress, opengrepTask?.status]);
    const showOpengrepLoadingSkeleton =
        loadingOpengrepFindings && opengrepFindings.length === 0;
    const showGitleaksLoadingSkeleton =
        loadingGitleaksFindings && gitleaksFindings.length === 0;

    return (
        <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
            <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-foreground uppercase tracking-wider">
                                静态分析结果
                            </h1>
                            {enabledToolsLabel && (
                                <Badge className="cyber-badge-info">
                                    本次启用工具：{enabledToolsLabel}
                                </Badge>
                            )}
                        </div>
                        {activeTask && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge
                                    className={`cyber-badge ${STATUS_CLASSES[activeTask.status] || "bg-muted"}`}
                                >
                                    {activeTaskStatusLabel}
                                </Badge>
                                <span>任务：{activeTask.name}</span>
                                <span>·</span>
                                <span>文件：{activeTask.files_scanned}</span>
                                <span>·</span>
                                <span>发现：{activeTask.total_findings}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {hasInterruptibleTask && (
                            <Button
                                variant="outline"
                                className="cyber-btn-outline border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                                onClick={() => setShowInterruptConfirm(true)}
                                disabled={interruptingTask}
                            >
                                <Ban className="w-4 h-4 mr-2" />
                                中止
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className="cyber-btn-outline"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            返回
                        </Button>
                        <Button
                            variant="outline"
                            className="cyber-btn-ghost"
                            onClick={() => {
                                if (activeTab === "opengrep") {
                                    refreshOpengrepSilently();
                                } else {
                                    refreshGitleaksSilently();
                                }
                            }}
                            disabled={activeLoadingTask || activeLoadingFindings}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            刷新
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as "opengrep" | "gitleaks")}
                className="relative z-10"
            >
                {(showOpengrepTab || showGitleaksTab) && (
                    <TabsList className="mb-4">
                        {showOpengrepTab && (
                            <TabsTrigger value="opengrep">
                                Opengrep
                            </TabsTrigger>
                        )}
                        {showGitleaksTab && (
                            <TabsTrigger value="gitleaks">
                                Gitleaks
                            </TabsTrigger>
                        )}
                    </TabsList>
                )}

                <TabsContent value="opengrep">
                    {opengrepTask && (
                        <div className="cyber-card p-4 space-y-3 mb-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-mono text-foreground">
                                    扫描进度
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                    {Math.round(opengrepProgressPercent)}%
                                </div>
                            </div>
                            <Progress value={opengrepProgressPercent} className="h-2" />
                            <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
                                <span>
                                    {opengrepProgress?.message ||
                                        (opengrepTask.status === "running"
                                            ? "扫描进行中..."
                                            : `任务状态：${opengrepTask.status}`)}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => setShowProgressLogs((prev) => !prev)}
                                >
                                    {showProgressLogs ? "隐藏后端进度" : "查看后端进度"}
                                    {showProgressLogs ? (
                                        <ChevronUp className="w-3 h-3 ml-1" />
                                    ) : (
                                        <ChevronDown className="w-3 h-3 ml-1" />
                                    )}
                                </Button>
                            </div>
                            {showProgressLogs && (
                                <div className="bg-muted/40 border border-border rounded-md">
                                    <ScrollArea className="h-36">
                                        <div className="p-3 space-y-1 text-xs font-mono">
                                            {(opengrepProgress?.logs || []).length === 0 ? (
                                                <div className="text-muted-foreground">
                                                    暂无后端进度日志
                                                </div>
                                            ) : (
                                                (opengrepProgress?.logs || []).map((log, index) => (
                                                    <div key={`${log.timestamp}-${index}`} className="text-muted-foreground">
                                                        [{log.stage}] {log.message}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="cyber-card p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                                    严重程度
                                </label>
                                <Select
                                    value={severityFilter || "all"}
                                    onValueChange={(val) =>
                                        setSeverityFilter(
                                            val === "all" ? "" : val,
                                        )
                                    }
                                    disabled={!opengrepTaskId}
                                >
                                    <SelectTrigger className="cyber-input">
                                        <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent className="cyber-dialog border-border">
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="ERROR">
                                            {getSeverityLabel("ERROR")}
                                        </SelectItem>
                                        <SelectItem value="WARNING">
                                            {getSeverityLabel("WARNING")}
                                        </SelectItem>
                                        <SelectItem value="INFO">
                                            {getSeverityLabel("INFO")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                                    置信度
                                </label>
                                <Select
                                    value={confidenceFilter || "all"}
                                    onValueChange={(val) =>
                                        setConfidenceFilter(
                                            val === "all" ? "" : val,
                                        )
                                    }
                                    disabled={!opengrepTaskId}
                                >
                                    <SelectTrigger className="cyber-input">
                                        <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent className="cyber-dialog border-border">
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="HIGH">
                                            {getConfidenceLabel("HIGH")}
                                        </SelectItem>
                                        <SelectItem value="MEDIUM">
                                            {getConfidenceLabel("MEDIUM")}
                                        </SelectItem>
                                        <SelectItem value="LOW">
                                            {getConfidenceLabel("LOW")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                                    状态
                                </label>
                                <Select
                                    value={statusFilter || "all"}
                                    onValueChange={(val) =>
                                        setStatusFilter(
                                            val === "all" ? "" : val,
                                        )
                                    }
                                    disabled={!opengrepTaskId}
                                >
                                    <SelectTrigger className="cyber-input">
                                        <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent className="cyber-dialog border-border">
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="open">
                                            {getStatusLabel("open")}
                                        </SelectItem>
                                        <SelectItem value="verified">
                                            {getStatusLabel("verified")}
                                        </SelectItem>
                                        <SelectItem value="false_positive">
                                            {getStatusLabel("false_positive")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <div className="text-xs text-muted-foreground font-mono">
                                    {showOpengrepLoadingSkeleton
                                        ? "加载中..."
                                        : `共 ${opengrepFindings.length} 条结果`}
                                    {loadingOpengrepFindings &&
                                        opengrepFindings.length > 0 &&
                                        " · 后台更新中"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="cyber-card relative z-10 overflow-hidden mt-4">
                        {showOpengrepLoadingSkeleton ? (
                            <div className="p-16 text-center">
                                <div className="loading-spinner mx-auto mb-4" />
                                <p className="text-muted-foreground font-mono text-sm">
                                    加载 Opengrep 结果...
                                </p>
                            </div>
                        ) : opengrepFindings.length === 0 ? (
                            <div className="p-16 text-center">
                                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-foreground mb-2">
                                    暂无发现
                                </h3>
                                <p className="text-muted-foreground font-mono text-sm">
                                    {opengrepTask?.status === "running"
                                        ? "扫描进行中，请稍后刷新"
                                        : opengrepTask?.status === "completed"
                                          ? "扫描完成，未扫描到缺陷"
                                          : opengrepTask?.status ===
                                              "interrupted"
                                            ? "扫描已中断，请重新发起任务"
                                          : "暂无扫描结果"}
                                </p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[600px]">
                                <div className="divide-y divide-border">
                                    {opengrepFindings.map((finding) => {
                                        const meta = getRuleMeta(finding);
                                        const ruleDisplayId =
                                            getCheckIdSuffix(meta.checkId) || meta.checkId;
                                        const matchedRuleName = stripRuntimeRulePrefix(
                                            finding.rule_name,
                                        );
                                        const isVerified =
                                            finding.status === "verified";
                                        const isFalsePositive =
                                            finding.status === "false_positive";
                                        return (
                                            <div
                                                key={finding.id}
                                                className="p-4 space-y-3"
                                            >
                                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge
                                                            className={`cyber-badge ${SEVERITY_CLASSES[finding.severity] || "bg-muted"}`}
                                                        >
                                                            {getSeverityLabel(finding.severity)}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${FINDING_STATUS_CLASSES[finding.status] || "bg-muted"}`}
                                                        >
                                                            {getStatusLabel(finding.status)}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${isVerified ? VERIFICATION_BADGE_CLASSES.active : VERIFICATION_BADGE_CLASSES.inactive}`}
                                                        >
                                                            {isVerified
                                                                ? "已验证"
                                                                : "未验证"}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${isFalsePositive ? FALSE_POSITIVE_BADGE_CLASSES.active : FALSE_POSITIVE_BADGE_CLASSES.inactive}`}
                                                        >
                                                            {isFalsePositive
                                                                ? "误报"
                                                                : "非误报"}
                                                        </Badge>
                                                        {parseConfidenceLevel(
                                                            finding.confidence,
                                                        ) && (
                                                            <Badge className="cyber-badge-muted">
                                                                {isEnglish
                                                                    ? `CONF: ${getConfidenceLabel(finding.confidence || "")}`
                                                                    : `置信度: ${getConfidenceLabel(finding.confidence || "")}`}
                                                            </Badge>
                                                        )}
                                                        <span className="text-sm text-foreground font-bold">
                                                            {matchedRuleName || ruleDisplayId}
                                                        </span>
                                                        {matchedRuleName &&
                                                            matchedRuleName !== ruleDisplayId && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {ruleDisplayId}
                                                                </span>
                                                            )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-ghost h-7 text-xs"
                                                            onClick={() =>
                                                                openDetail(
                                                                    finding,
                                                                )
                                                            }
                                                        >
                                                            详情
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-outline h-7 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                                                            disabled={
                                                                updatingFindingId ===
                                                                finding.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdateStatus(
                                                                    finding.id,
                                                                    resolveNextStatus(
                                                                        finding.status,
                                                                        "verified",
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {finding.status ===
                                                            "verified"
                                                                ? "取消已验证"
                                                                : "标记已验证"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-outline h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                                            disabled={
                                                                updatingFindingId ===
                                                                finding.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdateStatus(
                                                                    finding.id,
                                                                    resolveNextStatus(
                                                                        finding.status,
                                                                        "false_positive",
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {finding.status ===
                                                            "false_positive"
                                                                ? "取消误报"
                                                                : "标记误报"}
                                                        </Button>
                                                        {updatingFindingId ===
                                                            finding.id && (
                                                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {normalizePath(meta.path)}
                                                    {meta.line
                                                        ? `:${meta.line}`
                                                        : ""}
                                                </div>

                                                {meta.message && (
                                                    <div className="text-sm text-foreground">
                                                        {meta.message}
                                                    </div>
                                                )}

                                                {meta.lines && (
                                                    <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded p-3 whitespace-pre-wrap break-words">
                                                        {meta.lines}
                                                    </pre>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </TabsContent>

                {showGitleaksTab && (
                    <TabsContent value="gitleaks">
                    <div className="cyber-card p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                                    状态
                                </label>
                                <Select
                                    value={gitleaksStatusFilter || "all"}
                                    onValueChange={(val) =>
                                        setGitleaksStatusFilter(
                                            val === "all" ? "" : val,
                                        )
                                    }
                                    disabled={!gitleaksTaskId}
                                >
                                    <SelectTrigger className="cyber-input">
                                        <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent className="cyber-dialog border-border">
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="open">
                                            {getStatusLabel("open")}
                                        </SelectItem>
                                        <SelectItem value="verified">
                                            {getStatusLabel("verified")}
                                        </SelectItem>
                                        <SelectItem value="false_positive">
                                            {getStatusLabel("false_positive")}
                                        </SelectItem>
                                        <SelectItem value="fixed">
                                            {getStatusLabel("fixed")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <div className="text-xs text-muted-foreground font-mono">
                                    {showGitleaksLoadingSkeleton
                                        ? "加载中..."
                                        : `共 ${gitleaksFindings.length} 条结果`}
                                    {loadingGitleaksFindings &&
                                        gitleaksFindings.length > 0 &&
                                        " · 后台更新中"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="cyber-card relative z-10 overflow-hidden mt-4">
                        {showGitleaksLoadingSkeleton ? (
                            <div className="p-16 text-center">
                                <div className="loading-spinner mx-auto mb-4" />
                                <p className="text-muted-foreground font-mono text-sm">
                                    加载 Gitleaks 结果...
                                </p>
                            </div>
                        ) : gitleaksFindings.length === 0 ? (
                            <div className="p-16 text-center">
                                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-foreground mb-2">
                                    暂无发现
                                </h3>
                                <p className="text-muted-foreground font-mono text-sm">
                                    {gitleaksTask?.status === "running"
                                        ? "扫描进行中，请稍后刷新"
                                        : gitleaksTask?.status === "completed"
                                          ? "扫描完成，未扫描到缺陷"
                                          : gitleaksTask?.status ===
                                              "interrupted"
                                            ? "扫描已中断，请重新发起任务"
                                          : "暂无扫描结果"}
                                </p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[600px]">
                                <div className="divide-y divide-border">
                                    {gitleaksFindings.map((finding) => {
                                        const isVerified =
                                            finding.status === "verified";
                                        const isFalsePositive =
                                            finding.status === "false_positive";
                                        const isFixed =
                                            finding.status === "fixed";
                                        return (
                                            <div
                                                key={finding.id}
                                                className="p-4 space-y-3"
                                            >
                                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge className="cyber-badge">
                                                            {finding.rule_id}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${GITLEAKS_STATUS_CLASSES[finding.status] || "bg-muted"}`}
                                                        >
                                                            {getStatusLabel(finding.status)}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${isVerified ? VERIFICATION_BADGE_CLASSES.active : VERIFICATION_BADGE_CLASSES.inactive}`}
                                                        >
                                                            {isVerified
                                                                ? "已验证"
                                                                : "未验证"}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${isFalsePositive ? FALSE_POSITIVE_BADGE_CLASSES.active : FALSE_POSITIVE_BADGE_CLASSES.inactive}`}
                                                        >
                                                            {isFalsePositive
                                                                ? "误报"
                                                                : "非误报"}
                                                        </Badge>
                                                        <Badge
                                                            className={`cyber-badge ${isFixed ? VERIFICATION_BADGE_CLASSES.active : VERIFICATION_BADGE_CLASSES.inactive}`}
                                                        >
                                                            {isFixed
                                                                ? "已修复"
                                                                : "未修复"}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-outline h-7 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                                                            disabled={
                                                                updatingGitleaksFindingId ===
                                                                finding.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdateGitleaksStatus(
                                                                    finding.id,
                                                                    resolveNextGitleaksStatus(
                                                                        finding.status,
                                                                        "verified",
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {finding.status ===
                                                            "verified"
                                                                ? "取消已验证"
                                                                : "标记已验证"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-outline h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                                            disabled={
                                                                updatingGitleaksFindingId ===
                                                                finding.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdateGitleaksStatus(
                                                                    finding.id,
                                                                    resolveNextGitleaksStatus(
                                                                        finding.status,
                                                                        "false_positive",
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {finding.status ===
                                                            "false_positive"
                                                                ? "取消误报"
                                                                : "标记误报"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="cyber-btn-outline h-7 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                                                            disabled={
                                                                updatingGitleaksFindingId ===
                                                                finding.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdateGitleaksStatus(
                                                                    finding.id,
                                                                    resolveNextGitleaksStatus(
                                                                        finding.status,
                                                                        "fixed",
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {finding.status ===
                                                            "fixed"
                                                                ? "取消已修复"
                                                                : "标记已修复"}
                                                        </Button>
                                                        {updatingGitleaksFindingId ===
                                                            finding.id && (
                                                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {normalizePath(
                                                        finding.file_path,
                                                    )}
                                                    {finding.start_line
                                                        ? `:${finding.start_line}`
                                                        : ""}
                                                </div>

                                                {finding.description && (
                                                    <div className="text-sm text-foreground">
                                                        {finding.description}
                                                    </div>
                                                )}

                                                {finding.secret && (
                                                    <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded p-3 whitespace-pre-wrap break-words">
                                                        {finding.secret}
                                                    </pre>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                    </TabsContent>
                )}
            </Tabs>

            <AlertDialog
                open={showInterruptConfirm}
                onOpenChange={(open) => {
                    if (!interruptingTask) {
                        setShowInterruptConfirm(open);
                    }
                }}
            >
                <AlertDialogContent className="cyber-dialog border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认中止扫描任务？</AlertDialogTitle>
                        <AlertDialogDescription>
                            中止后当前运行中的静态分析任务会被标记为“已中断”，已产生的结果会保留。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={interruptingTask}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void handleInterruptTasks();
                            }}
                            disabled={interruptingTask}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {interruptingTask ? "中止中..." : "确认中止"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={showDetail}
                onOpenChange={(open) => {
                    setShowDetail(open);
                    if (!open) {
                        setSelectedFinding(null);
                        setFindingContext(null);
                    }
                }}
            >
                <DialogContent className="!w-[min(90vw,980px)] !max-w-none max-h-[90vh] flex flex-col p-0 gap-0 cyber-dialog border border-border rounded-lg">
                    <DialogHeader className="px-6 pt-4 flex-shrink-0">
                        <DialogTitle className="font-mono text-lg uppercase tracking-wider flex items-center gap-2 text-foreground">
                            结果详情
                        </DialogTitle>
                    </DialogHeader>

                    {selectedFinding &&
                        (() => {
                            const meta = getRuleMeta(selectedFinding);
                            const isVerified =
                                selectedFinding.status === "verified";
                            const isFalsePositive =
                                selectedFinding.status === "false_positive";
                            const ruleDisplayId =
                                getCheckIdSuffix(meta.checkId) || meta.checkId;
                            const matchedRuleName = stripRuntimeRulePrefix(
                                selectedFinding.rule_name,
                            );
                            return (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                                className={`cyber-badge ${SEVERITY_CLASSES[selectedFinding.severity] || "bg-muted"}`}
                                            >
                                                {getSeverityLabel(selectedFinding.severity)}
                                            </Badge>
                                            <Badge
                                                className={`cyber-badge ${FINDING_STATUS_CLASSES[selectedFinding.status] || "bg-muted"}`}
                                            >
                                                {getStatusLabel(selectedFinding.status)}
                                            </Badge>
                                            <Badge
                                                className={`cyber-badge ${isVerified ? VERIFICATION_BADGE_CLASSES.active : VERIFICATION_BADGE_CLASSES.inactive}`}
                                            >
                                                {isVerified
                                                    ? "已验证"
                                                    : "未验证"}
                                            </Badge>
                                            <Badge
                                                className={`cyber-badge ${isFalsePositive ? FALSE_POSITIVE_BADGE_CLASSES.active : FALSE_POSITIVE_BADGE_CLASSES.inactive}`}
                                            >
                                                {isFalsePositive
                                                    ? "误报"
                                                    : "非误报"}
                                            </Badge>
                                            {parseConfidenceLevel(
                                                selectedFinding.confidence,
                                            ) && (
                                                <Badge className="cyber-badge-muted">
                                                    {isEnglish
                                                        ? `CONF: ${getConfidenceLabel(selectedFinding.confidence || "")}`
                                                        : `置信度: ${getConfidenceLabel(selectedFinding.confidence || "")}`}
                                                </Badge>
                                            )}
                                            <span className="text-sm text-foreground font-bold">
                                                {matchedRuleName || ruleDisplayId}
                                            </span>
                                            {matchedRuleName &&
                                                matchedRuleName !== ruleDisplayId && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {ruleDisplayId}
                                                    </span>
                                                )}
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="font-mono font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">
                                                基本信息
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono text-muted-foreground">
                                                <div>
                                                    <div className="uppercase text-[10px] text-muted-foreground mb-1">
                                                        文件路径
                                                    </div>
                                                    <div className="text-foreground break-all">
                                                        {normalizePath(
                                                            meta.path,
                                                        )}
                                                        {meta.line
                                                            ? `:${meta.line}`
                                                            : ""}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="uppercase text-[10px] text-muted-foreground mb-1">
                                                        命中规则
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-foreground break-all">
                                                            {matchedRuleName || ruleDisplayId}
                                                        </span>
                                                        {matchedRuleName &&
                                                            matchedRuleName !==
                                                                ruleDisplayId && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    ({ruleDisplayId})
                                                                </span>
                                                            )}
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-[10px] cyber-btn-outline"
                                                            onClick={() =>
                                                                handleJumpToRule(
                                                                    meta.checkId,
                                                                    selectedFinding.rule_name,
                                                                )
                                                            }
                                                        >
                                                            查看规则
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="uppercase text-[10px] text-muted-foreground mb-1">
                                                        验证状态
                                                    </div>
                                                    <div className="text-foreground">
                                                        {meta.validationState ||
                                                            "-"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {meta.message && (
                                            <div className="space-y-3">
                                                <h3 className="font-mono font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">
                                                    规则描述
                                                </h3>
                                                <div className="text-sm text-foreground">
                                                    {meta.message}
                                                </div>
                                            </div>
                                        )}

                                        {(loadingFindingContext ||
                                            findingContext?.lines?.length ||
                                            meta.lines ||
                                            selectedFinding.code_snippet) && (
                                            <div className="space-y-3">
                                                <h3 className="font-mono font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">
                                                    代码片段
                                                </h3>
                                                {loadingFindingContext ? (
                                                    <div className="text-xs text-muted-foreground font-mono bg-muted border border-border rounded p-3">
                                                        正在加载上下文...
                                                    </div>
                                                ) : findingContext?.lines &&
                                                  findingContext.lines.length >
                                                      0 ? (
                                                    <div className="bg-muted border border-border rounded overflow-hidden">
                                                        <div className="max-h-[380px] overflow-auto">
                                                            {findingContext.lines.map(
                                                                (line) => (
                                                                    <div
                                                                        key={
                                                                            line.line_number
                                                                        }
                                                                        className={`grid grid-cols-[56px_1fr] text-xs font-mono border-b border-border/60 last:border-b-0 ${
                                                                            line.is_hit
                                                                                ? "bg-sky-500/15"
                                                                                : ""
                                                                        }`}
                                                                    >
                                                                        <div className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/60 select-none">
                                                                            {
                                                                                line.line_number
                                                                            }
                                                                        </div>
                                                                        <div className="px-3 py-1.5 text-foreground whitespace-pre-wrap break-words">
                                                                            {line.content ||
                                                                                " "}
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded p-3 whitespace-pre-wrap break-words">
                                                        {meta.lines ||
                                                            selectedFinding.code_snippet}
                                                    </pre>
                                                )}
                                            </div>
                                        )}

                                        {meta.references.length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="font-mono font-bold uppercase text-sm text-muted-foreground border-b border-border pb-2">
                                                    参考链接
                                                </h3>
                                                <ul className="text-xs text-muted-foreground font-mono list-disc list-inside space-y-1">
                                                    {meta.references.map(
                                                        (ref: string) => (
                                                            <li
                                                                key={ref}
                                                                className="break-all"
                                                            >
                                                                {ref}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
