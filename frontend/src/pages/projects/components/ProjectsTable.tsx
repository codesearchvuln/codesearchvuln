import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ProjectsPageRowViewModel } from "../types";
import { PROJECT_ACTION_BTN_SUBTLE } from "../constants";

interface ProjectsTableProps {
	rows: ProjectsPageRowViewModel[];
	onCreateScan: (projectId: string) => void;
}

const EXECUTION_COLUMNS = [
	{
		key: "completed",
		label: "已完成",
		cellClassName: "text-center",
		chipClassName:
			"border-emerald-500/35 bg-emerald-500/12 text-emerald-200 shadow-[inset_0_1px_0_rgba(52,211,153,0.18)]",
	},
	{
		key: "running",
		label: "进行中",
		cellClassName: "text-center",
		chipClassName:
			"border-sky-500/35 bg-sky-500/12 text-sky-200 shadow-[inset_0_1px_0_rgba(56,189,248,0.18)]",
	},
] as const;

const VULNERABILITY_COLUMNS = [
	{
		key: "critical",
		label: "严重",
		cellClassName: "text-center",
		chipClassName:
			"border-rose-500/35 bg-rose-500/12 text-rose-200 shadow-[inset_0_1px_0_rgba(251,113,133,0.18)]",
	},
	{
		key: "high",
		label: "高危",
		cellClassName: "text-center",
		chipClassName:
			"border-amber-500/35 bg-amber-500/12 text-amber-200 shadow-[inset_0_1px_0_rgba(251,191,36,0.18)]",
	},
	{
		key: "medium",
		label: "中危",
		cellClassName: "text-center",
		chipClassName:
			"border-sky-500/35 bg-sky-500/12 text-sky-200 shadow-[inset_0_1px_0_rgba(56,189,248,0.18)]",
	},
	{
		key: "low",
		label: "低危",
		cellClassName: "text-center",
		chipClassName:
			"border-emerald-500/35 bg-emerald-500/12 text-emerald-200 shadow-[inset_0_1px_0_rgba(52,211,153,0.18)]",
	},
] as const;

const METRIC_CHIP_CLASSNAME =
	"inline-block min-w-[2ch] text-center leading-none";
const METRIC_CHIP_VALUE_CLASSNAME =
	"text-center font-semibold tabular-nums text-[18px]";
const HEADER_CELL_CLASSNAME =
	"border-b border-border/60 bg-muted/75 text-center font-mono text-[15px] font-semibold uppercase tracking-[0.18em] text-foreground/80";
const SUBHEADER_CELL_CLASSNAME =
	"border-b border-border/85 bg-muted/40 text-center font-mono text-[14px] font-medium tracking-[0.14em] text-muted-foreground";
const BODY_CELL_CLASSNAME = "border-b border-border/85";
const DIVIDER_CELL_CLASSNAME = "border-r border-border/75";
const SECTION_DIVIDER_CLASSNAME = "border-l border-border/85";

