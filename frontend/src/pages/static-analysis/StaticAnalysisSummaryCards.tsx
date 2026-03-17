import { memo, useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTaskClock } from "@/features/tasks/hooks/useTaskClock";
import type { GitleaksScanTask } from "@/shared/api/gitleaks";
import type { OpengrepScanTask } from "@/shared/api/opengrep";
import type { BanditScanTask } from "@/shared/api/bandit";
import type { PhpstanScanTask } from "@/shared/api/phpstan";
import type { YasaScanTask } from "@/shared/api/yasa";

import type { Engine } from "./viewModel";
import {
  buildStaticAnalysisProgressSummary,
  buildStaticAnalysisTaskStatusSummary,
  formatStaticAnalysisDuration,
  getStaticAnalysisTotalDisplayDurationMs,
  getStaticAnalysisProgressAccentClassName,
  getStaticAnalysisStatusBadgeClassName,
  isStaticAnalysisPollableStatus,
  toStaticAnalysisSafeMetric,
} from "./viewModel";

interface StaticAnalysisSummaryCardsProps {
  opengrepTask: OpengrepScanTask | null;
  gitleaksTask: GitleaksScanTask | null;
  banditTask: BanditScanTask | null;
  phpstanTask: PhpstanScanTask | null;
  yasaTask: YasaScanTask | null;
  enabledEngines: Engine[];
}

export const StaticAnalysisSummaryCards = memo(function StaticAnalysisSummaryCards({
  opengrepTask,
  gitleaksTask,
  banditTask,
  phpstanTask,
  yasaTask,
  enabledEngines,
}: StaticAnalysisSummaryCardsProps) {
  const shouldTickClock = useMemo(
    () =>
      [opengrepTask, gitleaksTask, banditTask, phpstanTask, yasaTask].some((task) =>
        isStaticAnalysisPollableStatus(task?.status),
      ),
    [banditTask, gitleaksTask, opengrepTask, phpstanTask, yasaTask],
  );
  const nowMs = useTaskClock({ enabled: shouldTickClock, intervalMs: 1000 });

  const progressPercent = useMemo(
    () =>
      buildStaticAnalysisProgressSummary({
        opengrepTask,
        gitleaksTask,
        banditTask,
        phpstanTask,
        yasaTask,
        nowMs,
      }).progressPercent,
    [banditTask, gitleaksTask, nowMs, opengrepTask, phpstanTask, yasaTask],
  );

  const statusSummary = useMemo(
    () =>
      buildStaticAnalysisTaskStatusSummary({
        opengrepTask,
        gitleaksTask,
        banditTask,
        phpstanTask,
        yasaTask,
      }),
    [banditTask, gitleaksTask, opengrepTask, phpstanTask, yasaTask],
  );

  const totalScanDurationMs = useMemo(
    () =>
      getStaticAnalysisTotalDisplayDurationMs({
        opengrepTask,
        gitleaksTask,
        banditTask,
        phpstanTask,
        yasaTask,
        nowMs,
      }),
    [banditTask, gitleaksTask, nowMs, opengrepTask, phpstanTask, yasaTask],
  );

  const totalFindings = useMemo(
    () =>
      toStaticAnalysisSafeMetric(opengrepTask?.total_findings) +
      toStaticAnalysisSafeMetric(gitleaksTask?.total_findings) +
      toStaticAnalysisSafeMetric(banditTask?.total_findings) +
      toStaticAnalysisSafeMetric(phpstanTask?.total_findings) +
      toStaticAnalysisSafeMetric(yasaTask?.total_findings),
    [
      banditTask?.total_findings,
      gitleaksTask?.total_findings,
      opengrepTask?.total_findings,
      phpstanTask?.total_findings,
      yasaTask?.total_findings,
    ],
  );

  const totalFilesScanned = useMemo(
    () =>
      toStaticAnalysisSafeMetric(opengrepTask?.files_scanned) +
      toStaticAnalysisSafeMetric(gitleaksTask?.files_scanned) +
      toStaticAnalysisSafeMetric(banditTask?.files_scanned) +
      toStaticAnalysisSafeMetric(phpstanTask?.files_scanned) +
      toStaticAnalysisSafeMetric(yasaTask?.files_scanned),
    [
      banditTask?.files_scanned,
      gitleaksTask?.files_scanned,
      opengrepTask?.files_scanned,
      phpstanTask?.files_scanned,
      yasaTask?.files_scanned,
    ],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="cyber-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            进度比例
          </p>
          <p className="text-xl font-bold text-foreground">{progressPercent}%</p>
          <Progress
            value={progressPercent}
            className={`h-1.5 bg-muted ${getStaticAnalysisProgressAccentClassName(statusSummary.aggregateStatus)}`}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {statusSummary.progressHint}
          </p>
        </div>
        <div className="cyber-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            任务状态
          </p>
          <Badge className={getStaticAnalysisStatusBadgeClassName(statusSummary.aggregateStatus)}>
            {statusSummary.aggregateLabel}
          </Badge>
          <div className="flex flex-wrap gap-2">
            {statusSummary.engineStatuses.map((engineStatus) => (
              <Badge
                key={engineStatus.engine}
                variant="outline"
                className="border-border/70 text-[11px] text-muted-foreground"
              >
                {engineStatus.engineLabel} · {engineStatus.statusLabel}
              </Badge>
            ))}
          </div>
        </div>
        <div className="cyber-card p-4 space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            扫描时间
          </p>
          <p className="text-xl font-bold text-foreground">
            {formatStaticAnalysisDuration(totalScanDurationMs)}
          </p>
        </div>
        <div className="cyber-card p-4 space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            扫描漏洞数量
          </p>
          <p className="text-xl font-bold text-foreground">
            {totalFindings.toLocaleString()}
          </p>
        </div>
        <div className="cyber-card p-4 space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            使用引擎数量
          </p>
          <p className="text-xl font-bold text-foreground">
            {enabledEngines.length.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {enabledEngines
              .map((engine) =>
                engine === "opengrep"
                  ? "Opengrep"
                  : engine === "gitleaks"
                    ? "Gitleaks"
                    : engine === "bandit"
                      ? "Bandit"
                      : engine === "phpstan"
                        ? "PHPStan"
                        : "YASA",
              )
              .join(" / ") || "-"}
          </p>
        </div>
        <div className="cyber-card p-4 space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            涉及文件
          </p>
          <p className="text-xl font-bold text-foreground">
            {totalFilesScanned.toLocaleString()}
          </p>
        </div>
      </div>

      {statusSummary.failureReasons.length > 0 ? (
        <div
          className={`cyber-card border p-4 ${
            statusSummary.aggregateStatus === "failed"
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                statusSummary.aggregateStatus === "failed"
                  ? "text-rose-300"
                  : "text-amber-300"
              }`}
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {statusSummary.aggregateStatus === "failed"
                  ? "扫描已结束，但存在失败引擎"
                  : "扫描已结束，任务被中断"}
              </p>
              <div className="space-y-2">
                {statusSummary.failureReasons.map((reason) => (
                  <div key={`${reason.engine}-${reason.message}`} className="space-y-1">
                    <Badge
                      variant="outline"
                      className={`${
                        statusSummary.aggregateStatus === "failed"
                          ? "border-rose-400/40 text-rose-200"
                          : "border-amber-400/40 text-amber-200"
                      }`}
                    >
                      {reason.engineLabel}
                    </Badge>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {reason.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default StaticAnalysisSummaryCards;
