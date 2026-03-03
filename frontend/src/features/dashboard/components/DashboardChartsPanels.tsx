import { useMemo } from "react";
import { Activity, AlertTriangle, Bug } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type {
	ProjectScanRunsChartItem,
	ProjectVulnsChartItem,
} from "@/features/dashboard/services/projectScanStats";

type RuleLanguageChartItem = {
	language: string;
	total: number;
	highCount: number;
	mediumCount: number;
};

type RuleCweChartItem = {
	cwe: string;
	total: number;
};

interface DashboardChartsPanelsProps {
	rulesByLanguageData: RuleLanguageChartItem[];
	rulesByCweData: RuleCweChartItem[];
	projectScanRunsData: ProjectScanRunsChartItem[];
	projectVulnsData: ProjectVulnsChartItem[];
	translate: (key: string, fallback?: string) => string;
}

const formatTick = (value: number | string) =>
	Number(value || 0).toLocaleString();

export default function DashboardChartsPanels({
	rulesByLanguageData,
	rulesByCweData,
	projectScanRunsData,
	projectVulnsData,
	translate,
}: DashboardChartsPanelsProps) {
	const chartMax = useMemo(() => {
		if (rulesByLanguageData.length === 0) return 1;
		const maxSide = Math.max(...rulesByLanguageData.map((item) => item.total));
		return Math.max(1, maxSide);
	}, [rulesByLanguageData]);

	const cweChartMax = useMemo(() => {
		if (rulesByCweData.length === 0) return 1;
		const maxSide = Math.max(...rulesByCweData.map((item) => item.total));
		return Math.max(1, maxSide);
	}, [rulesByCweData]);

	const rulesChartHeight = useMemo(() => {
		const rowCount = Math.max(1, rulesByLanguageData.length);
		return Math.min(520, Math.max(280, rowCount * 36));
	}, [rulesByLanguageData.length]);

	const cweChartHeight = useMemo(() => {
		const rowCount = Math.max(1, rulesByCweData.length);
		return Math.min(520, Math.max(280, rowCount * 36));
	}, [rulesByCweData.length]);

	const projectScanRunsChartMax = useMemo(() => {
		if (projectScanRunsData.length === 0) return 1;
		const maxValue = Math.max(...projectScanRunsData.map((item) => item.totalRuns));
		return Math.max(1, maxValue);
	}, [projectScanRunsData]);

	const projectVulnsChartMax = useMemo(() => {
		if (projectVulnsData.length === 0) return 1;
		const maxValue = Math.max(...projectVulnsData.map((item) => item.totalVulns));
		return Math.max(1, maxValue);
	}, [projectVulnsData]);

	const projectScanRunsChartHeight = useMemo(() => {
		const rowCount = Math.max(1, projectScanRunsData.length);
		return Math.min(520, Math.max(280, rowCount * 36));
	}, [projectScanRunsData.length]);

	const projectVulnsChartHeight = useMemo(() => {
		const rowCount = Math.max(1, projectVulnsData.length);
		return Math.min(520, Math.max(280, rowCount * 36));
	}, [projectVulnsData.length]);

	const renderProjectVulnsTooltip = (payload: {
		active?: boolean;
		payload?: Array<{ payload?: ProjectVulnsChartItem }>;
	}) => {
		if (
			!payload?.active ||
			!Array.isArray(payload.payload) ||
			payload.payload.length === 0
		) {
			return null;
		}
		const row = payload.payload[0]?.payload as ProjectVulnsChartItem | undefined;
		if (!row) return null;

		return (
			<div className="rounded border border-border bg-background/95 px-3 py-2 text-xs shadow-xl">
				<p className="font-semibold text-foreground">{row.projectName}</p>
				<p className="text-muted-foreground mt-1">
					{translate("dashboard.totalVulns")}：
					{formatTick(row.totalVulns)}
				</p>
				<div className="mt-1 space-y-0.5">
					<p className="text-sky-300">
						{translate("dashboard.staticScan")}：
						{formatTick(row.staticVulns)}
					</p>
					<p className="text-emerald-300">
						{translate("dashboard.intelligentScan")}：
						{formatTick(row.intelligentVulns)}
					</p>
					<p className="text-violet-300">
						{translate("dashboard.hybridScan")}：
						{formatTick(row.hybridVulns)}
					</p>
				</div>
			</div>
		);
	};

	return (
		<>
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 relative z-10">
				<div className="cyber-card p-4">
					<div className="section-header mb-3">
						<AlertTriangle className="w-5 h-5 text-sky-400" />
						<div className="w-full">
							<div className="flex items-center justify-between gap-3 flex-wrap">
								<h3 className="section-title">规则分布横向条形统计图</h3>
								<span className="text-sm text-muted-foreground">
									语言数：{rulesByLanguageData.length}
								</span>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								仅统计严重且中/高置信度规则
							</p>
						</div>
					</div>

					<div
						className="mt-4 border border-border/60 rounded-lg bg-muted/15 p-3"
						style={{ height: rulesChartHeight }}
					>
						{rulesByLanguageData.length === 0 ? (
							<div className="h-full flex items-center justify-center text-base text-muted-foreground">
								暂无符合条件的规则分布数据
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={rulesByLanguageData}
									layout="vertical"
									margin={{ top: 6, right: 6, left: 4, bottom: 6 }}
									barCategoryGap={16}
									barGap={6}
									barSize={18}
								>
									<CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
									<XAxis
										type="number"
										domain={[0, chartMax]}
										tickFormatter={formatTick}
										tick={{ fontSize: 13 }}
									/>
									<YAxis
										type="category"
										dataKey="language"
										width={96}
										tick={{ fontSize: 13 }}
									/>
									<Tooltip
										formatter={(value: number | string, name: string) => [
											Number(value || 0).toLocaleString(),
											name,
										]}
										contentStyle={{ fontSize: 13 }}
									/>
									<Legend wrapperStyle={{ fontSize: 13 }} />
									<Bar
										dataKey="highCount"
										stackId="confidence"
										fill="#22c55e"
										name="高置信度"
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
									<Bar
										stackId="confidence"
										dataKey="mediumCount"
										fill="#facc15"
										name="中置信度"
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				<div className="cyber-card p-4">
					<div className="section-header mb-3">
						<Bug className="w-5 h-5 text-violet-400" />
						<div className="w-full">
							<div className="flex items-center justify-between gap-3 flex-wrap">
								<h3 className="section-title">规则漏洞类型统计图（CWE分类）</h3>
								<span className="text-sm text-muted-foreground">
									类型数：{rulesByCweData.length}
								</span>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								统计严重规则关联的 CWE 类型（Top 20）
							</p>
						</div>
					</div>

					<div
						className="mt-4 border border-border/60 rounded-lg bg-muted/15 p-3"
						style={{ height: cweChartHeight }}
					>
						{rulesByCweData.length === 0 ? (
							<div className="h-full flex items-center justify-center text-base text-muted-foreground">
								暂无 CWE 分类统计数据
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={rulesByCweData}
									layout="vertical"
									margin={{ top: 6, right: 6, left: 4, bottom: 6 }}
									barCategoryGap={16}
									barGap={6}
									barSize={18}
								>
									<CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
									<XAxis
										type="number"
										domain={[0, cweChartMax]}
										tickFormatter={formatTick}
										tick={{ fontSize: 13 }}
									/>
									<YAxis
										type="category"
										dataKey="cwe"
										width={96}
										tick={{ fontSize: 13 }}
									/>
									<Tooltip
										formatter={(value: number | string, name: string) => [
											Number(value || 0).toLocaleString(),
											name,
										]}
										contentStyle={{ fontSize: 13 }}
									/>
									<Bar
										dataKey="total"
										fill="#a78bfa"
										name="规则数量"
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 relative z-10">
				<div className="cyber-card p-4">
					<div className="section-header mb-3">
						<Activity className="w-5 h-5 text-emerald-400" />
						<div className="w-full">
							<div className="flex items-center justify-between gap-3 flex-wrap">
								<h3 className="section-title">
									{translate("dashboard.projectScanRunsChartTitle")}
								</h3>
								<span className="text-sm text-muted-foreground">
									项目数：{projectScanRunsData.length}
								</span>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								{translate("dashboard.projectScanRunsChartSubtitle")}（Top 10）
							</p>
						</div>
					</div>

					<div
						className="mt-4 border border-border/60 rounded-lg bg-muted/15 p-3"
						style={{ height: projectScanRunsChartHeight }}
					>
						{projectScanRunsData.length === 0 ? (
							<div className="h-full flex items-center justify-center text-base text-muted-foreground">
								{translate("dashboard.noProjectScanRunsData")}
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={projectScanRunsData}
									layout="vertical"
									margin={{ top: 6, right: 6, left: 4, bottom: 6 }}
									barCategoryGap={16}
									barGap={6}
									barSize={18}
								>
									<CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
									<XAxis
										type="number"
										domain={[0, projectScanRunsChartMax]}
										tickFormatter={formatTick}
										tick={{ fontSize: 13 }}
									/>
									<YAxis
										type="category"
										dataKey="projectName"
										width={108}
										tick={{ fontSize: 13 }}
									/>
									<Tooltip
										formatter={(value: number | string, name: string) => [
											Number(value || 0).toLocaleString(),
											name,
										]}
										contentStyle={{ fontSize: 13 }}
									/>
									<Legend wrapperStyle={{ fontSize: 13 }} />
									<Bar
										dataKey="staticRuns"
										stackId="runs"
										fill="#38bdf8"
										name={translate("dashboard.staticScan")}
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
									<Bar
										dataKey="intelligentRuns"
										stackId="runs"
										fill="#34d399"
										name={translate("dashboard.intelligentScan")}
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
									<Bar
										dataKey="hybridRuns"
										stackId="runs"
										fill="#a78bfa"
										name={translate("dashboard.hybridScan")}
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				<div className="cyber-card p-4">
					<div className="section-header mb-3">
						<Bug className="w-5 h-5 text-amber-400" />
						<div className="w-full">
							<div className="flex items-center justify-between gap-3 flex-wrap">
								<h3 className="section-title">
									{translate("dashboard.projectVulnsChartTitle")}
								</h3>
								<span className="text-sm text-muted-foreground">
									项目数：{projectVulnsData.length}
								</span>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								{translate("dashboard.projectVulnsChartSubtitle")}（Top 10）
							</p>
						</div>
					</div>

					<div
						className="mt-4 border border-border/60 rounded-lg bg-muted/15 p-3"
						style={{ height: projectVulnsChartHeight }}
					>
						{projectVulnsData.length === 0 ? (
							<div className="h-full flex items-center justify-center text-base text-muted-foreground">
								{translate("dashboard.noProjectVulnsData")}
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={projectVulnsData}
									layout="vertical"
									margin={{ top: 6, right: 6, left: 4, bottom: 6 }}
									barCategoryGap={16}
									barGap={6}
									barSize={18}
								>
									<CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
									<XAxis
										type="number"
										domain={[0, projectVulnsChartMax]}
										tickFormatter={formatTick}
										tick={{ fontSize: 13 }}
									/>
									<YAxis
										type="category"
										dataKey="projectName"
										width={108}
										tick={{ fontSize: 13 }}
									/>
									<Tooltip content={renderProjectVulnsTooltip} />
									<Bar
										dataKey="totalVulns"
										fill="#f59e0b"
										name={translate("dashboard.totalVulns")}
										radius={[2, 2, 2, 2]}
										minPointSize={6}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
