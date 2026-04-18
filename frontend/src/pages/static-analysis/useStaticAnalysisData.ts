import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getBanditFindings,
  getBanditScanTask,
  interruptBanditScanTask,
  updateBanditFindingStatus,
  type BanditScanTask,
} from "@/shared/api/bandit";
import {
  getPhpstanFindings,
  getPhpstanScanTask,
  interruptPhpstanScanTask,
  updatePhpstanFindingStatus,
  type PhpstanScanTask,
} from "@/shared/api/phpstan";
import {
  getPmdFindings,
  getPmdScanTask,
  interruptPmdScanTask,
  updatePmdFindingStatus,
  type PmdScanTask,
} from "@/shared/api/pmd";
import {
  getGitleaksFindings,
  getGitleaksScanTask,
  interruptGitleaksScanTask,
  updateGitleaksFindingStatus,
  type GitleaksScanTask,
} from "@/shared/api/gitleaks";
import {
  getYasaFindings,
  getYasaScanTask,
  interruptYasaScanTask,
  updateYasaFindingStatus,
  type YasaScanTask,
} from "@/shared/api/yasa";
import {
  getOpengrepScanFindings,
  getOpengrepScanTask,
  interruptOpengrepScanTask,
  updateOpengrepFindingStatus,
  type OpengrepScanTask,
} from "@/shared/api/opengrep";
import {
  getUnifiedStaticFindings,
  type UnifiedStaticFindingsQuery,
} from "@/shared/api/staticUnifiedFindings";
import {
  getStaticAnalysisFindingsSnapshot,
  getStaticAnalysisTaskSnapshot,
  isStaticAnalysisSnapshotFresh,
  isStaticAnalysisSnapshotReusable,
  requestStaticAnalysisFindingsSnapshot,
  requestStaticAnalysisTaskSnapshot,
} from "./staticAnalysisSnapshotStore";
import type { Engine, FindingStatus, UnifiedFindingRow } from "./viewModel";
import {
  buildUnifiedFindingRows,
  isStaticAnalysisInterruptibleStatus,
  isStaticAnalysisPollableStatus,
  mapUnifiedFindingItemToRow,
} from "./viewModel";

function compareOptionalNumberAsc(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  const leftValue = left ?? Number.MAX_SAFE_INTEGER;
  const rightValue = right ?? Number.MAX_SAFE_INTEGER;
  return leftValue - rightValue;
}

function compareTextAsc(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return String(left || "")
    .toLowerCase()
    .localeCompare(String(right || "").toLowerCase());
}

function applyLocalUnifiedFindingsQuery(
  rows: UnifiedFindingRow[],
  query: UnifiedStaticFindingsQuery,
): { items: UnifiedFindingRow[]; total: number } {
  const normalizedKeyword = String(query.keyword || "").trim().toLowerCase();
  const filtered = rows
    .filter((row) => !query.engine || row.engine === query.engine)
    .filter((row) => !query.status || row.status === query.status)
    .filter((row) => !query.severity || row.severity === query.severity)
    .filter((row) => !query.confidence || row.confidence === query.confidence)
    .filter((row) => {
      if (!normalizedKeyword) return true;
      return (
        row.rule.toLowerCase().includes(normalizedKeyword) ||
        row.filePath.toLowerCase().includes(normalizedKeyword)
      );
    });

  const sortBy = query.sortBy || "severity";
  const sortOrder = query.sortOrder || "desc";
  const direction = sortOrder === "desc" ? -1 : 1;

  filtered.sort((left, right) => {
    if (sortBy === "severity" && left.severityScore !== right.severityScore) {
      return direction * (left.severityScore - right.severityScore);
    }
    if (
      sortBy === "confidence" &&
      left.confidenceScore !== right.confidenceScore
    ) {
      return direction * (left.confidenceScore - right.confidenceScore);
    }
    if (sortBy === "file_path") {
      const pathCompare = compareTextAsc(left.filePath, right.filePath);
      if (pathCompare !== 0) return direction * pathCompare;
    }
    if (sortBy === "line") {
      const lineCompare = compareOptionalNumberAsc(left.line, right.line);
      if (lineCompare !== 0) return direction * lineCompare;
    }

    if (sortBy !== "severity" && left.severityScore !== right.severityScore) {
      return right.severityScore - left.severityScore;
    }
    if (
      sortBy !== "confidence" &&
      left.confidenceScore !== right.confidenceScore
    ) {
      return right.confidenceScore - left.confidenceScore;
    }
    if (sortBy !== "file_path") {
      const pathCompare = compareTextAsc(left.filePath, right.filePath);
      if (pathCompare !== 0) return pathCompare;
    }
    if (sortBy !== "line") {
      const lineCompare = compareOptionalNumberAsc(left.line, right.line);
      if (lineCompare !== 0) return lineCompare;
    }

    return left.key.localeCompare(right.key);
  });

  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Number(query.pageSize || 20));
  const offset = (page - 1) * pageSize;

  return {
    items: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
  };
}

