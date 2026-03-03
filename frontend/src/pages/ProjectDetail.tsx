/**
 * Project Detail Page
 * Cyberpunk Terminal Aesthetic
 */

import { useMemo, useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Shield,
    Activity,
    AlertTriangle,
    CheckCircle,
    Clock,
    XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/shared/config/database";
import type { Project, AuditTask, UnifiedTask } from "@/shared/types";
import type { AgentTask } from "@/shared/api/agentTasks";
import { getAgentTasks } from "@/shared/api/agentTasks";
import {
    getOpengrepScanTasks,
    type OpengrepScanTask,
} from "@/shared/api/opengrep";
import {
    getGitleaksScanTasks,
    type GitleaksScanTask,
} from "@/shared/api/gitleaks";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { ProjectTasksTab } from "@/pages/project-detail/components/ProjectTasksTab";

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [auditTasks, setAuditTasks] = useState<AuditTask[]>([]);
    const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
    const [staticTasks, setStaticTasks] = useState<OpengrepScanTask[]>([]);
    const [gitleaksTasks, setGitleaksTasks] = useState<GitleaksScanTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

    const fallbackBackPath = "/projects#project-browser";
    const sourceFromState =
        typeof (location.state as { from?: unknown } | null)?.from === "string"
            ? ((location.state as { from?: string }).from ?? "")
            : "";
    const normalizedSourceFrom =
        sourceFromState.startsWith("/") ? sourceFromState : "";
    const backTarget =
        normalizedSourceFrom && normalizedSourceFrom !== location.pathname
            ? normalizedSourceFrom
            : fallbackBackPath;

    const handleBack = () => {
        navigate(backTarget);
    };

    useEffect(() => {
        if (!id) return;
        void loadProjectData();
    }, [id]);

    const loadProjectData = async () => {
        if (!id) return;

        try {
            setLoading(true);
            const [
                projectRes,
                auditTasksRes,
                agentTasksRes,
                staticTasksRes,
                gitleaksTasksRes,
            ] = await Promise.allSettled([
                api.getProjectById(id),
                api.getAuditTasks(id),
                getAgentTasks({ project_id: id }),
                getOpengrepScanTasks({ projectId: id }),
                getGitleaksScanTasks({ projectId: id }),
            ]);

            if (projectRes.status === "fulfilled") {
                setProject(projectRes.value);
            } else {
                console.error("Failed to load project:", projectRes.reason);
                setProject(null);
            }

            if (auditTasksRes.status === "fulfilled") {
                setAuditTasks(
                    Array.isArray(auditTasksRes.value) ? auditTasksRes.value : [],
                );
            } else {
                console.error("Failed to load audit tasks:", auditTasksRes.reason);
                setAuditTasks([]);
            }

            if (agentTasksRes.status === "fulfilled") {
                setAgentTasks(
                    Array.isArray(agentTasksRes.value) ? agentTasksRes.value : [],
                );
            } else {
                console.warn("Failed to load agent tasks:", agentTasksRes.reason);
                setAgentTasks([]);
            }

            if (staticTasksRes.status === "fulfilled") {
                setStaticTasks(
                    Array.isArray(staticTasksRes.value) ? staticTasksRes.value : [],
                );
            } else {
                console.warn("Failed to load static tasks:", staticTasksRes.reason);
                setStaticTasks([]);
            }

            if (gitleaksTasksRes.status === "fulfilled") {
                setGitleaksTasks(
                    Array.isArray(gitleaksTasksRes.value) ? gitleaksTasksRes.value : [],
                );
            } else {
                console.warn(
                    "Failed to load gitleaks tasks:",
                    gitleaksTasksRes.reason,
                );
                setGitleaksTasks([]);
            }
        } catch (error) {
            console.error("Failed to load project data:", error);
            toast.error("加载项目数据失败");
        } finally {
            setLoading(false);
        }
    };

    const unifiedTasks: UnifiedTask[] = useMemo(() => {
        const merged: UnifiedTask[] = [
            ...auditTasks.map((task) => ({ kind: "audit" as const, task })),
            ...agentTasks.map((task) => ({ kind: "agent" as const, task })),
            ...staticTasks.map((task) => ({ kind: "static" as const, task })),
        ];

        merged.sort(
            (a, b) =>
                new Date((b.task as any).created_at).getTime() -
                new Date((a.task as any).created_at).getTime(),
        );
        return merged;
    }, [auditTasks, agentTasks, staticTasks]);

    const staticTaskRouteMap = useMemo(() => {
        const map = new Map<string, string>();
        const gitleaksByProject = new Map<string, GitleaksScanTask[]>();

        for (const task of gitleaksTasks) {
            const list = gitleaksByProject.get(task.project_id) || [];
            list.push(task);
            gitleaksByProject.set(task.project_id, list);
        }

        for (const [projectId, list] of gitleaksByProject.entries()) {
            list.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime(),
            );
            gitleaksByProject.set(projectId, list);
        }

        const usedGitleaksTaskIds = new Set<string>();
        const pairingWindowMs = 60 * 1000;

        const pickPairedGitleaksTask = (opengrepTask: OpengrepScanTask) => {
            const candidates =
                gitleaksByProject.get(opengrepTask.project_id) || [];
            if (candidates.length === 0) return null;

            const opengrepTime = new Date(opengrepTask.created_at).getTime();
            let bestTask: GitleaksScanTask | null = null;
            let bestDiff = Number.POSITIVE_INFINITY;

            for (const candidate of candidates) {
                if (usedGitleaksTaskIds.has(candidate.id)) continue;
                const diff = Math.abs(
                    new Date(candidate.created_at).getTime() - opengrepTime,
                );
                if (diff <= pairingWindowMs && diff < bestDiff) {
                    bestTask = candidate;
                    bestDiff = diff;
                }
            }

            if (bestTask) {
                usedGitleaksTaskIds.add(bestTask.id);
            }

            return bestTask;
        };

        for (const task of staticTasks) {
            const params = new URLSearchParams();
            params.set("opengrepTaskId", task.id);
            const pairedGitleaksTask = pickPairedGitleaksTask(task);
            if (pairedGitleaksTask) {
                params.set("gitleaksTaskId", pairedGitleaksTask.id);
            }
            map.set(task.id, `/static-analysis/${task.id}?${params.toString()}`);
        }

        return map;
    }, [staticTasks, gitleaksTasks]);

    const getTaskDetailRoute = (wrappedTask: UnifiedTask) => {
        const task: any = wrappedTask.task as any;
        if (wrappedTask.kind === "static") {
            return (
                staticTaskRouteMap.get(task.id) || `/static-analysis/${task.id}`
            );
        }
        if (wrappedTask.kind === "audit") {
            return `/tasks/${task.id}`;
        }
        return `/agent-audit/${task.id}`;
    };

    const handleRunAudit = () => {
        setShowCreateTaskDialog(true);
    };

    const handleCreateTask = () => {
        setShowCreateTaskDialog(true);
    };

    const handleTaskCreated = () => {
        toast.success("审计任务已创建", {
            description:
                "因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...",
            duration: 5000,
        });
        void loadProjectData();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <Badge className="cyber-badge-success">完成</Badge>;
            case "running":
                return <Badge className="cyber-badge-info">运行中</Badge>;
            case "failed":
                return <Badge className="cyber-badge-danger">失败</Badge>;
            case "interrupted":
                return (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                        中断
                    </Badge>
                );
            case "cancelled":
                return <Badge className="cyber-badge-muted">已取消</Badge>;
            default:
                return <Badge className="cyber-badge-muted">等待中</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "completed":
                return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case "running":
                return <Activity className="w-4 h-4 text-sky-400" />;
            case "failed":
                return <AlertTriangle className="w-4 h-4 text-rose-400" />;
            case "interrupted":
                return <AlertTriangle className="w-4 h-4 text-orange-400" />;
            case "cancelled":
                return <XCircle className="w-4 h-4 text-muted-foreground" />;
            default:
                return <Clock className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <div className="loading-spinner mx-auto" />
                    <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
                        加载项目数据...
                    </p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="cyber-card p-8 text-center">
                    <AlertTriangle className="w-16 h-16 text-rose-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-foreground mb-2 uppercase">
                        项目未找到
                    </h2>
                    <p className="text-muted-foreground mb-4 font-mono">
                        请检查项目ID是否正确
                    </p>
                    <Button className="cyber-btn-primary" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 cyber-bg-elevated min-h-screen font-mono relative">
            <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground uppercase tracking-wider">
                        {project.name}
                    </h1>
                    <Badge
                        className={`${project.is_active ? "cyber-badge-success" : "cyber-badge-muted"}`}
                    >
                        {project.is_active ? "活跃" : "暂停"}
                    </Badge>
                </div>

                <div className="flex items-center space-x-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="cyber-btn-ghost h-10 px-3 flex items-center justify-center gap-2"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        返回
                    </Button>
                    <Button onClick={handleRunAudit} className="cyber-btn-primary">
                        <Shield className="w-4 h-4 mr-2" />
                        启动审计
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-6 mt-6 relative z-10">
                <ProjectTasksTab
                    unifiedTasks={unifiedTasks}
                    onCreateTask={handleCreateTask}
                    formatDate={formatDate}
                    renderStatusBadge={getStatusBadge}
                    renderStatusIcon={getStatusIcon}
                    getTaskRoute={getTaskDetailRoute}
                />
            </div>

            <CreateTaskDialog
                open={showCreateTaskDialog}
                onOpenChange={setShowCreateTaskDialog}
                onTaskCreated={handleTaskCreated}
                preselectedProjectId={id}
            />
        </div>
    );
}
