import {
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip as ChartTooltip,
} from "recharts";

interface ProjectLanguageSlice {
	name: string;
	proportion: number;
	loc: number;
}

interface ProjectLanguagePieChartProps {
	projectId: string;
	slices: ProjectLanguageSlice[];
	colors: string[];
}

export default function ProjectLanguagePieChart({
	projectId,
	slices,
	colors,
}: ProjectLanguagePieChartProps) {
	return (
		<ResponsiveContainer width="100%" height="100%">
			<PieChart>
				<Pie
					data={slices}
					dataKey="proportion"
					nameKey="name"
					cx="50%"
					cy="50%"
					outerRadius={68}
					innerRadius={26}
					stroke="none"
				>
					{slices.map((slice, index) => (
						<Cell
							key={`${projectId}-${slice.name}`}
							fill={colors[index % colors.length]}
						/>
					))}
				</Pie>
				<ChartTooltip
					formatter={(value: number, _name, payload: any) => {
						const item = payload?.payload;
						return [
							`${(Number(value || 0) * 100).toFixed(2)}% · ${Number(
								item?.loc || 0,
							).toLocaleString()} 行`,
							item?.name || "未知语言",
						];
					}}
				/>
			</PieChart>
		</ResponsiveContainer>
	);
}