async function getLegacyUnifiedFindingsFallback(query: UnifiedStaticFindingsQuery) {
  const [
    opengrepFindings,
    gitleaksFindings,
    banditFindings,
    phpstanFindings,
    yasaFindings,
    pmdFindings,
  ] = await Promise.all([
    query.opengrepTaskId
      ? getOpengrepScanFindings({ taskId: query.opengrepTaskId, status: query.status })
      : Promise.resolve([]),
    query.gitleaksTaskId
      ? getGitleaksFindings({ taskId: query.gitleaksTaskId, status: query.status })
      : Promise.resolve([]),
    query.banditTaskId
      ? getBanditFindings({ taskId: query.banditTaskId, status: query.status })
      : Promise.resolve([]),
    query.phpstanTaskId
      ? getPhpstanFindings({ taskId: query.phpstanTaskId, status: query.status })
      : Promise.resolve([]),
    query.yasaTaskId
      ? getYasaFindings({ taskId: query.yasaTaskId, status: query.status })
      : Promise.resolve([]),
    query.pmdTaskId
      ? getPmdFindings({ taskId: query.pmdTaskId, status: query.status })
      : Promise.resolve([]),
  ]);

  const rows = buildUnifiedFindingRows({
    opengrepFindings,
    gitleaksFindings,
    banditFindings,
    phpstanFindings,
    yasaFindings,
    pmdFindings,
    opengrepTaskId: query.opengrepTaskId || "",
    gitleaksTaskId: query.gitleaksTaskId || "",
    banditTaskId: query.banditTaskId || "",
    phpstanTaskId: query.phpstanTaskId || "",
    yasaTaskId: query.yasaTaskId || "",
    pmdTaskId: query.pmdTaskId || "",
  });

  return applyLocalUnifiedFindingsQuery(rows, query);
}

