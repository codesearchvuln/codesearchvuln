import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/shared/config/database";
import type { Project } from "@/shared/types";
import {
  fetchTaskActivities,
  filterActivitiesByKind,
  formatCreatedAt,
  getActivityDurationLabel,
  getRelativeTime,
  getTaskStatusBadgeClassName,
  getTaskStatusClassName,
  getTaskStatusText,
  type TaskActivityItem,
} from "@/features/tasks/services/taskActivities";

const PAGE_SIZE = 10;

export default function TaskManagementStatic() {
  const [activities, setActivities] = useState<TaskActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const projects: Project[] = await api.getProjects();
      const allActivities = await fetchTaskActivities(projects);
      setActivities(allActivities);
    } catch (error) {
      console.error("加载静态任务失败:", error);
      toast.error("加载静态任务失败");
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = useMemo(
    () => filterActivitiesByKind(activities, "rule_scan", keyword),
    [activities, keyword],
  );

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, page]);

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      <div className="cyber-card p-4 relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="section-header">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="section-title">静态扫描任务</h3>
          </div>
          <span className="text-xs text-muted-foreground">共 {filteredActivities.length} 条</span>
        </div>

        <div className="space-y-3 mb-3 mt-3">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按项目名/任务类型/状态搜索"
            className="h-9 font-mono"
          />
          <div className="text-xs text-muted-foreground">仅展示 rule_scan（opengrep，保留 gitleaks 配对信息）</div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="empty-state py-8">
              <p className="text-base text-muted-foreground">加载中...</p>
            </div>
          ) : pagedActivities.length > 0 ? (
            pagedActivities.map((activity) => {
              void nowTick;
              return (
                <Link
                  key={activity.id}
                  to={activity.route}
                  className={`block p-3 rounded-lg border transition-all ${getTaskStatusClassName(activity.status)}`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="text-base font-medium text-foreground">
                      {activity.projectName}-静态扫描
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Gitleaks扫描：{activity.gitleaksEnabled ? "已启用" : "未启用"}
                    </span>
                    <Badge className={getTaskStatusBadgeClassName(activity.status)}>
                      漏洞扫描状态：{getTaskStatusText(activity.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground/80">
                      创建时间：{formatCreatedAt(activity.createdAt)}（
                      {getRelativeTime(activity.createdAt)}）
                    </span>
                    <span className="text-sm text-muted-foreground/80 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getActivityDurationLabel(activity)}
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="empty-state py-8">
              <p className="text-base text-muted-foreground">暂无静态扫描任务</p>
            </div>
          )}
        </div>

        {filteredActivities.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页（每页 {PAGE_SIZE} 条）
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cyber-btn-outline h-8 px-3"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cyber-btn-outline h-8 px-3"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
