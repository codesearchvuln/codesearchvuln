import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { SseEvent } from "../types";
import {
  AGENT_TEST_EVENT_COLORS,
  AGENT_TEST_EVENT_ICONS,
  formatAgentTestEventMessage,
  shouldShowAgentTestEvent,
} from "../eventLogUtils";

export default function EventLog({
  events,
  running,
}: {
  events: SseEvent[];
  running: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const userScrolledRef = useRef(false);

  const visibleEvents = events.filter(shouldShowAgentTestEvent);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [visibleEvents.length, autoScroll]);

  useEffect(() => {
    if (running) {
      setAutoScroll(true);
      userScrolledRef.current = false;
    }
  }, [running]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 40) {
      setAutoScroll(true);
      userScrolledRef.current = false;
    } else {
      userScrolledRef.current = true;
      setAutoScroll(false);
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[420px] w-full overflow-y-auto rounded border border-border/40 bg-black/60 font-mono text-xs"
      >
        <div className="p-3 space-y-0.5">
          {visibleEvents.length === 0 && (
            <p className="text-muted-foreground italic py-8 text-center">
              等待执行…点击「运行」启动 Agent
            </p>
          )}
          {visibleEvents.map((ev) => (
            <div
              key={ev.id}
              className={`flex gap-2 leading-relaxed ${
                AGENT_TEST_EVENT_COLORS[ev.type] ?? "text-foreground/60"
              }`}
            >
              <span className="shrink-0 w-4 text-center opacity-70">
                {AGENT_TEST_EVENT_ICONS[ev.type] ?? "·"}
              </span>
              <span className="shrink-0 text-muted-foreground/40">
                [{new Date(ev.ts * 1000).toLocaleTimeString()}]
              </span>
              <span className="break-all whitespace-pre-wrap">
                {formatAgentTestEventMessage(ev)}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {!autoScroll && visibleEvents.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-cyan-900/80 border border-cyan-700/60 px-2.5 py-1 text-[11px] text-cyan-300 shadow hover:bg-cyan-800/80 transition-colors"
        >
          <ArrowDown className="w-3 h-3" />
          跳到底部
        </button>
      )}
    </div>
  );
}
