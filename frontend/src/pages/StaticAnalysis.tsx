import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  getOpengrepScanFindings,
  getOpengrepScanTask,
  type OpengrepFinding,
  type OpengrepScanTask,
} from "@/shared/api/opengrep";
import { AlertCircle, ArrowLeft, RefreshCw, Shield } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  running: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

const SEVERITY_CLASSES: Record<string, string> = {
  ERROR: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  WARNING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  INFO: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

export default function StaticAnalysis() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<OpengrepScanTask | null>(null);
  const [findings, setFindings] = useState<OpengrepFinding[]>([]);
  const [loadingTask, setLoadingTask] = useState(false);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const taskStatusLabel = useMemo(
    () => (task?.status ? STATUS_LABELS[task.status] || task.status : "未知"),
    [task?.status]
  );

  const loadTask = async () => {
    if (!taskId) return;
    setLoadingTask(true);
    try {
      const data = await getOpengrepScanTask(taskId);
      setTask(data);
    } catch (error) {
      toast.error("加载静态分析任务失败");
    } finally {
      setLoadingTask(false);
    }
  };

  const loadFindings = async () => {
    if (!taskId) return;
    setLoadingFindings(true);
    try {
      const data = await getOpengrepScanFindings({
        taskId,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        limit: 200,
      });
      setFindings(data);
    } catch (error) {
      toast.error("加载静态分析结果失败");
    } finally {
      setLoadingFindings(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  useEffect(() => {
    loadFindings();
  }, [taskId, severityFilter, statusFilter]);

  useEffect(() => {
    if (!taskId) return;
    if (!task || !["pending", "running"].includes(task.status)) return;
    const timer = setInterval(() => {
      loadTask();
      loadFindings();
    }, 5000);
    return () => clearInterval(timer);
  }, [taskId, task?.status]);

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground uppercase tracking-wider">
                静态分析结果
              </h1>
            </div>
            {task && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge className={`cyber-badge ${STATUS_CLASSES[task.status] || "bg-muted"}`}>
                  {taskStatusLabel}
                </Badge>
                <span>任务：{task.name}</span>
                <span>·</span>
                <span>文件：{task.files_scanned}</span>
                <span>·</span>
                <span>发现：{task.total_findings}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
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
                loadTask();
                loadFindings();
              }}
              disabled={loadingTask || loadingFindings}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        <div className="cyber-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                严重程度
              </label>
              <Select value={severityFilter || "all"} onValueChange={(val) => setSeverityFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="cyber-input">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                  <SelectItem value="WARNING">WARNING</SelectItem>
                  <SelectItem value="INFO">INFO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-muted-foreground mb-1 uppercase">
                状态
              </label>
              <Select value={statusFilter || "all"} onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="cyber-input">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="open">open</SelectItem>
                  <SelectItem value="verified">verified</SelectItem>
                  <SelectItem value="false_positive">false_positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-xs text-muted-foreground font-mono">
                {loadingFindings ? "加载中..." : `共 ${findings.length} 条结果`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cyber-card relative z-10 overflow-hidden">
        {loadingFindings ? (
          <div className="p-16 text-center">
            <div className="loading-spinner mx-auto mb-4" />
            <p className="text-muted-foreground font-mono text-sm">加载静态分析结果...</p>
          </div>
        ) : findings.length === 0 ? (
          <div className="p-16 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">暂无发现</h3>
            <p className="text-muted-foreground font-mono text-sm">
              {task?.status === "running" ? "扫描进行中，请稍后刷新" : "未检测到问题"}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {findings.map((finding) => (
                <div key={finding.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`cyber-badge ${SEVERITY_CLASSES[finding.severity] || "bg-muted"}`}>
                      {finding.severity}
                    </Badge>
                    <Badge className="cyber-badge-muted">{finding.status}</Badge>
                    <span className="text-sm text-foreground font-bold">
                      {finding.rule?.id || "unknown-rule"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {finding.file_path}
                    {finding.start_line ? `:${finding.start_line}` : ""}
                  </div>
                  {finding.description && (
                    <div className="text-sm text-foreground">
                      {finding.description}
                    </div>
                  )}
                  {finding.code_snippet && (
                    <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded p-3 whitespace-pre-wrap break-words">
                      {finding.code_snippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
