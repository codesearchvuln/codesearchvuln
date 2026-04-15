import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type {
	AppColumnDef,
	DataTableQueryState,
} from "@/components/data-table";
import {
	formatCreatedAt,
	getActivityDurationLabel,
	getRelativeTime,
	getTaskProgressPercent,
	getTaskStatusBadgeClassName,
	getTaskStatusText,
	type TaskActivityItem,
} from "@/features/tasks/services/taskActivities";
import { appendReturnTo } from "@/shared/utils/findingRoute";

interface TaskActivitiesListTableProps {
	activities: TaskActivityItem[];
	loading?: boolean;
	nowMs: number;
	emptyText?: string;
	pageSize?: number;
	onDeleteActivity?: (activity: TaskActivityItem) => Promise<void>;
}

function getDefectSummaryLabel(activity: TaskActivityItem): string {
	if (activity.agentFindingStats) {
		const { critical, high, medium, low } = activity.agentFindingStats;
		return `严重 ${critical} / 高危 ${high} / 中危 ${medium} / 低危 ${low}`;
	}
	if (!activity.staticFindingStats) {
		return "-";
	}
	const { critical, high, medium, low } = activity.staticFindingStats;
	return `严重 ${critical} / 高危 ${high} / 中危 ${medium} / 低危 ${low}`;
}

