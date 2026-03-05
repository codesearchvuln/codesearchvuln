import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bot, Layers, Shield } from "lucide-react";
import { toast } from "sonner";

import DeferredSection from "@/components/performance/DeferredSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskActivitiesListTable from "@/features/tasks/components/TaskActivitiesListTable";
import { useTaskActivitiesSnapshot } from "@/features/tasks/hooks/useTaskActivitiesSnapshot";
import { useTaskClock } from "@/features/tasks/hooks/useTaskClock";
import {
	filterMixedActivities,
	summarizeTaskActivities,
} from "@/features/tasks/services/taskActivities";

export default function TaskManagementOverview() {
	const { projects, activities, loading, error } = useTaskActivitiesSnapshot();
	const [keyword, setKeyword] = useState("");
	const errorRef = useRef<string | null>(null);

	useEffect(() => {
		if (!error || activities.length > 0 || errorRef.current === error) {
			return;
		}
		errorRef.current = error;
		console.error("加载任务概览失败:", error);
		toast.error("加载任务概览失败");
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
		() => filterMixedActivities(activities, keyword),
		[activities, keyword],
	);

	const summary = useMemo(() => summarizeTaskActivities(activities), [activities]);

	return (
		<div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
				<div className="cyber-card p-4">
					<p className="stat-label">静态扫描任务</p>
					<p className="stat-value">{summary.staticTotal}</p>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">智能扫描任务</p>
					<p className="stat-value">{summary.intelligentTotal}</p>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">混合扫描任务</p>
					<p className="stat-value">{summary.hybridTotal}</p>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">运行中</p>
					<p className="stat-value text-sky-400">{summary.running}</p>
				</div>
				<div className="cyber-card p-4">
					<p className="stat-label">已完成</p>
					<p className="stat-value text-emerald-400">{summary.completed}</p>
				</div>
			</div>

			<div className="cyber-card p-4 relative z-10">
				<div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
					<div className="inline-flex items-center gap-2 shrink-0">
						<Layers className="w-5 h-5 text-primary" />
						<h3 className="section-title">任务分类导航</h3>
					</div>
					<div className="flex items-center gap-2 flex-wrap ml-auto">
						<Link to="/tasks/static" className="inline-flex">
							<Button className="h-9 px-3 cyber-btn-outline gap-2">
								<Shield className="w-4 h-4" />
								<span>静态扫描</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</Link>
						<Link to="/tasks/intelligent" className="inline-flex">
							<Button className="h-9 px-3 cyber-btn-outline gap-2">
								<Bot className="w-4 h-4" />
								<span>智能扫描</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</Link>
						<Link to="/tasks/hybrid" className="inline-flex">
							<Button className="h-9 px-3 cyber-btn-outline gap-2">
								<Layers className="w-4 h-4" />
								<span>混合扫描</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</Link>
					</div>
				</div>
			</div>

			<div className="cyber-card p-4 relative z-10">
				<div className="flex items-center justify-between gap-3">
					<div className="section-header">
						<Activity className="w-5 h-5 text-amber-400" />
						<h3 className="section-title">最近任务</h3>
					</div>
					<span className="text-xs text-muted-foreground">
						项目数：{projects.length} · 任务数：{filteredActivities.length}
					</span>
				</div>

				<div className="space-y-3 mb-3 mt-3">
					<Input
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder="按项目名/任务类型/状态搜索"
						className="h-9 font-mono"
					/>
				</div>

				<DeferredSection minHeight={480} priority>
					<TaskActivitiesListTable
						activities={filteredActivities}
						loading={loading}
						nowMs={nowMs}
						emptyText="暂无任务"
					/>
				</DeferredSection>
			</div>
		</div>
	);
}
