/**
 * Agent Audit Page - Modular Implementation
 * Main entry point for the Agent Audit feature
 * Cassette Futurism / Terminal Retro aesthetic
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Terminal,
  Bot,
  Loader2,
  Filter,
  ArrowDown,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useLogoVariant } from "@/shared/branding/useLogoVariant";
import {
  getAgentTask,
  getAgentFindings,
  cancelAgentTask,
  getAgentTree,
  getAgentEvents,
  AgentEvent,
} from "@/shared/api/agentTasks";
import CreateAgentTaskDialog from "@/components/agent/CreateAgentTaskDialog";

// Local imports
import {
  SplashScreen,
  Header,
  LogEntry,
  AgentTreeNodeItem,
  AgentDetailPanel,
  StatsPanel,
  FindingsPanel,
  AgentErrorBoundary,
} from "./components";
import ReportExportDialog from "./components/ReportExportDialog";
import { useAgentAuditState } from "./hooks";
import { ACTION_VERBS, POLLING_INTERVALS } from "./constants";
import { cleanThinkingContent } from "./utils";

const EVENT_PAGE_SIZE = 500;
const EVENT_BATCH_SAFETY_LIMIT = 200;
const FINDINGS_REFRESH_INTERVAL = 10000;

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "aborted",
  "interrupted",
]);

const PROGRESS_PATTERNS: { pattern: RegExp; key: string }[] = [
  { pattern: /索引进度[:：]?\s*\d+\/\d+/, key: "index_progress" },
  { pattern: /克隆进度[:：]?\s*\d+%/, key: "clone_progress" },
  { pattern: /下载进度[:：]?\s*\d+%/, key: "download_progress" },
  { pattern: /上传进度[:：]?\s*\d+%/, key: "upload_progress" },
  { pattern: /扫描进度[:：]?\s*\d+/, key: "scan_progress" },
  { pattern: /分析进度[:：]?\s*\d+/, key: "analyze_progress" },
];

type UnifiedAgentEvent = {
  type?: string;
  event_type?: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  sequence?: number;
  status?: string;
  tool_name?: string | null;
  tool_input?: unknown;
  tool_output?: unknown;
  tool_duration_ms?: number | null;
};

function matchProgressKey(message: string): string | null {
  const matched = PROGRESS_PATTERNS.find((item) => item.pattern.test(message));
  return matched?.key ?? null;
}

function eventToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function AgentAuditPageContent() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    task,
    findings,
    agentTree,
    logs,
    selectedAgentId,
    showAllLogs,
    isLoading,
    isAutoScroll,
    expandedLogIds,
    treeNodes,
    filteredLogs,
    isRunning,
    isComplete,
    setTask,
    setFindings,
    setAgentTree,
    addLog,
    updateLog,
    removeLog,
    selectAgent,
    setLoading,
    setAutoScroll,
    toggleLogExpanded,
    setCurrentAgentName,
    getCurrentAgentName,
    setCurrentThinkingId,
    getCurrentThinkingId,
    dispatch,
    reset,
  } = useAgentAuditState();

  // Local state
  const [showSplash, setShowSplash] = useState(!taskId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusVerb, setStatusVerb] = useState(ACTION_VERBS[0]);
  const [statusDots, setStatusDots] = useState(0);
  const [activeMainTab, setActiveMainTab] = useState<"logs" | "findings">(
    "logs",
  );
  const [isFindingsLoading, setIsFindingsLoading] = useState(false);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const agentTreeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastAgentTreeRefreshTime = useRef<number>(0);
  const previousTaskIdRef = useRef<string | undefined>(undefined);
  const disconnectStreamRef = useRef<(() => void) | null>(null);
  const lastEventSequenceRef = useRef<number>(0);
  const hasConnectedRef = useRef<boolean>(false); // 🔥 追踪是否已连接 SSE
  const hasLoadedHistoricalEventsRef = useRef<boolean>(false); // 🔥 追踪是否已加载历史事件
  const isBackfillingRef = useRef(false);
  const previousTaskStatusRef = useRef<string | undefined>(undefined);
  // 🔥 使用 state 来标记历史事件加载状态和触发 streamOptions 重新计算
  const [afterSequence, setAfterSequence] = useState<number>(0);
  const [historicalEventsLoaded, setHistoricalEventsLoaded] =
    useState<boolean>(false);
  const { logoSrc, cycleLogoVariant } = useLogoVariant();

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/dashboard");
  }, [navigate]);
  // 🔥 当 taskId 变化时立即重置状态（新建任务时清理旧日志）
  useEffect(() => {
    // 如果 taskId 发生变化，立即重置
    if (taskId !== previousTaskIdRef.current) {
      // 1. 先断开旧的 SSE 流连接
      if (disconnectStreamRef.current) {
        disconnectStreamRef.current();
        disconnectStreamRef.current = null;
      }
      // 2. 重置所有状态
      reset();
      setShowSplash(!taskId);
      // 3. 重置事件序列号和加载状态
      lastEventSequenceRef.current = 0;
      hasConnectedRef.current = false; // 🔥 重置 SSE 连接标志
      hasLoadedHistoricalEventsRef.current = false; // 🔥 重置历史事件加载标志
      isBackfillingRef.current = false;
      previousTaskStatusRef.current = undefined;
      setHistoricalEventsLoaded(false); // 🔥 重置历史事件加载状态
      setAfterSequence(0); // 🔥 重置 afterSequence state
      setActiveMainTab("logs");
      setFindingsError(null);
      setIsFindingsLoading(false);
    }
    previousTaskIdRef.current = taskId;
  }, [taskId, reset]);

  // ============ Data Loading ============

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTask(taskId);
      setTask(data);
    } catch {
      toast.error("加载任务失败");
    }
  }, [taskId, setTask]);

  const loadFindings = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!taskId) return;
      const silent = options?.silent ?? false;
      if (!silent) {
        setIsFindingsLoading(true);
      }
      setFindingsError(null);
      try {
        const data = await getAgentFindings(taskId);
        setFindings(data);
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "加载审计结果失败";
        setFindingsError(message);
      } finally {
        if (!silent) {
          setIsFindingsLoading(false);
        }
      }
    },
    [taskId, setFindings],
  );

  const loadAgentTree = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTree(taskId);
      setAgentTree(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId, setAgentTree]);

  const debouncedLoadAgentTree = useCallback(() => {
    const now = Date.now();
    const minInterval = POLLING_INTERVALS.AGENT_TREE_DEBOUNCE;

    if (agentTreeRefreshTimer.current) {
      clearTimeout(agentTreeRefreshTimer.current);
    }

    const timeSinceLastRefresh = now - lastAgentTreeRefreshTime.current;
    if (timeSinceLastRefresh < minInterval) {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, minInterval - timeSinceLastRefresh);
    } else {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, POLLING_INTERVALS.AGENT_TREE_MIN_DELAY);
    }
  }, [loadAgentTree]);

  const fetchAllHistoricalEvents = useCallback(
    async (targetTaskId: string, startAfter = 0): Promise<AgentEvent[]> => {
      let afterSequenceCursor = startAfter;
      const allEvents: AgentEvent[] = [];

      for (let batch = 0; batch < EVENT_BATCH_SAFETY_LIMIT; batch += 1) {
        const page = await getAgentEvents(targetTaskId, {
          after_sequence: afterSequenceCursor,
          limit: EVENT_PAGE_SIZE,
        });
        if (!page.length) {
          break;
        }
        page.sort((a, b) => a.sequence - b.sequence);
        allEvents.push(...page);
        afterSequenceCursor = page[page.length - 1].sequence;

        if (page.length < EVENT_PAGE_SIZE) {
          break;
        }
      }

      return allEvents;
    },
    [],
  );

  const appendLogFromEvent = useCallback(
    (event: UnifiedAgentEvent) => {
      const eventType = String(
        event.event_type ?? event.type ?? "",
      ).toLowerCase();
      const message = eventToString(event.message).trim();
      const metadata = event.metadata ?? undefined;
      const agentName =
        (typeof metadata?.agent_name === "string" && metadata.agent_name) ||
        (typeof metadata?.agent === "string" && metadata.agent) ||
        undefined;

      if (typeof event.sequence === "number") {
        lastEventSequenceRef.current = Math.max(
          lastEventSequenceRef.current,
          event.sequence,
        );
      }

      if (eventType === "heartbeat") {
        return;
      }

      if (
        eventType === "thinking_start" ||
        eventType === "thinking_end" ||
        eventType === "thinking_token"
      ) {
        return;
      }

      if (eventType.startsWith("llm_") || eventType === "thinking") {
        const content = message || eventToString(metadata?.thought);
        if (!content) {
          return;
        }
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "thinking",
            title:
              content.length > 100 ? `${content.slice(0, 100)}...` : content,
            content,
            agentName,
          },
        });
        return;
      }

      if (eventType === "tool_call" || eventType === "tool_call_start") {
        const toolName = event.tool_name || "未知";
        const inputText = eventToString(event.tool_input);
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "tool",
            title: `工具：${toolName}`,
            content: inputText ? `输入：\n${inputText}` : "",
            tool: { name: toolName, status: "running" },
            agentName,
          },
        });
        return;
      }

      if (eventType === "tool_result" || eventType === "tool_call_end") {
        const toolName = event.tool_name || "未知";
        const outputText = eventToString(event.tool_output);
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "tool",
            title: `已完成：${toolName}`,
            content: outputText ? `输出：\n${outputText}` : "",
            tool: {
              name: toolName,
              duration: event.tool_duration_ms ?? 0,
              status: "completed",
            },
            agentName,
          },
        });
        return;
      }

      if (
        eventType === "finding" ||
        eventType === "finding_new" ||
        eventType === "finding_verified" ||
        eventType === "finding_update"
      ) {
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "finding",
            title: message || eventToString(metadata?.title) || "发现漏洞",
            severity: eventToString(metadata?.severity) || "medium",
            agentName,
          },
        });
        return;
      }

      if (
        eventType === "dispatch" ||
        eventType === "dispatch_complete" ||
        eventType === "node_start" ||
        eventType === "node_complete" ||
        eventType === "node_end" ||
        eventType === "phase_start" ||
        eventType === "phase_complete" ||
        eventType === "phase_end"
      ) {
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "dispatch",
            title: message || `事件：${eventType}`,
            agentName,
          },
        });
        debouncedLoadAgentTree();
        return;
      }

      if (eventType === "task_complete" || eventType === "complete") {
        dispatch({
          type: "ADD_LOG",
          payload: { type: "info", title: message || "任务已完成", agentName },
        });
        return;
      }
      if (eventType === "task_error") {
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "error",
            title: message || "任务执行出错",
            agentName,
          },
        });
        return;
      }
      if (eventType === "task_cancel") {
        dispatch({
          type: "ADD_LOG",
          payload: { type: "info", title: message || "任务已取消", agentName },
        });
        return;
      }
      if (eventType === "task_end") {
        const status = event.status ? `（${event.status}）` : "";
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "info",
            title: message || `任务流已结束${status}`,
            agentName,
          },
        });
        return;
      }

      if (
        eventType === "progress" ||
        eventType === "info" ||
        eventType === "warning" ||
        eventType === "error"
      ) {
        const fallback = message || eventType;
        const progressKey = matchProgressKey(fallback);
        if (progressKey) {
          dispatch({
            type: "UPDATE_OR_ADD_PROGRESS_LOG",
            payload: {
              progressKey,
              title: fallback,
              agentName,
            },
          });
          return;
        }

        dispatch({
          type: "ADD_LOG",
          payload: {
            type: eventType === "error" ? "error" : "info",
            title: fallback,
            agentName,
          },
        });
        return;
      }

      if (message) {
        dispatch({
          type: "ADD_LOG",
          payload: {
            type: "info",
            title: message,
            agentName,
          },
        });
      }
    },
    [debouncedLoadAgentTree, dispatch],
  );

  const backfillEventsSince = useCallback(
    async (startAfter: number, reason: string) => {
      if (!taskId || isBackfillingRef.current) return;
      isBackfillingRef.current = true;
      try {
        const events = await fetchAllHistoricalEvents(taskId, startAfter);
        if (events.length === 0) {
          return;
        }
        events.forEach((event) => appendLogFromEvent(event));
        const lastSequence = events[events.length - 1]?.sequence ?? startAfter;
        lastEventSequenceRef.current = Math.max(
          lastEventSequenceRef.current,
          lastSequence,
        );
        setAfterSequence(lastEventSequenceRef.current);
        console.log(
          `[AgentAudit] Backfilled ${events.length} events (${reason}), last sequence=${lastEventSequenceRef.current}`,
        );
      } catch (error) {
        console.error("[AgentAudit] Backfill events failed:", error);
      } finally {
        isBackfillingRef.current = false;
      }
    },
    [appendLogFromEvent, fetchAllHistoricalEvents, taskId],
  );

  // 🔥 NEW: 加载历史事件并转换为日志项
  const loadHistoricalEvents = useCallback(async () => {
    if (!taskId) return 0;

    if (hasLoadedHistoricalEventsRef.current) {
      console.log("[AgentAudit] Historical events already loaded, skipping");
      return 0;
    }
    hasLoadedHistoricalEventsRef.current = true;

    try {
      console.log(
        `[AgentAudit] Fetching full historical events for task ${taskId}...`,
      );
      const events = await fetchAllHistoricalEvents(taskId, 0);
      if (!events.length) {
        return 0;
      }
      events.forEach((event) => appendLogFromEvent(event));
      lastEventSequenceRef.current = Math.max(
        lastEventSequenceRef.current,
        events[events.length - 1].sequence,
      );
      setAfterSequence(lastEventSequenceRef.current);
      console.log(
        `[AgentAudit] Historical events loaded: ${events.length}, last sequence=${lastEventSequenceRef.current}`,
      );
      return events.length;
    } catch (err) {
      console.error("[AgentAudit] Failed to load historical events:", err);
      return 0;
    }
  }, [appendLogFromEvent, fetchAllHistoricalEvents, taskId]);

  // ============ Stream Event Handling ============

  const streamOptions = useMemo(
    () => ({
      includeThinking: true,
      includeToolCalls: true,
      afterSequence,
      onEvent: (event: UnifiedAgentEvent) => {
        if (event.metadata?.agent_name) {
          setCurrentAgentName(String(event.metadata.agent_name));
        }
        appendLogFromEvent(event);
        if (String(event.type ?? "").toLowerCase() === "task_end") {
          void backfillEventsSince(
            lastEventSequenceRef.current,
            "task_end_event",
          );
        }
      },
      onThinkingStart: () => {
        const currentId = getCurrentThinkingId();
        if (currentId) {
          updateLog(currentId, { isStreaming: false });
        }
        setCurrentThinkingId(null);
      },
      onThinkingToken: (_token: string, accumulated: string) => {
        if (!accumulated?.trim()) return;
        const cleanContent = cleanThinkingContent(accumulated);
        if (!cleanContent) return;

        const currentId = getCurrentThinkingId();
        if (!currentId) {
          // 预生成 ID，这样我们可以跟踪这个日志
          const newLogId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          dispatch({
            type: "ADD_LOG",
            payload: {
              id: newLogId,
              type: "thinking",
              title: "思考中...",
              content: cleanContent,
              isStreaming: true,
              agentName: getCurrentAgentName() || undefined,
            },
          });
          setCurrentThinkingId(newLogId);
        } else {
          updateLog(currentId, { content: cleanContent });
        }
      },
      onThinkingEnd: (response: string) => {
        const cleanResponse = cleanThinkingContent(response || "");
        const currentId = getCurrentThinkingId();

        if (!cleanResponse) {
          if (currentId) {
            removeLog(currentId);
          }
          setCurrentThinkingId(null);
          return;
        }

        if (currentId) {
          updateLog(currentId, {
            title:
              cleanResponse.slice(0, 100) +
              (cleanResponse.length > 100 ? "..." : ""),
            content: cleanResponse,
            isStreaming: false,
          });
          setCurrentThinkingId(null);
        }
      },
      onFinding: (finding: Record<string, unknown>) => {
        dispatch({
          type: "ADD_FINDING",
          payload: {
            id: (finding.id as string) || `finding-${Date.now()}`,
            title: (finding.title as string) || "发现漏洞",
            severity: (finding.severity as string) || "medium",
            vulnerability_type:
              (finding.vulnerability_type as string) || "unknown",
            file_path: finding.file_path as string,
            line_start: finding.line_start as number,
            description: finding.description as string,
            is_verified: (finding.is_verified as boolean) || false,
          },
        });
      },
      onComplete: () => {
        void backfillEventsSince(lastEventSequenceRef.current, "on_complete");
        void loadTask();
        void loadFindings({ silent: true });
        void loadAgentTree();
      },
      onError: (err: string) => {
        dispatch({
          type: "ADD_LOG",
          payload: { type: "error", title: `错误：${err}` },
        });
        void backfillEventsSince(lastEventSequenceRef.current, "on_error");
        void loadTask();
        void loadFindings({ silent: true });
      },
    }),
    [
      afterSequence,
      appendLogFromEvent,
      backfillEventsSince,
      dispatch,
      loadTask,
      loadFindings,
      loadAgentTree,
      updateLog,
      removeLog,
      getCurrentAgentName,
      getCurrentThinkingId,
      setCurrentAgentName,
      setCurrentThinkingId,
    ],
  );

  const {
    connect: connectStream,
    disconnect: disconnectStream,
    isConnected,
  } = useAgentStream(taskId || null, streamOptions);

  // 保存 disconnect 函数到 ref，以便在 taskId 变化时使用
  useEffect(() => {
    disconnectStreamRef.current = disconnectStream;
  }, [disconnectStream]);

  // ============ Effects ============

  // Status animation
  useEffect(() => {
    if (!isRunning) return;
    const dotTimer = setInterval(() => setStatusDots((d) => (d + 1) % 4), 500);
    const verbTimer = setInterval(() => {
      setStatusVerb(
        ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)],
      );
    }, 5000);
    return () => {
      clearInterval(dotTimer);
      clearInterval(verbTimer);
    };
  }, [isRunning]);

  // Initial load - 🔥 加载任务数据和历史事件
  useEffect(() => {
    if (!taskId) {
      setShowSplash(true);
      return;
    }
    setShowSplash(false);
    setLoading(true);
    setHistoricalEventsLoaded(false);

    const loadAllData = async () => {
      try {
        // 先加载任务基本信息
        await Promise.all([
          loadTask(),
          loadFindings({ silent: true }),
          loadAgentTree(),
        ]);

        // 🔥 加载历史事件 - 无论任务是否运行都需要加载
        const eventsLoaded = await loadHistoricalEvents();
        console.log(
          `[AgentAudit] Loaded ${eventsLoaded} historical events for task ${taskId}`,
        );

        // 标记历史事件已加载完成 (setAfterSequence 已在 loadHistoricalEvents 中调用)
        setHistoricalEventsLoaded(true);
      } catch (error) {
        console.error("[AgentAudit] Failed to load data:", error);
        setHistoricalEventsLoaded(true); // 即使出错也标记为完成，避免无限等待
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [
    taskId,
    loadTask,
    loadFindings,
    loadAgentTree,
    loadHistoricalEvents,
    setLoading,
  ]);

  // Stream connection - 🔥 在历史事件加载完成后连接
  useEffect(() => {
    // 等待历史事件加载完成，且任务正在运行
    if (!taskId || !task?.status || task.status !== "running") return;

    // 🔥 使用 state 变量确保在历史事件加载完成后才连接
    if (!historicalEventsLoaded) return;

    // 🔥 避免重复连接 - 只连接一次
    if (hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    console.log(
      `[AgentAudit] Connecting to stream (afterSequence will be passed via streamOptions)`,
    );
    connectStream();
    dispatch({
      type: "ADD_LOG",
      payload: { type: "info", title: "已连接审计事件流" },
    });

    return () => {
      console.log("[AgentAudit] Cleanup: disconnecting stream");
      disconnectStream();
    };
    // 🔥 CRITICAL FIX: 移除 afterSequence 依赖！
    // afterSequence 通过 streamOptions 传递，不需要在这里触发重连
    // 如果包含它，当 loadHistoricalEvents 更新 afterSequence 时会触发断开重连
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    taskId,
    task?.status,
    historicalEventsLoaded,
    connectStream,
    disconnectStream,
    dispatch,
  ]);

  // Polling
  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadAgentTree, POLLING_INTERVALS.AGENT_TREE);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadAgentTree]);

  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadTask, POLLING_INTERVALS.TASK_STATS);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadTask]);

  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(() => {
      void loadFindings({ silent: true });
    }, FINDINGS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadFindings]);

  useEffect(() => {
    const previousStatus = previousTaskStatusRef.current;
    const currentStatus = task?.status;
    if (
      previousStatus === "running" &&
      currentStatus &&
      TERMINAL_STATUSES.has(currentStatus)
    ) {
      void backfillEventsSince(
        lastEventSequenceRef.current,
        "status_transition_to_terminal",
      );
      void loadFindings({ silent: true });
    }
    previousTaskStatusRef.current = currentStatus;
  }, [task?.status, backfillEventsSince, loadFindings]);

  // Auto scroll
  useEffect(() => {
    if (isAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isAutoScroll]);

  // ============ Handlers ============

  const handleAgentSelect = useCallback(
    (agentId: string) => {
      if (selectedAgentId === agentId) {
        selectAgent(null);
      } else {
        selectAgent(agentId);
      }
    },
    [selectedAgentId, selectAgent],
  );

  const handleCancel = async () => {
    if (!taskId || isCancelling) return;
    setIsCancelling(true);
    dispatch({
      type: "ADD_LOG",
      payload: { type: "info", title: "正在请求中止任务..." },
    });

    try {
      await cancelAgentTask(taskId);
      toast.success("已提交中止请求");
      dispatch({
        type: "ADD_LOG",
        payload: { type: "info", title: "任务中止请求已确认" },
      });
      await loadTask();
      disconnectStream();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`中止任务失败：${errorMessage}`);
      dispatch({
        type: "ADD_LOG",
        payload: { type: "error", title: `中止失败：${errorMessage}` },
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportReport = () => {
    if (!task) return;
    setShowExportDialog(true);
  };

  // ============ Render ============

  if (showSplash && !taskId) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] bg-background flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-20" />
        <div className="absolute inset-0 vignette pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <button
            type="button"
            onClick={cycleLogoVariant}
            className="mx-auto mb-10 w-48 h-48 rounded-[2.5rem] border border-primary/40 bg-primary/10 flex items-center justify-center shadow-[0_0_48px_rgba(59,130,246,0.4)] cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
            title="点击切换 Logo"
          >
            <img
              src={logoSrc}
              alt="VulHunter"
              className="w-32 h-32 object-contain"
            />
          </button>

          <h1 className="text-6xl md:text-7xl font-mono font-bold tracking-wider text-foreground">
            VulHunter
          </h1>
          <p className="mt-6 text-2xl md:text-3xl text-muted-foreground leading-relaxed">
            面向代码安全与合规审计的智能分析平台。聚焦仓库级项目，
            提供任务编排、自动化审计与结果追踪，帮助团队更快定位风险与改进点。
          </p>
        </div>

        {/*
        <SplashScreen onComplete={() => setShowCreateDialog(true)} />
        <CreateAgentTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
        */}
      </div>
    );
  }

  if (isLoading && !task) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] bg-background flex items-center justify-center relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 cyber-grid opacity-30" />
        {/* Vignette */}
        <div className="absolute inset-0 vignette pointer-events-none" />
        <div className="flex items-center gap-3 text-muted-foreground relative z-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="font-mono text-sm tracking-wide">
            正在加载审计任务...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-background flex flex-col overflow-hidden relative">
      {/* Header */}
      <Header
        task={task}
        isRunning={isRunning}
        isCancelling={isCancelling}
        onBack={handleBack}
        onCancel={handleCancel}
        onExport={handleExportReport}
        onNewAudit={() => setShowCreateDialog(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Activity Log / Findings */}
        <div className="w-3/4 flex flex-col border-r border-border relative">
          <div className="flex-shrink-0 h-12 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMainTab("logs")}
                className={`h-8 px-3 rounded-md text-sm font-medium flex items-center gap-2 border transition-colors ${
                  activeMainTab === "logs"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Terminal className="w-4 h-4" />
                活动日志
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] bg-transparent border-current/30"
                >
                  {filteredLogs.length}
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab("findings")}
                className={`h-8 px-3 rounded-md text-sm font-medium flex items-center gap-2 border transition-colors ${
                  activeMainTab === "findings"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                审计结果
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] bg-transparent border-current/30"
                >
                  {findings.length}
                </Badge>
              </button>
              {activeMainTab === "logs" && isConnected && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                    实时
                  </span>
                </div>
              )}
            </div>

            {activeMainTab === "logs" ? (
              <button
                onClick={() => setAutoScroll(!isAutoScroll)}
                className={`
                    flex items-center gap-2 text-xs px-3 py-1.5 rounded-md font-mono uppercase tracking-wider
                    ${
                      isAutoScroll
                        ? "bg-primary/15 text-primary border border-primary/50"
                        : "text-muted-foreground hover:text-foreground border border-border hover:bg-muted"
                    }
                  `}
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>自动滚动</span>
              </button>
            ) : (
              <div className="text-xs text-muted-foreground font-mono">
                直接查看漏洞详情
              </div>
            )}
          </div>

          {activeMainTab === "logs" ? (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-muted/30">
              {selectedAgentId && !showAllLogs && (
                <div className="mb-4 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-sm text-primary">
                    <Filter className="w-3.5 h-3.5" />
                    <span className="font-medium">仅显示已选 Agent 的日志</span>
                  </div>
                  <button
                    onClick={() => selectAgent(null)}
                    className="text-xs text-muted-foreground hover:text-primary font-mono uppercase px-2 py-1 rounded hover:bg-primary/10"
                  >
                    清除过滤
                  </button>
                </div>
              )}

              {filteredLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {isRunning ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        <span className="text-sm font-mono tracking-wide">
                          {selectedAgentId && !showAllLogs
                            ? "等待已选 Agent 的活动日志..."
                            : "等待 Agent 活动日志..."}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-mono tracking-wide">
                        {selectedAgentId && !showAllLogs
                          ? "该 Agent 暂无活动"
                          : "暂无活动日志"}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((item) => (
                    <LogEntry
                      key={item.id}
                      item={item}
                      isExpanded={expandedLogIds.has(item.id)}
                      onToggle={() => toggleLogExpanded(item.id)}
                    />
                  ))}
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden bg-muted/30">
              <FindingsPanel
                findings={findings}
                loading={isFindingsLoading}
                error={findingsError}
                onRetry={() => {
                  void loadFindings();
                }}
              />
            </div>
          )}

          {/* Status bar */}
          {task && (
            <div className="flex-shrink-0 h-10 border-t border-border flex items-center justify-between px-5 text-xs bg-card relative overflow-hidden">
              {/* Progress bar background */}
              <div
                className="absolute inset-0 bg-primary/10"
                style={{ width: `${task.progress_percentage || 0}%` }}
              />

              <span className="relative z-10">
                {isRunning ? (
                  <span className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-mono font-semibold">
                      {statusVerb}
                      {".".repeat(statusDots)}
                    </span>
                  </span>
                ) : isComplete ? (
                  <span className="flex items-center gap-2 text-muted-foreground font-mono">
                    <span
                      className={`w-2 h-2 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}
                    />
                    审计
                    {task.status === "completed"
                      ? "已完成"
                      : task.status === "failed"
                        ? "失败"
                        : task.status === "cancelled"
                          ? "已取消"
                          : task.status === "aborted"
                            ? "已中止"
                            : task.status === "interrupted"
                              ? "已中断"
                              : "结束"}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-mono">就绪</span>
                )}
              </span>
              <div className="flex items-center gap-5 font-mono text-muted-foreground relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-primary font-bold text-sm">
                    {task.progress_percentage?.toFixed(0) || 0}
                  </span>
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-semibold">
                    {task.analyzed_files}
                  </span>
                  <span className="text-muted-foreground">
                    / {task.total_files}
                  </span>
                  <span className="text-muted-foreground text-xs">文件</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-semibold">
                    {task.tool_calls_count || 0}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    工具调用
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Agent Tree + Stats */}
        <div className="w-1/4 flex flex-col bg-background relative">
          {/* Agent Tree section */}
          <div className="flex-1 flex flex-col border-b border-border overflow-hidden">
            {/* Tree header */}
            <div className="flex-shrink-0 h-12 border-b border-border flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Bot className="w-4 h-4 text-violet-600 dark:text-violet-500" />
                <span className="uppercase font-bold tracking-wider text-foreground text-sm">
                  {selectedAgentId && !showAllLogs ? "Agent 详情" : "Agent 树"}
                </span>
                {!selectedAgentId && agentTree && (
                  <Badge
                    variant="outline"
                    className="h-5 px-2 text-xs border-violet-500/30 text-violet-600 dark:text-violet-500 font-mono bg-violet-500/10"
                  >
                    {agentTree.total_agents}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedAgentId && !showAllLogs && (
                  <button
                    onClick={() => selectAgent(null)}
                    className="text-xs text-primary hover:text-primary/80 font-mono uppercase px-2 py-1 rounded hover:bg-primary/10"
                  >
                    返回
                  </button>
                )}
                {!selectedAgentId &&
                  agentTree &&
                  agentTree.running_agents > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {agentTree.running_agents}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* Tree content or Agent Detail */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-muted/20">
              {selectedAgentId && !showAllLogs ? (
                /* Agent Detail Panel - 覆盖整个内容区域 */
                <AgentDetailPanel
                  agentId={selectedAgentId}
                  treeNodes={treeNodes}
                  onClose={() => selectAgent(null)}
                />
              ) : treeNodes.length > 0 ? (
                <div className="space-y-0.5">
                  {treeNodes.map((node) => (
                    <AgentTreeNodeItem
                      key={node.agent_id}
                      node={node}
                      selectedId={selectedAgentId}
                      onSelect={handleAgentSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-3 p-6">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-600 dark:text-violet-500" />
                      <span className="font-mono text-center">
                        正在初始化
                        <br />
                        AGENT...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-6 text-center">
                      <Bot className="w-8 h-8 text-muted-foreground/50" />
                      <span className="font-mono">暂无 AGENT</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom section - Stats */}
          <div className="flex-shrink-0 p-4 bg-card">
            <StatsPanel task={task} findings={findings} />
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <CreateAgentTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Export dialog */}
      <ReportExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        task={task}
        findings={findings}
      />
    </div>
  );
}

// Wrapped export with Error Boundary
export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <AgentErrorBoundary
      taskId={taskId}
      onRetry={() => window.location.reload()}
    >
      <AgentAuditPageContent />
    </AgentErrorBoundary>
  );
}
