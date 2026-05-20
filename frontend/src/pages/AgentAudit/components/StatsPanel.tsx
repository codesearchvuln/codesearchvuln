import { memo } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bug,
  Clock3,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { formatDurationMs, formatTokenValue } from "../detailViewModel";
import type { StatsPanelProps } from "../types";

function MetricCard({
  icon,
  label,
  value,
  subtext,
  valueClassName,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtext: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`cyber-card flex min-w-[180px] flex-col gap-2 p-4 ${className || ""}`}>
      <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
      </div>
      <div className={valueClassName || "text-xl font-bold text-foreground"}>{value}</div>
      <div className="text-base text-muted-foreground">{subtext}</div>
    </div>
  );
}

const PROGRESS_VALUE_STYLE_MAP = {
  waiting: {
    dotClassName: "bg-muted-foreground/60",
    textClassName: "text-muted-foreground",
  },
  static_scan: {
    dotClassName: "bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.45)]",
    textClassName: "text-sky-300",
  },
  recon: {
    dotClassName: "bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.45)]",
    textClassName: "text-teal-300",
  },
  analysis: {
    dotClassName: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.45)]",
    textClassName: "text-amber-300",
  },
  verification: {
    dotClassName: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
    textClassName: "text-emerald-300",
  },
  complete: {
    dotClassName: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.45)]",
    textClassName: "text-violet-300",
  },
  completed: {
    dotClassName: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
    textClassName: "text-emerald-300",
  },
  failed: {
    dotClassName: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]",
    textClassName: "text-rose-300",
  },
} as const;

function StageProgressCard({ stageSummary }: Pick<StatsPanelProps, "stageSummary">) {
  if (!stageSummary) {
    return (
      <MetricCard
        icon={<Activity className="h-4 w-4" />}
        label="当前进度"
        value={
          <span className="inline-flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${PROGRESS_VALUE_STYLE_MAP.waiting.dotClassName}`}
            />
            <span className={PROGRESS_VALUE_STYLE_MAP.waiting.textClassName}>等待开始</span>
          </span>
        }
        subtext=""
      />
    );
  }

  const currentStage =
    stageSummary.currentStageKey !== null
      ? stageSummary.stages.find((stage) => stage.key === stageSummary.currentStageKey) || null
      : null;
  const styleKey =
    currentStage?.status === "failed"
      ? "failed"
      : currentStage?.status === "completed"
        ? "completed"
        : currentStage?.key || "waiting";
  const style = PROGRESS_VALUE_STYLE_MAP[styleKey];
  const label =
    currentStage?.status === "failed"
      ? "失败"
      : currentStage?.status === "completed"
        ? "已完成"
        : currentStage?.label || stageSummary.currentStageLabel || stageSummary.headline || "等待开始";

  return (
    <MetricCard
      icon={<Activity className="h-4 w-4" />}
      label="当前进度"
      value={
        <span className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dotClassName}`} />
          <span className={style.textClassName}>{label}</span>
        </span>
      }
      subtext=""
    />
  );
}

export const StatsPanel = memo(function StatsPanel({
  summary,
  stageSummary,
  projectName,
}: StatsPanelProps) {
  if (!summary) return null;

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="grid min-w-[1240px] grid-cols-7 gap-3">
        <MetricCard
          icon={<FolderOpen className="h-4 w-4" />}
          label="当前项目"
          value={String(projectName || "-")}
          subtext=""
          className="col-span-2"
        />
        <StageProgressCard stageSummary={stageSummary} />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="扫描时间"
          value={formatDurationMs(summary.durationMs)}
          subtext=""
        />
        <MetricCard
          icon={<Bug className="h-4 w-4" />}
          label="有效漏洞"
          value={summary.totalFindings.toLocaleString()}
          subtext=""
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="词元消耗"
          value={formatTokenValue(summary.tokensTotal)}
          subtext=""
        />
      </div>
    </div>
  );
});

export default StatsPanel;
