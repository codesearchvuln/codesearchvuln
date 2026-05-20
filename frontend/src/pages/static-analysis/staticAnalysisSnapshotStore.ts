import type { UnifiedStaticFindingsQuery } from "@/shared/api/staticUnifiedFindings";
import type { Engine, UnifiedFindingRow } from "./viewModel";

const STALE_MS = 60_000;
const MAX_AGE_MS = 5 * 60_000;

export interface StaticAnalysisSnapshot<T> {
  data: T;
  fetchedAt: number;
  staleAt: number;
  expiresAt: number;
}

export interface StaticAnalysisFindingsSnapshotData {
  items: UnifiedFindingRow[];
  total: number;
}

const taskSnapshots = new Map<string, StaticAnalysisSnapshot<unknown>>();
const taskRequests = new Map<string, Promise<StaticAnalysisSnapshot<unknown>>>();

const findingsSnapshots = new Map<
  string,
  StaticAnalysisSnapshot<StaticAnalysisFindingsSnapshotData>
>();
const findingsRequests = new Map<
  string,
  Promise<StaticAnalysisSnapshot<StaticAnalysisFindingsSnapshotData>>
>();

function buildSnapshot<T>(data: T): StaticAnalysisSnapshot<T> {
  const fetchedAt = Date.now();
  return {
    data,
    fetchedAt,
    staleAt: fetchedAt + STALE_MS,
    expiresAt: fetchedAt + MAX_AGE_MS,
  };
}

function normalizeTaskId(taskId: string): string {
  return String(taskId || "").trim();
}

function buildTaskSnapshotKey(engine: Engine, taskId: string): string {
  return `${engine}:${encodeURIComponent(normalizeTaskId(taskId))}`;
}

function buildFindingsSnapshotKey(query: UnifiedStaticFindingsQuery): string {
  const searchParams = new URLSearchParams();

  const appendIfPresent = (key: string, value?: string | number | null) => {
    if (value === undefined || value === null) return;
    const normalizedValue = String(value).trim();
    if (!normalizedValue) return;
    searchParams.set(key, normalizedValue);
  };

  appendIfPresent("opengrep_task_id", query.opengrepTaskId);
  appendIfPresent("gitleaks_task_id", query.gitleaksTaskId);
  appendIfPresent("bandit_task_id", query.banditTaskId);
  appendIfPresent("phpstan_task_id", query.phpstanTaskId);
  appendIfPresent("yasa_task_id", query.yasaTaskId);
  appendIfPresent("pmd_task_id", query.pmdTaskId);
  appendIfPresent("page", query.page);
  appendIfPresent("page_size", query.pageSize);
  appendIfPresent("engine", query.engine);
  appendIfPresent("status", query.status);
  appendIfPresent("severity", query.severity);
  appendIfPresent("confidence", query.confidence);
  appendIfPresent("keyword", query.keyword);
  appendIfPresent("sort_by", query.sortBy);
  appendIfPresent("sort_order", query.sortOrder);

  return searchParams.toString();
}

export function isStaticAnalysisSnapshotFresh(
  snapshot: StaticAnalysisSnapshot<unknown> | null | undefined,
): boolean {
  return Boolean(snapshot && Date.now() < snapshot.staleAt);
}

export function isStaticAnalysisSnapshotReusable(
  snapshot: StaticAnalysisSnapshot<unknown> | null | undefined,
): boolean {
  return Boolean(snapshot && Date.now() < snapshot.expiresAt);
}

export function getStaticAnalysisTaskSnapshot<T>(
  engine: Engine,
  taskId: string,
): StaticAnalysisSnapshot<T> | null {
  const normalizedTaskId = normalizeTaskId(taskId);
  if (!normalizedTaskId) return null;
  return (taskSnapshots.get(
    buildTaskSnapshotKey(engine, normalizedTaskId),
  ) as StaticAnalysisSnapshot<T> | undefined) ?? null;
}

export async function requestStaticAnalysisTaskSnapshot<T>(params: {
  engine: Engine;
  taskId: string;
  loader: (taskId: string) => Promise<T>;
}): Promise<StaticAnalysisSnapshot<T>> {
  const normalizedTaskId = normalizeTaskId(params.taskId);
  if (!normalizedTaskId) {
    throw new Error("taskId is required");
  }

  const cacheKey = buildTaskSnapshotKey(params.engine, normalizedTaskId);
  const inFlightRequest = taskRequests.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest as Promise<StaticAnalysisSnapshot<T>>;
  }

  const request = params
    .loader(normalizedTaskId)
    .then((data) => {
      const snapshot = buildSnapshot(data);
      taskSnapshots.set(cacheKey, snapshot as StaticAnalysisSnapshot<unknown>);
      return snapshot;
    })
    .finally(() => {
      taskRequests.delete(cacheKey);
    });

  taskRequests.set(cacheKey, request as Promise<StaticAnalysisSnapshot<unknown>>);
  return request;
}

export function getStaticAnalysisFindingsSnapshot(
  query: UnifiedStaticFindingsQuery,
): StaticAnalysisSnapshot<StaticAnalysisFindingsSnapshotData> | null {
  return findingsSnapshots.get(buildFindingsSnapshotKey(query)) ?? null;
}

export async function requestStaticAnalysisFindingsSnapshot(params: {
  query: UnifiedStaticFindingsQuery;
  loader: (
    query: UnifiedStaticFindingsQuery,
  ) => Promise<StaticAnalysisFindingsSnapshotData>;
}): Promise<StaticAnalysisSnapshot<StaticAnalysisFindingsSnapshotData>> {
  const cacheKey = buildFindingsSnapshotKey(params.query);
  const inFlightRequest = findingsRequests.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = params
    .loader(params.query)
    .then((data) => {
      const snapshot = buildSnapshot(data);
      findingsSnapshots.set(cacheKey, snapshot);
      return snapshot;
    })
    .finally(() => {
      findingsRequests.delete(cacheKey);
    });

  findingsRequests.set(cacheKey, request);
  return request;
}

export function clearStaticAnalysisSnapshotStore() {
  taskSnapshots.clear();
  taskRequests.clear();
  findingsSnapshots.clear();
  findingsRequests.clear();
}
