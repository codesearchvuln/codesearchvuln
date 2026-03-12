import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { SkillTestEvent, SkillTestResult } from "./types";

export function useSkillTestStream(skillId: string) {
  const [events, setEvents] = useState<SkillTestEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SkillTestResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  const run = useCallback(
    async (prompt: string, maxIterations = 4) => {
      if (running || !skillId.trim()) return;

      setEvents([]);
      setResult(null);
      setRunning(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const response = await fetch(`/api/v1/skills/${encodeURIComponent(skillId)}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, max_iterations: maxIterations }),
          signal: ctrl.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          let detail = errText;
          try {
            detail = JSON.parse(errText)?.detail ?? errText;
          } catch {
            // noop
          }
          toast.error(`请求失败: ${detail}`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          toast.error("响应流不可用");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const dataLines = part
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());
            if (dataLines.length === 0) continue;
            try {
              const parsed = JSON.parse(dataLines.join("\n")) as Omit<SkillTestEvent, "id">;
              const event: SkillTestEvent = { ...parsed, id: idRef.current++ };
              if (event.type === "result" && event.data) {
                setResult(event.data as SkillTestResult);
              }
              setEvents((prev) => [...prev, event]);
            } catch {
              // skip bad json chunks
            }
          }
        }
      } catch (error: unknown) {
        if ((error as Error)?.name !== "AbortError") {
          toast.error(`连接错误: ${(error as Error)?.message}`);
        }
      } finally {
        abortRef.current = null;
        setRunning(false);
      }
    },
    [running, skillId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  return { events, running, result, run, stop };
}