export default function ProjectsTable({
	rows,
	onCreateScan,
}: ProjectsTableProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="border-b border-border/60">
					<TableHead className={`${HEADER_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} min-w-[176px]`} rowSpan={2}>
						项目名称
					</TableHead>
					<TableHead className={`${HEADER_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} min-w-[132px]`} rowSpan={2}>
						项目大小
					</TableHead>
					<TableHead className={`${HEADER_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} text-center`} colSpan={2}>
						执行任务
					</TableHead>
					<TableHead className={`${HEADER_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} text-center`} colSpan={4}>
						发现漏洞
					</TableHead>
					<TableHead className={`${HEADER_CELL_CLASSNAME} ${SECTION_DIVIDER_CLASSNAME} min-w-[320px]`} rowSpan={2}>
						操作
					</TableHead>
				</TableRow>
				<TableRow className="border-b border-border/60">
					{EXECUTION_COLUMNS.map((column) => (
						<TableHead
							key={`header-${column.key}`}
							className={`${SUBHEADER_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME}`}
						>
							{column.label}
						</TableHead>
					))}
					{VULNERABILITY_COLUMNS.map((column, index) => (
						<TableHead
							key={`header-${column.key}`}
							className={`${SUBHEADER_CELL_CLASSNAME} ${
								index === VULNERABILITY_COLUMNS.length - 1 ? "" : DIVIDER_CELL_CLASSNAME
							}`}
						>
							{column.label}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id} className="border-b border-border/60">
						<TableCell className={`${BODY_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} text-center`}>
							<Link
								to={row.detailPath}
								state={row.detailState}
								title={row.name}
								className="mx-auto block max-w-[180px] truncate text-center text-[18px] font-semibold text-foreground transition-colors hover:text-primary"
							>
								{row.name}
							</Link>
						</TableCell>
						<TableCell className={`${BODY_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} text-center text-[17px] text-muted-foreground`}>
							<span title={row.metricsStatusMessage ?? undefined}>
								{row.sizeText}
							</span>
						</TableCell>
						{EXECUTION_COLUMNS.map((column) => (
							<TableCell
								key={`${row.id}-${column.key}`}
								className={`${BODY_CELL_CLASSNAME} ${DIVIDER_CELL_CLASSNAME} ${column.cellClassName}`}
							>
								<span
									data-project-metric-chip={column.key}
									className={METRIC_CHIP_CLASSNAME}
									title={row.metricsStatus !== "ready"
										? row.metricsStatusMessage ?? undefined
										: undefined}
								>
									<span className={METRIC_CHIP_VALUE_CLASSNAME}>
										{row.executionStats[column.key]}
									</span>
								</span>
							</TableCell>
						))}
						{VULNERABILITY_COLUMNS.map((column, index) => (
							<TableCell
								key={`${row.id}-${column.key}`}
								className={`${BODY_CELL_CLASSNAME} ${
									index === VULNERABILITY_COLUMNS.length - 1 ? "" : DIVIDER_CELL_CLASSNAME
								} ${column.cellClassName}`}
							>
								<span
									data-project-metric-chip={column.key}
									className={METRIC_CHIP_CLASSNAME}
									title={row.metricsStatus !== "ready"
										? row.metricsStatusMessage ?? undefined
										: undefined}
								>
									<span className={METRIC_CHIP_VALUE_CLASSNAME}>
										{row.vulnerabilityStats[column.key]}
									</span>
								</span>
							</TableCell>
						))}
						<TableCell className={`${BODY_CELL_CLASSNAME} ${SECTION_DIVIDER_CLASSNAME} text-center`}>
							<div className="flex items-center justify-center gap-2 whitespace-nowrap text-[16px]">
								<Button
									asChild
									size="sm"
									variant="outline"
									className="cyber-btn-ghost h-8 px-3"
								>
									<Link to={row.detailPath} state={row.detailState}>
										查看详情
									</Link>
								</Button>
								{row.actions.canBrowseCode ? (
									<Button
										asChild
										size="sm"
										variant="outline"
										className="cyber-btn-ghost h-8 px-3 hover:bg-sky-500/10 hover:text-sky-200 hover:border-sky-500/30"
									>
										<Link
											to={row.actions.browseCodePath}
											state={row.actions.browseCodeState}
										>
											代码浏览
										</Link>
									</Button>
								) : (
									<Button
										size="sm"
										variant="outline"
										className="cyber-btn-ghost h-8 px-3"
										disabled
										title={row.actions.browseCodeDisabledReason ?? undefined}
										aria-label={`代码浏览 ${row.name}（${row.actions.browseCodeDisabledReason ?? "暂不可用"}）`}
									>
										代码浏览
									</Button>
								)}
								<Button
									size="sm"
									className={`${PROJECT_ACTION_BTN_SUBTLE} h-8 px-3`}
									onClick={() => onCreateScan(row.id)}
									disabled={!row.actions.canCreateScan}
								>
									创建扫描
								</Button>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
