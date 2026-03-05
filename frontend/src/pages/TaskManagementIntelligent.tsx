import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Plus } from "lucide-react";
import { toast } from "sonner";

import DeferredSection from "@/components/performance/DeferredSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskActivitiesListTable from "@/features/tasks/components/TaskActivitiesListTable";
import { useTaskActivitiesSnapshot } from "@/features/tasks/hooks/useTaskActivitiesSnapshot";
import { useTaskClock } from "@/features/tasks/hooks/useTaskClock";
import { filterIntelligentActivities } from "@/features/tasks/services/taskActivities";

const CreateProjectAuditDialog = lazy(
	() => import("@/components/audit/CreateProjectAuditDialog"),
);

export default function TaskManagementIntelligent() {
	const { activities, loading, error, refresh } = useTaskActivitiesSnapshot();
	const [keyword, setKeyword] = useState("");
	const [showCreateIntelligentDialog, setShowCreateIntelligentDialog] =
		useState(false);
	const errorRef = useRef<string | null>(null);

	useEffect(() => {
		if (!error || activities.length > 0 || errorRef.current === error) {
			return;
		}
		errorRef.current = error;
		console.error("加载智能任务失败:", error);
		toast.error("加载智能任务失败");
	}, [activities.length, error]);

	const shouldTickClock = useMemo(
		() =>
			activities.some(
				(activity) =>
					activity.status === "running" || activity.status === "pending",
			),
		[activities],
	);
	const nowMs = useTaskClock({ enabled: shouldTickClock, intervalMs: 5000 });

	const filteredActivities = useMemo(
		() => filterIntelligentActivities(activities, keyword),
		[activities, keyword],
	);
	const intelligentActivities = useMemo(
		() => filterIntelligentActivities(activities, ""),
		[activities],
	);

	const stats = useMemo(() => {
		return intelligentActivities.reduce(
			(acc, activity) => {
				acc.total += 1;
				if (activity.status === "completed") {
					acc.completed += 1;
				}
				if (activity.status === "running" || activity.status === "pending") {
					acc.running += 1;
				}
				return acc;
			},
			{ total: 0, completed: 0, running: 0 },
		);
	}, [intelligentActivities]);

	return (
		<div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
				<div className="cyber-card p-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="stat-label">智能扫描任务</p>
							<p className="stat-value">{stats.total}</p>
						</div>
						<div className="stat-icon text-primary">
							<Activity className="w-6 h-6" />
						</div>
					</div>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">已完成</p>
					<p className="stat-value text-emerald-400">{stats.completed}</p>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">进行中</p>
					<p className="stat-value text-sky-400">{stats.running}</p>
				</div>
			</div>

			<div className="cyber-card p-4 relative z-10">
				<div className="flex items-center justify-between gap-3">
					<div className="section-header">
						<Bot className="w-5 h-5 text-primary" />
						<h3 className="section-title">智能扫描</h3>
					</div>
					<div className="flex items-center gap-3">
						<Button
							size="sm"
							className="cyber-btn-primary h-8 px-3"
							onClick={() => setShowCreateIntelligentDialog(true)}
						>
							<Plus className="w-3.5 h-3.5 mr-1.5" />
							新建扫描任务
						</Button>
						<span className="text-xs text-muted-foreground">
							共 {filteredActivities.length} 条
						</span>
					</div>
				</div>

				<div className="space-y-3 mb-3 mt-3">
					<Input
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder="按项目名/任务类型/状态搜索"
						className="h-9 font-mono"
					/>
					<div className="text-xs text-muted-foreground">
						仅展示显式标记为 [INTELLIGENT] 的智能扫描任务
					</div>
				</div>

				<DeferredSection minHeight={480} priority>
					<TaskActivitiesListTable
						activities={filteredActivities}
						loading={loading}
						nowMs={nowMs}
						emptyText="暂无智能扫描任务"
					/>
				</DeferredSection>
			</div>

			{showCreateIntelligentDialog ? (
				<Suspense fallback={null}>
					<CreateProjectAuditDialog
						open={showCreateIntelligentDialog}
						onOpenChange={setShowCreateIntelligentDialog}
						onTaskCreated={() => {
							void refresh();
						}}
						initialMode="agent"
						lockMode
						allowUploadProject
						primaryCreateLabel="创建智能扫描任务"
					/>
				</Suspense>
			) : null}
		</div>
	);
}
