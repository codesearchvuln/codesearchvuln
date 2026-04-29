import type {
  AgentFinding,
  AgentTask,
  AgentTreeResponse,
} from "@/shared/api/agentTasks";
import type { RealtimeMergedFindingItem } from "./components/RealtimeFindingsPanel";
import type { TokenUsageAccumulator } from "./detailViewModel";
import type { LogItem } from "./types";

const STALE_MS = 60_000;
const MAX_AGE_MS = 5 * 60_000;

export interface AgentAuditTaskDetailSnapshotData {
  task: AgentTask | null;
  findings: AgentFinding[];
  logs: LogItem[];
  agentTree: AgentTreeResponse | null;
  projectName: string | null;
  realtimeFindings: RealtimeMergedFindingItem[];
  tokenUsage: TokenUsageAccumulator;
  afterSequence: number;
  historicalEventsLoaded: boolean;
  terminalFailureReason: string | null;
}

export interface AgentAuditTaskDetailSnapshot {
  taskId: string;
  data: AgentAuditTaskDetailSnapshotData;
  fetchedAt: number;
  staleAt: number;
  expiresAt: number;
}

const snapshots = new Map<string, AgentAuditTaskDetailSnapshot>();

function normalizeTaskId(taskId: string): string {
  return String(taskId || "").trim();
}

function cloneTokenUsage(
  tokenUsage: TokenUsageAccumulator,
): TokenUsageAccumulator {
  return {
    ...tokenUsage,
    seenSequences: new Set(tokenUsage.seenSequences),
  };
}

function cloneSnapshotData(
  data: AgentAuditTaskDetailSnapshotData,
): AgentAuditTaskDetailSnapshotData {
  return {
    ...data,
    findings: [...data.findings],
    logs: [...data.logs],
    realtimeFindings: [...data.realtimeFindings],
    tokenUsage: cloneTokenUsage(data.tokenUsage),
  };
}

export function getAgentAuditTaskDetailSnapshot(
  taskId: string,
): AgentAuditTaskDetailSnapshot | null {
  const normalizedTaskId = normalizeTaskId(taskId);
  if (!normalizedTaskId) return null;
  return snapshots.get(normalizedTaskId) ?? null;
}

export function saveAgentAuditTaskDetailSnapshot(
  taskId: string,
  data: AgentAuditTaskDetailSnapshotData,
): AgentAuditTaskDetailSnapshot | null {
  const normalizedTaskId = normalizeTaskId(taskId);
  if (!normalizedTaskId) return null;

  const fetchedAt = Date.now();
  const snapshot: AgentAuditTaskDetailSnapshot = {
    taskId: normalizedTaskId,
    data: cloneSnapshotData(data),
    fetchedAt,
    staleAt: fetchedAt + STALE_MS,
    expiresAt: fetchedAt + MAX_AGE_MS,
  };
  snapshots.set(normalizedTaskId, snapshot);
  return snapshot;
}

export function isAgentAuditTaskDetailSnapshotFresh(
  snapshot: AgentAuditTaskDetailSnapshot | null | undefined,
): boolean {
  return Boolean(snapshot && Date.now() < snapshot.staleAt);
}

export function isAgentAuditTaskDetailSnapshotReusable(
  snapshot: AgentAuditTaskDetailSnapshot | null | undefined,
): boolean {
  return Boolean(snapshot && Date.now() < snapshot.expiresAt);
}

export function clearAgentAuditTaskDetailSnapshotStore() {
  snapshots.clear();
}
