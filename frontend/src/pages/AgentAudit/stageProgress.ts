import type { AgentTask } from "@/shared/api/agentTasks";
import type {
  AgentDisplayStageItem,
  AgentDisplayStageKey,
  AgentDisplayStageMode,
  AgentDisplayStageSummary,
  LogItem,
} from "./types";

type HybridBootstrapProgressSnapshot = {
  started: boolean;
  completed: boolean;
  source: string | null;
  totalFindings: number | null;
  candidateCount: number | null;
  enginesStarted: string[];
};

const TERMINAL_COMPLETED_STATUSES = new Set(["completed"]);
const TERMINAL_FAILED_STATUSES = new Set([
  "failed",
  "cancelled",
  "interrupted",
  "aborted",
]);

const HYBRID_BOOTSTRAP_SOURCE_PREFIX = "embedded_";

const STAGE_LABELS: Record<AgentDisplayStageKey, string> = {
  static_scan: "静态扫描",
  recon: "侦查",
  analysis: "分析",
  verification: "验证",
  complete: "完成",
};

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMode(task: AgentTask | null): AgentDisplayStageMode {
  const combined = `${String(task?.name || "").trim().toLowerCase()} ${String(
    task?.description || "",
  )
    .trim()
    .toLowerCase()}`;
  if (combined.includes("[hybrid]") || combined.includes("混合扫描")) {
    return "hybrid";
  }
  if (Array.isArray(task?.target_files) && task.target_files.length > 0) {
    return "file";
  }
  return "intelligent";
}

function collectBootstrapSnapshot(logs: LogItem[]): HybridBootstrapProgressSnapshot {
  const engines = new Set<string>();
  let started = false;
  let completed = false;
  let source: string | null = null;
  let totalFindings: number | null = null;
  let candidateCount: number | null = null;

  for (const item of logs) {
    const detail = toRecord(item.detail);
    const metadata = toRecord(detail?.metadata);
    const title = String(item.title || "").trim();
    const content = String(item.content || "").trim();
    const text = `${title}\n${content}`;
    const sourceValue =
      typeof metadata?.bootstrap_source === "string"
        ? metadata.bootstrap_source.trim()
        : "";
    const hasBootstrapMetadata =
      metadata?.bootstrap === true ||
      Boolean(sourceValue) ||
      metadata?.bootstrap_total_findings !== undefined ||
      metadata?.bootstrap_candidate_count !== undefined;
    const mentionsBootstrap =
      /内嵌静态预扫|静态预扫|内嵌预扫/.test(text) ||
      sourceValue.startsWith(HYBRID_BOOTSTRAP_SOURCE_PREFIX);

    if (!hasBootstrapMetadata && !mentionsBootstrap) {
      continue;
    }

    if (sourceValue) {
      source = sourceValue;
    }

    const nextTotal = toFiniteNumber(metadata?.bootstrap_total_findings);
    if (nextTotal !== null) {
      totalFindings = nextTotal;
    }
    const nextCandidateCount = toFiniteNumber(metadata?.bootstrap_candidate_count);
    if (nextCandidateCount !== null) {
      candidateCount = nextCandidateCount;
    }

    if (/opengrep/i.test(text)) engines.add("OpenGrep");
    if (/bandit/i.test(text)) engines.add("Bandit");
    if (/gitleaks/i.test(text)) engines.add("Gitleaks");
    if (/phpstan/i.test(text)) engines.add("PHPStan");
    if (/\byasa\b/i.test(text)) engines.add("YASA");

    if (
      /内嵌静态预扫完成/.test(text) ||
      /bootstrap.*completed/i.test(text)
    ) {
      started = true;
      completed = true;
      continue;
    }

    if (
      /内嵌预扫开始/.test(text) ||
      /静态预扫未筛选出/.test(text) ||
      /静态预扫未启用/.test(text) ||
      sourceValue.startsWith(HYBRID_BOOTSTRAP_SOURCE_PREFIX)
    ) {
      started = true;
    }
  }

  return {
    started,
    completed,
    source,
    totalFindings,
    candidateCount,
    enginesStarted: [...engines],
  };
}

function resolveStageKeyFromPhase(
  mode: AgentDisplayStageMode,
  phase: string,
  bootstrap: HybridBootstrapProgressSnapshot,
): AgentDisplayStageKey | null {
  if (mode === "hybrid" && bootstrap.started && !bootstrap.completed) {
    return "static_scan";
  }
  if (
    phase === "planning" ||
    phase === "indexing" ||
    phase === "reconnaissance"
  ) {
    return "recon";
  }
  if (phase === "analysis") {
    return "analysis";
  }
  if (phase === "verification") {
    return "verification";
  }
  if (phase === "reporting") {
    return "complete";
  }
  return null;
}

