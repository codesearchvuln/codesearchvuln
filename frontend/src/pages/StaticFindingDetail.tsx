import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    getOpengrepScanFinding,
    getOpengrepScanTask,
    type OpengrepFinding,
    type OpengrepScanTask,
} from "@/shared/api/opengrep";

const FINDING_STATUS_LABELS: Record<string, string> = {
    open: "待处理",
    verified: "已验证",
    false_positive: "误报",
};

const FINDING_STATUS_CLASSES: Record<string, string> = {
    open: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    verified: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    false_positive: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const SEVERITY_CLASSES: Record<string, string> = {
    ERROR: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    WARNING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    INFO: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

function normalizeConfidence(
    confidence?: string | null,
): "HIGH" | "MEDIUM" | "LOW" | null {
    const normalized = String(confidence || "").trim().toUpperCase();
    if (normalized === "HIGH") return "HIGH";
    if (normalized === "MEDIUM") return "MEDIUM";
    if (normalized === "LOW") return "LOW";
    return null;
}

function normalizeReturnToPath(rawValue: string | null): string {
    const value = String(rawValue || "").trim();
    if (!value.startsWith("/")) return "";
    if (value.startsWith("//")) return "";
    return value;
}

function getErrorMessage(error: unknown): string {
    const apiError = error as {
        response?: { data?: { detail?: string } };
        message?: string;
    };
    return String(
        apiError?.response?.data?.detail ||
            apiError?.message ||
            "漏洞详情加载失败",
    );
}

export default function StaticFindingDetail() {
    const { taskId, findingId } = useParams<{ taskId: string; findingId: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const [task, setTask] = useState<OpengrepScanTask | null>(null);
    const [finding, setFinding] = useState<OpengrepFinding | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const searchParams = useMemo(
        () => new URLSearchParams(location.search),
        [location.search],
    );
    const returnTo = normalizeReturnToPath(searchParams.get("returnTo"));

    useEffect(() => {
        let cancelled = false;

        async function loadFindingDetail() {
            if (!taskId || !findingId) {
                setError("漏洞不存在");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");

            try {
                const [taskData, findingData] = await Promise.all([
                    getOpengrepScanTask(taskId),
                    getOpengrepScanFinding({ taskId, findingId }),
                ]);
                if (cancelled) return;
                setTask(taskData);
                setFinding(findingData);
            } catch (loadError) {
                if (cancelled) return;
                setError(getErrorMessage(loadError));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadFindingDetail();

        return () => {
            cancelled = true;
        };
    }, [taskId, findingId]);

    const meta = useMemo(() => {
        const rule = ((finding?.rule || {}) as Record<string, unknown>) || {};
        const extra =
            typeof rule.extra === "object" && rule.extra
                ? (rule.extra as Record<string, unknown>)
                : {};
        const metadata =
            typeof extra.metadata === "object" && extra.metadata
                ? (extra.metadata as Record<string, unknown>)
                : {};
        const references = Array.isArray(metadata.references)
            ? metadata.references.filter((item) => typeof item === "string")
            : [];
        const checkId = String(rule.check_id || rule.id || "").trim();
        const message = String(extra.message || finding?.description || "").trim();
        const lines = String(extra.lines || finding?.code_snippet || "").trim();
        return { checkId, message, lines, references };
    }, [finding]);

    const displayRuleName = String(
        finding?.rule_name || meta.checkId || "unknown-rule",
    ).trim();
    const confidence = normalizeConfidence(finding?.confidence);
    const fileLocation = `${finding?.file_path || "-"}${
        finding?.start_line ? `:${finding.start_line}` : ""
    }`;
    const cweList = finding?.cwe || [];

    const handleBack = () => {
        if (returnTo) {
            navigate(returnTo);
            return;
        }
        navigate(-1);
    };

    const handleViewTask = () => {
        if (!taskId) return;
        navigate(`/static-analysis/${taskId}?opengrepTaskId=${taskId}`);
    };

    return (
        <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
            <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground uppercase tracking-wider">
                        静态漏洞详情
                    </h1>
                    {task && (
                        <p className="text-xs text-muted-foreground">
                            任务：{task.name} ({task.id})
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="cyber-btn-outline"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                    <Button
                        variant="outline"
                        className="cyber-btn-outline"
                        onClick={handleViewTask}
                        disabled={!taskId}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        查看所属扫描任务
                    </Button>
                </div>
            </div>

            <div className="relative z-10 cyber-card p-5 space-y-5">
                {loading ? (
                    <p className="text-sm text-muted-foreground">漏洞详情加载中...</p>
                ) : error ? (
                    <p className="text-sm text-rose-400">{error}</p>
                ) : finding ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                className={`cyber-badge ${
                                    SEVERITY_CLASSES[finding.severity] || "bg-muted"
                                }`}
                            >
                                严重级别：{finding.severity}
                            </Badge>
                            <Badge
                                className={`cyber-badge ${
                                    FINDING_STATUS_CLASSES[finding.status] || "bg-muted"
                                }`}
                            >
                                状态：
                                {FINDING_STATUS_LABELS[finding.status] ||
                                    finding.status}
                            </Badge>
                            {confidence && (
                                <Badge className="cyber-badge-muted">
                                    置信度：{confidence}
                                </Badge>
                            )}
                            <span className="text-sm text-foreground break-all">
                                规则：{displayRuleName}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                                <p className="uppercase text-muted-foreground">
                                    文件位置
                                </p>
                                <p className="text-foreground break-all">
                                    {fileLocation}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="uppercase text-muted-foreground">
                                    CWE
                                </p>
                                <p className="text-foreground break-all">
                                    {cweList.length > 0 ? cweList.join(", ") : "-"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="uppercase text-xs text-muted-foreground">
                                描述
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                {meta.message || "-"}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <p className="uppercase text-xs text-muted-foreground">
                                代码片段
                            </p>
                            <pre className="text-xs text-foreground bg-muted border border-border rounded p-3 whitespace-pre-wrap break-words">
                                {meta.lines || "-"}
                            </pre>
                        </div>

                        <div className="space-y-2">
                            <p className="uppercase text-xs text-muted-foreground">
                                参考链接
                            </p>
                            {meta.references.length > 0 ? (
                                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                    {meta.references.map((reference) => (
                                        <li key={reference} className="break-all">
                                            <a
                                                href={reference}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sky-300 hover:underline"
                                            >
                                                {reference}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-foreground">-</p>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-rose-400">漏洞不存在</p>
                )}
            </div>
        </div>
    );
}