function getColumns(
	nowMs: number,
	currentRoute: string,
	handleDelete: ((activity: TaskActivityItem) => Promise<void>) | null,
	deletingActivityId: string | null,
): AppColumnDef<TaskActivityItem, unknown>[] {
	return [
		{
			id: "rowNumber",
			header: "序号",
			enableSorting: false,
			meta: {
				label: "序号",
				align: "center",
				width: 80,
			},
			cell: ({ row, table }) => {
				const pageRowIndex = table
					.getRowModel()
					.rows.findIndex((r) => r.id === row.id);
				return (
					table.getState().pagination.pageIndex *
						table.getState().pagination.pageSize +
					pageRowIndex +
					1
				);
			},
		},
		{
			accessorKey: "projectName",
			header: "项目",
			meta: {
				label: "项目",
				minWidth: 160,
				filterVariant: "text",
			},
			cell: ({ row }) => (
				<span className="font-medium text-foreground">
					{row.original.projectName}
				</span>
			),
		},
		{
			id: "createdAt",
			accessorFn: (row) => row.createdAt,
			header: "创建时间",
			sortingFn: "datetime",
			meta: {
				label: "创建时间",
				minWidth: 180,
			},
			cell: ({ row }) => (
				<div className="text-base text-muted-foreground">
					<div>
						{formatCreatedAt(row.original.createdAt)}{" "}
						{getRelativeTime(row.original.createdAt, nowMs)}
					</div>
				</div>
			),
		},
		{
			id: "duration",
			accessorFn: (row) => getActivityDurationLabel(row, nowMs),
			header: "用时",
			meta: {
				label: "用时",
				width: 120,
			},
			cell: ({ row }) => {
				const rawDuration = getActivityDurationLabel(row.original, nowMs);
				const durationText = rawDuration
					.replace("用时：", "")
					.replace("已运行：", "");
				return (
					<span className="font-mono text-foreground">{durationText}</span>
				);
			},
		},
		{
			accessorKey: "status",
			header: "状态",
			meta: {
				label: "状态",
				minWidth: 170,
				filterVariant: "select",
				filterOptions: [
					{ label: "等待中", value: "pending" },
					{ label: "运行中", value: "running" },
					{ label: "已完成", value: "completed" },
					{ label: "失败", value: "failed" },
				],
			},
			cell: ({ row }) => {
				const status = String(row.original.status || "")
					.trim()
					.toLowerCase();
				const progress = getTaskProgressPercent(row.original, nowMs);

				return (
					<div className="flex items-center">
						<Badge
							className={`${getTaskStatusBadgeClassName(
								row.original.status,
							)} max-w-full gap-2 px-2.5`}
						>
							<span>{getTaskStatusText(row.original.status)}</span>
							{status === "running" ? (
								<span className="rounded-[2px] border border-current/20 bg-black/10 px-1.5 py-0.5 text-[13px] leading-none tracking-normal">
									{progress}%
								</span>
							) : null}
						</Badge>
					</div>
				);
			},
		},
		{
			id: "defects",
			accessorFn: (row) => getDefectSummaryLabel(row),
			header: "缺陷摘要",
			meta: {
				label: "缺陷摘要",
				minWidth: 200,
			},
			cell: ({ row }) => {
				const summary = getDefectSummaryLabel(row.original);
				if (summary === "-") return "-";
				return (
					<span className="whitespace-nowrap text-base text-muted-foreground">
						{summary}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "操作",
			enableSorting: false,
			meta: {
				label: "操作",
				width: 196,
				minWidth: 196,
			},
			cell: ({ row }) => {
				const isDeleting = deletingActivityId === row.original.id;
				return (
					<div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
						<Button
							asChild
							size="sm"
							variant="outline"
							className="cyber-btn-ghost h-8 shrink-0 whitespace-nowrap px-3"
						>
							<Link to={appendReturnTo(row.original.route, currentRoute)}>
								详情
							</Link>
						</Button>
						<Button
							size="sm"
							variant="destructive"
							className="h-8 shrink-0 whitespace-nowrap px-3"
							disabled={!handleDelete || isDeleting}
							onClick={() => {
								if (!handleDelete) return;
								void handleDelete(row.original);
							}}
						>
							{isDeleting ? "删除中..." : "删除任务"}
						</Button>
					</div>
				);
			},
		},
	];
}

export default function TaskActivitiesListTable({
	activities,
	loading = false,
	nowMs,
	emptyText = "暂无任务",
	pageSize = 10,
	onDeleteActivity,
}: TaskActivitiesListTableProps) {
	const location = useLocation();
	const currentRoute = `${location.pathname}${location.search}`;
	const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

	const handleDelete =
		onDeleteActivity == null
			? null
			: async (activity: TaskActivityItem) => {
					const confirmed = window.confirm(
						`确认删除任务「${activity.projectName} / ${getTaskStatusText(
							activity.status,
						)}」吗？`,
					);
					if (!confirmed) return;
					setDeletingActivityId(activity.id);
					try {
						await onDeleteActivity(activity);
						toast.success("任务已删除");
					} catch (error) {
						console.error("Failed to delete task:", error);
						toast.error("删除任务失败");
					} finally {
						setDeletingActivityId((current) =>
							current === activity.id ? null : current,
						);
					}
			  };

	const columns = useMemo<ColumnDef<TaskActivityItem>[]>(
		() =>
			getColumns(
				nowMs,
				currentRoute,
				handleDelete,
				deletingActivityId,
			),
		[currentRoute, deletingActivityId, handleDelete, nowMs],
	);

	const defaultState = useMemo<Partial<DataTableQueryState>>(
		() => ({
			pagination: {
				pageIndex: 0,
				pageSize,
			},
		}),
		[pageSize],
	);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3">
			<div className="min-h-0 flex-1 [&_[data-slot=table-container]]:h-full">
				<DataTable
					data={activities}
					columns={columns}
					loading={loading && activities.length === 0}
					defaultState={defaultState}
					emptyState={{
						title: emptyText,
					}}
					toolbar={{
						showGlobalSearch: false,
						showColumnVisibility: false,
						showDensityToggle: false,
						showReset: false,
						filters: [],
					}}
					pagination={{
						enabled: true,
						pageSizeOptions: [10, 20, 50],
						infoLabel: () => `共 ${activities.length} 条`,
					}}
					tableClassName="min-w-[880px]"
				/>
			</div>
		</div>
	);
}