function resolveStageKeyFromTask(task: AgentTask | null): AgentDisplayStageKey | null {
  const displayPhase = normalizeToken(task?.display_phase);
  if (
    displayPhase === "static_scan" ||
    displayPhase === "recon" ||
    displayPhase === "analysis" ||
    displayPhase === "verification" ||
    displayPhase === "complete"
  ) {
    return displayPhase;
  }

  const workflowPhase = normalizeToken(task?.workflow_phase);
  if (
    workflowPhase === "recon" ||
    workflowPhase === "business_logic_recon"
  ) {
    return "recon";
  }
  if (
    workflowPhase === "analysis" ||
    workflowPhase === "business_logic_analysis"
  ) {
    return "analysis";
  }
  if (workflowPhase === "verification") {
    return "verification";
  }
  if (workflowPhase === "report" || workflowPhase === "complete") {
    return "complete";
  }

  return null;
}

function buildHybridBootstrapHint(
  bootstrap: HybridBootstrapProgressSnapshot,
): string | null {
  const parts: string[] = [];
  if (bootstrap.enginesStarted.length > 0) {
    parts.push(`已启动引擎：${bootstrap.enginesStarted.join(" / ")}`);
  }
  if (bootstrap.candidateCount !== null || bootstrap.totalFindings !== null) {
    parts.push(
      `候选 ${bootstrap.candidateCount ?? 0} / 命中 ${bootstrap.totalFindings ?? 0}`,
    );
  }
  return parts.length > 0 ? parts.join("，") : "正在执行内嵌静态预扫";
}

function buildStages(
  mode: AgentDisplayStageMode,
  currentStageKey: AgentDisplayStageKey | null,
  terminalStatus: "completed" | "failed" | null,
): AgentDisplayStageItem[] {
  const stageOrder: AgentDisplayStageKey[] =
    mode === "hybrid"
      ? ["static_scan", "recon", "analysis", "verification", "complete"]
      : ["recon", "analysis", "verification", "complete"];

  const currentIndex =
    currentStageKey === null ? -1 : stageOrder.indexOf(currentStageKey);

  return stageOrder.map((key, index) => {
    let status: AgentDisplayStageItem["status"] = "pending";
    if (terminalStatus === "completed") {
      status = "completed";
    } else if (terminalStatus === "failed" && index === currentIndex) {
      status = "failed";
    } else if (currentIndex >= 0) {
      if (index < currentIndex) {
        status = "completed";
      } else if (index === currentIndex) {
        status = "active";
      }
    }

    return {
      key,
      label: STAGE_LABELS[key],
      status,
    };
  });
}

export function buildAgentDisplayStageSummary(input: {
  task: AgentTask | null;
  logs: LogItem[];
}): AgentDisplayStageSummary | null {
  const { task, logs } = input;
  if (!task) return null;

  const mode = resolveMode(task);
  const status = normalizeToken(task.status);
  const phase = normalizeToken(task.current_phase);
  const bootstrap = collectBootstrapSnapshot(logs);

  let currentStageKey =
    resolveStageKeyFromTask(task) ||
    resolveStageKeyFromPhase(mode, phase, bootstrap);
  if (!currentStageKey) {
    if (TERMINAL_COMPLETED_STATUSES.has(status)) {
      currentStageKey = "complete";
    } else if (mode === "hybrid" && bootstrap.started && !bootstrap.completed) {
      currentStageKey = "static_scan";
    } else if (
      status === "running" ||
      status === "pending" ||
      status === "initializing"
    ) {
      currentStageKey = "recon";
    }
  }

  const terminalStatus = TERMINAL_COMPLETED_STATUSES.has(status)
    ? "completed"
    : TERMINAL_FAILED_STATUSES.has(status)
      ? "failed"
      : null;
  const stages = buildStages(mode, currentStageKey, terminalStatus);
  const currentStageLabel =
    currentStageKey !== null ? STAGE_LABELS[currentStageKey] : null;

  let headline = currentStageLabel || "等待开始";
  if (currentStageKey === "complete" && terminalStatus !== "completed") {
    headline = "完成（收尾中）";
  } else if (terminalStatus === "completed") {
    headline = "已完成";
  } else if (terminalStatus === "failed" && currentStageLabel) {
    headline = `${currentStageLabel}失败`;
  }

  const currentStep = String(task.current_step || "").trim();
  let hint: string | null = currentStep || null;
  if (!hint && mode === "hybrid" && currentStageKey === "static_scan") {
    hint = buildHybridBootstrapHint(bootstrap);
  }
  if (!hint && currentStageLabel) {
    hint =
      currentStageKey === "complete" && terminalStatus !== "completed"
        ? "正在归档结果并生成最终报告"
        : `当前阶段：${headline}`;
  }

  return {
    mode,
    currentStageKey,
    currentStageLabel,
    headline,
    hint,
    stages,
  };
}
