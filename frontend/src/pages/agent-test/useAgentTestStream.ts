import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { AgentType, QueueInfo, QueueSnapshot, SseEvent } from "./types";

const API_BASE = "/api/v1/agent-test";

export function useAgentTestStream() {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<QueueSnapshot>({});
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  const run = useCallback(async (agentType: AgentType, body: object) => {
    if (running) return;

    setEvents([]);
    setResult(null);
    setQueueSnapshot({});
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/${agentType}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = errText;
        try {
          detail = JSON.parse(errText)?.detail ?? errText;
        } catch {
          // noop
        }
        toast.error(`请求失败: ${detail}`);
        setRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        toast.error("响应流不可用");
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let data = "";
          for (const line of lines) {
            if (line.startsWith("data:")) {
              data = line.slice(5).trim();
            }
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as SseEvent & { queues?: QueueSnapshot };
            const ev = { ...parsed, id: idRef.current++ };
            if (ev.type === "result") {
              setResult(ev.data);
            } else if (ev.type === "queue_snapshot" && parsed.queues) {
              const merged: QueueSnapshot = {};
              for (const [key, info] of Object.entries(parsed.queues) as [
                string,
                QueueInfo,
              ][]) {
                merged[key as keyof QueueSnapshot] = {
                  ...info,
                  allItems: info.peek ?? [],
                };
              }
              setQueueSnapshot(merged);
              continue;
            }
            setEvents((prev) => [...prev, ev]);
          } catch {
            // skip bad json
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        toast.error(`连接错误: ${(err as Error)?.message}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setResult(null);
    setQueueSnapshot({});
  }, []);

  return { events, running, result, queueSnapshot, run, stop, clear };
}