function shouldFallbackToLegacyUnifiedFindings(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function hasCachedTaskSnapshot(engine: Engine, taskId: string): boolean {
  if (!taskId) return true;
  return Boolean(getStaticAnalysisTaskSnapshot(engine, taskId));
}

const INITIAL_TASK_REQUEST_SEQ: Record<Engine, number> = {
  opengrep: 0,
  gitleaks: 0,
  bandit: 0,
  phpstan: 0,
  pmd: 0,
  yasa: 0,
};

export function useStaticAnalysisData({
  hasEnabledEngine,
  opengrepTaskId,
  gitleaksTaskId,
  banditTaskId,
  phpstanTaskId,
  yasaTaskId,
  pmdTaskId,
  unifiedQuery,
}: {
  hasEnabledEngine: boolean;
  opengrepTaskId: string;
  gitleaksTaskId: string;
  banditTaskId: string;
  phpstanTaskId: string;
  yasaTaskId: string;
  pmdTaskId: string;
  unifiedQuery: UnifiedStaticFindingsQuery;
}) {
  const initialOpengrepTask = opengrepTaskId
    ? getStaticAnalysisTaskSnapshot<OpengrepScanTask>("opengrep", opengrepTaskId)
    : null;
  const initialGitleaksTask = gitleaksTaskId
    ? getStaticAnalysisTaskSnapshot<GitleaksScanTask>("gitleaks", gitleaksTaskId)
    : null;
  const initialBanditTask = banditTaskId
    ? getStaticAnalysisTaskSnapshot<BanditScanTask>("bandit", banditTaskId)
    : null;
  const initialPhpstanTask = phpstanTaskId
    ? getStaticAnalysisTaskSnapshot<PhpstanScanTask>("phpstan", phpstanTaskId)
    : null;
  const initialPmdTask = pmdTaskId
    ? getStaticAnalysisTaskSnapshot<PmdScanTask>("pmd", pmdTaskId)
    : null;
  const initialYasaTask = yasaTaskId
    ? getStaticAnalysisTaskSnapshot<YasaScanTask>("yasa", yasaTaskId)
    : null;
  const initialFindingsSnapshot = hasEnabledEngine
    ? getStaticAnalysisFindingsSnapshot(unifiedQuery)
    : null;
  const hasCachedTaskData =
    hasCachedTaskSnapshot("opengrep", opengrepTaskId) &&
    hasCachedTaskSnapshot("gitleaks", gitleaksTaskId) &&
    hasCachedTaskSnapshot("bandit", banditTaskId) &&
    hasCachedTaskSnapshot("phpstan", phpstanTaskId) &&
    hasCachedTaskSnapshot("pmd", pmdTaskId) &&
    hasCachedTaskSnapshot("yasa", yasaTaskId);

  const [opengrepTask, setOpengrepTask] = useState<OpengrepScanTask | null>(
    () => initialOpengrepTask?.data ?? null,
  );
  const [gitleaksTask, setGitleaksTask] = useState<GitleaksScanTask | null>(
    () => initialGitleaksTask?.data ?? null,
  );
  const [banditTask, setBanditTask] = useState<BanditScanTask | null>(
    () => initialBanditTask?.data ?? null,
  );
  const [phpstanTask, setPhpstanTask] = useState<PhpstanScanTask | null>(
    () => initialPhpstanTask?.data ?? null,
  );
  const [yasaTask, setYasaTask] = useState<YasaScanTask | null>(
    () => initialYasaTask?.data ?? null,
  );
  const [pmdTask, setPmdTask] = useState<PmdScanTask | null>(
    () => initialPmdTask?.data ?? null,
  );
  const [unifiedRows, setUnifiedRows] = useState<UnifiedFindingRow[]>(
    () => initialFindingsSnapshot?.data.items ?? [],
  );
  const [unifiedTotal, setUnifiedTotal] = useState(
    () => initialFindingsSnapshot?.data.total ?? 0,
  );

  const [loadingInitial, setLoadingInitial] = useState(
    () => hasEnabledEngine && !hasCachedTaskData,
  );
  const [taskLoadingCount, setTaskLoadingCount] = useState(0);
  const [loadingFindings, setLoadingFindings] = useState(
    () => hasEnabledEngine && !initialFindingsSnapshot,
  );
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [interruptTarget, setInterruptTarget] = useState<Engine | null>(null);
  const [interrupting, setInterrupting] = useState(false);

  const loadingTask = taskLoadingCount > 0;
  const unifiedQueryRef = useRef<UnifiedStaticFindingsQuery>(unifiedQuery);
  const unifiedRequestSeqRef = useRef(0);
  const taskRequestSeqRef = useRef({ ...INITIAL_TASK_REQUEST_SEQ });

  const opengrepSilentRefreshRef = useRef(false);
  const gitleaksSilentRefreshRef = useRef(false);
  const banditSilentRefreshRef = useRef(false);
  const phpstanSilentRefreshRef = useRef(false);
  const yasaSilentRefreshRef = useRef(false);
  const pmdSilentRefreshRef = useRef(false);

  const beginTaskLoading = useCallback(() => {
    setTaskLoadingCount((current) => current + 1);
  }, []);

  const endTaskLoading = useCallback(() => {
    setTaskLoadingCount((current) => Math.max(0, current - 1));
  }, []);

  const loadTask = useCallback(
    async <T,>({
      engine,
      taskId,
      silent = false,
      force = false,
      loader,
      assign,
      errorMessage,
    }: {
      engine: Engine;
      taskId: string;
      silent?: boolean;
      force?: boolean;
      loader: (taskId: string) => Promise<T>;
      assign: (task: T | null) => void;
      errorMessage: string;
    }) => {
      if (!taskId) {
        assign(null);
        return;
      }

      const requestSeq = taskRequestSeqRef.current[engine] + 1;
      taskRequestSeqRef.current[engine] = requestSeq;

      const cachedSnapshot = getStaticAnalysisTaskSnapshot<T>(engine, taskId);
      if (cachedSnapshot) {
        assign(cachedSnapshot.data ?? null);
        if (!force && isStaticAnalysisSnapshotFresh(cachedSnapshot)) {
          return;
        }
      }

      const trackLoading =
        !silent &&
        (force || !cachedSnapshot || !isStaticAnalysisSnapshotReusable(cachedSnapshot));

      try {
        if (trackLoading) {
          beginTaskLoading();
        }
        const snapshot = await requestStaticAnalysisTaskSnapshot({
          engine,
          taskId,
          loader,
        });
        if (requestSeq !== taskRequestSeqRef.current[engine]) {
          return;
        }
        assign(snapshot.data ?? null);
      } catch {
        if (requestSeq !== taskRequestSeqRef.current[engine]) {
          return;
        }
        if (!cachedSnapshot) {
          assign(null);
        }
        if (
          !silent &&
          (force || !cachedSnapshot || !isStaticAnalysisSnapshotReusable(cachedSnapshot))
        ) {
          toast.error(errorMessage);
        }
      } finally {
        if (trackLoading) {
          endTaskLoading();
        }
      }
    },
    [beginTaskLoading, endTaskLoading],
  );

  const loadOpengrepTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "opengrep",
        taskId: opengrepTaskId,
        silent,
        force,
        loader: getOpengrepScanTask,
        assign: setOpengrepTask,
        errorMessage: "加载 Opengrep 任务失败",
      });
    },
    [loadTask, opengrepTaskId],
  );

  const loadGitleaksTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "gitleaks",
        taskId: gitleaksTaskId,
        silent,
        force,
        loader: getGitleaksScanTask,
        assign: setGitleaksTask,
        errorMessage: "加载 Gitleaks 任务失败",
      });
    },
    [gitleaksTaskId, loadTask],
  );

  const loadBanditTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "bandit",
        taskId: banditTaskId,
        silent,
        force,
        loader: getBanditScanTask,
        assign: setBanditTask,
        errorMessage: "加载 Bandit 任务失败",
      });
    },
    [banditTaskId, loadTask],
  );

  const loadPhpstanTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "phpstan",
        taskId: phpstanTaskId,
        silent,
        force,
        loader: getPhpstanScanTask,
        assign: setPhpstanTask,
        errorMessage: "加载 PHPStan 任务失败",
      });
    },
    [loadTask, phpstanTaskId],
  );

  const loadPmdTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "pmd",
        taskId: pmdTaskId,
        silent,
        force,
        loader: getPmdScanTask,
        assign: setPmdTask,
        errorMessage: "加载 PMD 任务失败",
      });
    },
    [loadTask, pmdTaskId],
  );

  const loadYasaTask = useCallback(
    async (silent = false, force = false) => {
      await loadTask({
        engine: "yasa",
        taskId: yasaTaskId,
        silent,
        force,
        loader: getYasaScanTask,
        assign: setYasaTask,
        errorMessage: "加载 YASA 任务失败",
      });
    },
    [loadTask, yasaTaskId],
  );

  const fetchUnifiedFindingsPage = useCallback(
    async (
      query: UnifiedStaticFindingsQuery,
    ): Promise<{ items: UnifiedFindingRow[]; total: number }> => {
      try {
        const response = await getUnifiedStaticFindings(query);
        return {
          items: response.items.map((item) => mapUnifiedFindingItemToRow(item)),
          total: response.total,
        };
      } catch (error) {
        if (shouldFallbackToLegacyUnifiedFindings(error)) {
          console.warn(
            "[StaticAnalysis] Unified findings endpoint unavailable, using legacy findings fallback.",
            error,
          );
          return getLegacyUnifiedFindingsFallback(query);
        }
        throw error;
      }
    },
    [],
  );

  const loadUnifiedFindings = useCallback(
    async (
      query: UnifiedStaticFindingsQuery,
      options?: { silent?: boolean; force?: boolean },
    ) => {
      const silent = Boolean(options?.silent);
      const force = Boolean(options?.force);
      unifiedQueryRef.current = query;

      if (!hasEnabledEngine) {
        setUnifiedRows([]);
        setUnifiedTotal(0);
        setLoadingFindings(false);
        return;
      }

      const requestSeq = unifiedRequestSeqRef.current + 1;
      unifiedRequestSeqRef.current = requestSeq;

      const cachedSnapshot = getStaticAnalysisFindingsSnapshot(query);
      if (cachedSnapshot) {
        setUnifiedRows(cachedSnapshot.data.items);
        setUnifiedTotal(cachedSnapshot.data.total);
        setLoadingFindings(false);
        if (!force && isStaticAnalysisSnapshotFresh(cachedSnapshot)) {
          return;
        }
      }

      const showLoading =
        !silent &&
        (force || !cachedSnapshot || !isStaticAnalysisSnapshotReusable(cachedSnapshot));

      try {
        if (showLoading) {
          setLoadingFindings(true);
        }
        const snapshot = await requestStaticAnalysisFindingsSnapshot({
          query,
          loader: fetchUnifiedFindingsPage,
        });
        if (requestSeq !== unifiedRequestSeqRef.current) {
          return;
        }
        setUnifiedRows(snapshot.data.items);
        setUnifiedTotal(snapshot.data.total);
      } catch {
        if (requestSeq !== unifiedRequestSeqRef.current) {
          return;
        }
        if (!cachedSnapshot) {
          setUnifiedRows([]);
          setUnifiedTotal(0);
        }
        if (
          !silent &&
          (force || !cachedSnapshot || !isStaticAnalysisSnapshotReusable(cachedSnapshot))
        ) {
          toast.error("加载漏洞列表失败");
        }
      } finally {
        if (showLoading && requestSeq === unifiedRequestSeqRef.current) {
          setLoadingFindings(false);
        }
      }
    },
    [fetchUnifiedFindingsPage, hasEnabledEngine],
  );

  const refreshTasks = useCallback(
    async (silent = false, force = false) => {
      if (!hasEnabledEngine) {
        setLoadingInitial(false);
        return;
      }

      const hasHydratedTaskData =
        hasCachedTaskSnapshot("opengrep", opengrepTaskId) &&
        hasCachedTaskSnapshot("gitleaks", gitleaksTaskId) &&
        hasCachedTaskSnapshot("bandit", banditTaskId) &&
        hasCachedTaskSnapshot("phpstan", phpstanTaskId) &&
        hasCachedTaskSnapshot("pmd", pmdTaskId) &&
        hasCachedTaskSnapshot("yasa", yasaTaskId);

      if (!silent && !hasHydratedTaskData) {
        setLoadingInitial(true);
      }

      try {
        await Promise.all([
          loadOpengrepTask(silent, force),
          loadGitleaksTask(silent, force),
          loadBanditTask(silent, force),
          loadPhpstanTask(silent, force),
          loadPmdTask(silent, force),
          loadYasaTask(silent, force),
        ]);
      } finally {
        if (!silent) {
          setLoadingInitial(false);
        }
      }
    },
    [
      banditTaskId,
      gitleaksTaskId,
      hasEnabledEngine,
      loadBanditTask,
      loadGitleaksTask,
      loadOpengrepTask,
      loadPhpstanTask,
      loadPmdTask,
      loadYasaTask,
      opengrepTaskId,
      phpstanTaskId,
      pmdTaskId,
      yasaTaskId,
    ],
  );

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!hasEnabledEngine) {
        setUnifiedRows([]);
        setUnifiedTotal(0);
        setLoadingInitial(false);
        setLoadingFindings(false);
        return;
      }

      await Promise.all([
        refreshTasks(silent, true),
        loadUnifiedFindings(unifiedQueryRef.current, { silent, force: true }),
      ]);
    },
    [hasEnabledEngine, loadUnifiedFindings, refreshTasks],
  );

  const refreshOpengrepSilently = useCallback(async () => {
    if (!opengrepTaskId || opengrepSilentRefreshRef.current) return;
    opengrepSilentRefreshRef.current = true;
    try {
      await loadOpengrepTask(true, true);
    } finally {
      opengrepSilentRefreshRef.current = false;
    }
  }, [loadOpengrepTask, opengrepTaskId]);

  const refreshGitleaksSilently = useCallback(async () => {
    if (!gitleaksTaskId || gitleaksSilentRefreshRef.current) return;
    gitleaksSilentRefreshRef.current = true;
    try {
      await loadGitleaksTask(true, true);
    } finally {
      gitleaksSilentRefreshRef.current = false;
    }
  }, [gitleaksTaskId, loadGitleaksTask]);

  const refreshBanditSilently = useCallback(async () => {
    if (!banditTaskId || banditSilentRefreshRef.current) return;
    banditSilentRefreshRef.current = true;
    try {
      await loadBanditTask(true, true);
    } finally {
      banditSilentRefreshRef.current = false;
    }
  }, [banditTaskId, loadBanditTask]);

  const refreshPhpstanSilently = useCallback(async () => {
    if (!phpstanTaskId || phpstanSilentRefreshRef.current) return;
    phpstanSilentRefreshRef.current = true;
    try {
      await loadPhpstanTask(true, true);
    } finally {
      phpstanSilentRefreshRef.current = false;
    }
  }, [loadPhpstanTask, phpstanTaskId]);

  const refreshPmdSilently = useCallback(async () => {
    if (!pmdTaskId || pmdSilentRefreshRef.current) return;
    pmdSilentRefreshRef.current = true;
    try {
      await loadPmdTask(true, true);
    } finally {
      pmdSilentRefreshRef.current = false;
    }
  }, [loadPmdTask, pmdTaskId]);

  const refreshYasaSilently = useCallback(async () => {
    if (!yasaTaskId || yasaSilentRefreshRef.current) return;
    yasaSilentRefreshRef.current = true;
    try {
      await loadYasaTask(true, true);
    } finally {
      yasaSilentRefreshRef.current = false;
    }
  }, [loadYasaTask, yasaTaskId]);

  const handleInterrupt = useCallback(async () => {
    if (!interruptTarget) return;
    setInterrupting(true);
    try {
      if (interruptTarget === "opengrep" && opengrepTaskId) {
        await interruptOpengrepScanTask(opengrepTaskId);
        toast.success("Opengrep 任务已中止");
      }
      if (interruptTarget === "gitleaks" && gitleaksTaskId) {
        await interruptGitleaksScanTask(gitleaksTaskId);
        toast.success("Gitleaks 任务已中止");
      }
      if (interruptTarget === "bandit" && banditTaskId) {
        await interruptBanditScanTask(banditTaskId);
        toast.success("Bandit 任务已中止");
      }
      if (interruptTarget === "phpstan" && phpstanTaskId) {
        await interruptPhpstanScanTask(phpstanTaskId);
        toast.success("PHPStan 任务已中止");
      }
      if (interruptTarget === "pmd" && pmdTaskId) {
        await interruptPmdScanTask(pmdTaskId);
        toast.success("PMD 任务已中止");
      }
      if (interruptTarget === "yasa" && yasaTaskId) {
        await interruptYasaScanTask(yasaTaskId);
        toast.success("YASA 任务已中止");
      }
      await refreshAll(true);
    } catch {
      toast.error("中止任务失败");
    } finally {
      setInterrupting(false);
      setInterruptTarget(null);
    }
  }, [
    banditTaskId,
    gitleaksTaskId,
    interruptTarget,
    opengrepTaskId,
    phpstanTaskId,
    pmdTaskId,
    refreshAll,
    yasaTaskId,
  ]);

  const handleToggleStatus = useCallback(
    async (row: UnifiedFindingRow, target: FindingStatus) => {
      const currentStatus = String(row.status || "open").toLowerCase();
      const nextStatus: FindingStatus = currentStatus === target ? "open" : target;
      const updateKey = `${row.engine}:${row.id}:${target}`;
      setUpdatingKey(updateKey);
      try {
        if (row.engine === "opengrep") {
          await updateOpengrepFindingStatus({
            findingId: row.id,
            status: nextStatus,
          });
        } else if (row.engine === "gitleaks") {
          await updateGitleaksFindingStatus({
            findingId: row.id,
            status: nextStatus,
          });
        } else if (row.engine === "bandit") {
          await updateBanditFindingStatus({
            findingId: row.id,
            status: nextStatus,
          });
        } else if (row.engine === "phpstan") {
          await updatePhpstanFindingStatus({
            findingId: row.id,
            status: nextStatus,
          });
        } else if (row.engine === "pmd") {
          await updatePmdFindingStatus(row.id, nextStatus);
        } else {
          await updateYasaFindingStatus({
            findingId: row.id,
            status: nextStatus,
          });
        }
        await loadUnifiedFindings(unifiedQueryRef.current, {
          silent: true,
          force: true,
        });
      } catch {
        toast.error("更新状态失败");
      } finally {
        setUpdatingKey(null);
      }
    },
    [loadUnifiedFindings],
  );

  useEffect(() => {
    void refreshTasks(false, false);
  }, [refreshTasks]);

  useEffect(() => {
    unifiedQueryRef.current = unifiedQuery;
    void loadUnifiedFindings(unifiedQuery, { silent: false, force: false });
  }, [loadUnifiedFindings, unifiedQuery]);

  useEffect(() => {
    if (!opengrepTaskId || !isStaticAnalysisPollableStatus(opengrepTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshOpengrepSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [opengrepTask?.status, opengrepTaskId, refreshOpengrepSilently]);

  useEffect(() => {
    if (!gitleaksTaskId || !isStaticAnalysisPollableStatus(gitleaksTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshGitleaksSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [gitleaksTask?.status, gitleaksTaskId, refreshGitleaksSilently]);

  useEffect(() => {
    if (!banditTaskId || !isStaticAnalysisPollableStatus(banditTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshBanditSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [banditTask?.status, banditTaskId, refreshBanditSilently]);

  useEffect(() => {
    if (!phpstanTaskId || !isStaticAnalysisPollableStatus(phpstanTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshPhpstanSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [phpstanTask?.status, phpstanTaskId, refreshPhpstanSilently]);

  useEffect(() => {
    if (!pmdTaskId || !isStaticAnalysisPollableStatus(pmdTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshPmdSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [pmdTask?.status, pmdTaskId, refreshPmdSilently]);

  useEffect(() => {
    if (!yasaTaskId || !isStaticAnalysisPollableStatus(yasaTask?.status)) {
      return;
    }
    const timer = setInterval(() => {
      void refreshYasaSilently();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshYasaSilently, yasaTask?.status, yasaTaskId]);

  return {
    opengrepTask,
    gitleaksTask,
    banditTask,
    phpstanTask,
    pmdTask,
    yasaTask,
    unifiedRows,
    unifiedTotal,
    loadingInitial,
    loadingTask,
    loadingFindings,
    updatingKey,
    interruptTarget,
    setInterruptTarget,
    interrupting,
    refreshAll,
    handleInterrupt,
    handleToggleStatus,
    canInterruptOpengrep: Boolean(
      opengrepTaskId && isStaticAnalysisInterruptibleStatus(opengrepTask?.status),
    ),
    canInterruptGitleaks: Boolean(
      gitleaksTaskId && isStaticAnalysisInterruptibleStatus(gitleaksTask?.status),
    ),
    canInterruptBandit: Boolean(
      banditTaskId && isStaticAnalysisInterruptibleStatus(banditTask?.status),
    ),
    canInterruptPhpstan: Boolean(
      phpstanTaskId && isStaticAnalysisInterruptibleStatus(phpstanTask?.status),
    ),
    canInterruptPmd: Boolean(
      pmdTaskId && isStaticAnalysisInterruptibleStatus(pmdTask?.status),
    ),
    canInterruptYasa: Boolean(
      yasaTaskId && isStaticAnalysisInterruptibleStatus(yasaTask?.status),
    ),
  };
}
