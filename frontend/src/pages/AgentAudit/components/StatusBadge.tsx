/**
 * Status Badge Component
 * Elegant status indicator with cassette futurism aesthetic
 * Features: Animated states, glow effects, refined typography
 */

import { memo } from "react";
import {
	CheckCircle2,
	XCircle,
	Clock,
	Loader2,
	Square,
	AlertCircle,
} from "lucide-react";
import { getTaskDisplayStatusSummary } from "@/features/tasks/services/taskDisplay";

interface StatusBadgeProps {
	status: string;
	size?: "sm" | "default";
}

const STATUS_CONFIG: Record<
	string,
	{
		icon: React.ReactNode;
		iconSm: React.ReactNode;
		bg: string;
		text: string;
		label: string;
		glow?: string;
		animate?: boolean;
	}
> = {
	pending: {
		icon: <Clock className="w-3.5 h-3.5" />,
		iconSm: <Clock className="w-3 h-3" />,
		bg: "bg-sky-100 dark:bg-sky-950/60 border-sky-500/40",
		text: "text-sky-700 dark:text-sky-300",
		label: "待处理",
	},
	running: {
		icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
		iconSm: <Loader2 className="w-3 h-3 animate-spin" />,
		bg: "bg-sky-100 dark:bg-sky-950/80 border-sky-500/50",
		text: "text-sky-700 dark:text-sky-300",
		label: "运行中",
		glow: "dark:shadow-[0_0_8px_rgba(56,189,248,0.3)]",
		animate: true,
	},
	completed: {
		icon: <CheckCircle2 className="w-3.5 h-3.5" />,
		iconSm: <CheckCircle2 className="w-3 h-3" />,
		bg: "bg-green-100 dark:bg-green-950/60 border-green-600/50",
		text: "text-green-700 dark:text-green-400",
		label: "已完成",
	},
	failed: {
		icon: <XCircle className="w-3.5 h-3.5" />,
		iconSm: <XCircle className="w-3 h-3" />,
		bg: "bg-red-100 dark:bg-red-950/60 border-red-600/50",
		text: "text-red-700 dark:text-red-400",
		label: "失败",
		glow: "dark:shadow-[0_0_8px_rgba(248,113,113,0.2)]",
	},
	cancelled: {
		icon: <Square className="w-3.5 h-3.5" />,
		iconSm: <Square className="w-3 h-3" />,
		bg: "bg-muted border-border",
		text: "text-foreground",
		label: "已取消",
	},
	interrupted: {
		icon: <AlertCircle className="w-3.5 h-3.5" />,
		iconSm: <AlertCircle className="w-3 h-3" />,
		bg: "bg-yellow-100 dark:bg-yellow-950/60 border-yellow-600/50",
		text: "text-yellow-700 dark:text-yellow-400",
		label: "已中断",
	},
	error: {
		icon: <AlertCircle className="w-3.5 h-3.5" />,
		iconSm: <AlertCircle className="w-3 h-3" />,
		bg: "bg-red-100 dark:bg-red-950/60 border-red-600/50",
		text: "text-red-700 dark:text-red-400",
		label: "错误",
		glow: "dark:shadow-[0_0_8px_rgba(248,113,113,0.2)]",
	},
};

export const StatusBadge = memo(function StatusBadge({
	status,
	size = "default",
}: StatusBadgeProps) {
	const normalizedStatus = String(status || "").trim().toLowerCase();
	const summary = getTaskDisplayStatusSummary(normalizedStatus);
	const statusKey =
		summary.normalizedStatus === "canceled"
			? "cancelled"
			: summary.normalizedStatus === "aborted"
				? "interrupted"
				: summary.normalizedStatus;
	const fallbackConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
	const config = {
		...fallbackConfig,
		label: summary.statusLabel || fallbackConfig.label,
	};
	const isSmall = size === "sm";

	return (
		<div
			className={`
        inline-flex items-center gap-1.5 rounded border font-mono uppercase tracking-wider
        transition-all duration-300
        ${config.bg}
        ${config.text}
        ${config.glow || ""}
        ${isSmall ? "px-2 py-1 text-sm" : "px-2.5 py-1.5 text-sm"}
      `}
		>
			{isSmall ? config.iconSm : config.icon}
			<span className="font-semibold">{config.label}</span>
		</div>
	);
});

export default StatusBadge;
