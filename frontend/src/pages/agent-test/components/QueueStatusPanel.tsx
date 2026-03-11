import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QueuePeekItem, QueueSnapshot } from "../types";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  info: "text-slate-400",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-950/40 border-red-800/40",
  high: "bg-orange-950/40 border-orange-800/40",
  medium: "bg-yellow-950/40 border-yellow-800/40",
  low: "bg-blue-950/40 border-blue-800/40",
  info: "bg-slate-900/40 border-slate-700/40",
};

function QueueItemDetail({
  item,
  index,
}: {
  item: QueuePeekItem;
  index: number;
}) {
  const sev = item.severity.toLowerCase();
  return (
    <div
      className={`rounded border p-2 text-[11px] space-y-1 ${
        SEVERITY_BG[sev] ?? "bg-muted/20 border-border/40"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground/50 shrink-0">#{index + 1}</span>
        <span
          className={`font-semibold shrink-0 ${
            SEVERITY_COLORS[sev] ?? "text-foreground/60"
          }`}
        >
          [{item.severity.toUpperCase()}]
        </span>
        <span className="font-medium text-foreground/90 truncate">{item.title}</span>
      </div>
      {item.vulnerability_type && (
        <div className="flex gap-1 text-muted-foreground/60">
          <span className="shrink-0">类型:</span>
          <span className="text-cyan-400/80 font-mono">
            {item.vulnerability_type}
          </span>
        </div>
      )}
      {item.file_path && (
        <div className="flex gap-1 text-muted-foreground/60">
          <span className="shrink-0">位置:</span>
          <span className="font-mono text-foreground/70 truncate">
            {item.file_path}
            {item.line_start != null ? `:${item.line_start}` : ""}
          </span>
        </div>
      )}
      {item.confidence != null && (
        <div className="flex gap-1 text-muted-foreground/60">
          <span className="shrink-0">置信度:</span>
          <span className="text-foreground/70">
            {(item.confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
      {item.description && (
        <div className="text-muted-foreground/70 leading-relaxed">
          {item.description}
        </div>
      )}
    </div>
  );
}

export default function QueueStatusPanel({
  snapshot,
}: {
  snapshot: QueueSnapshot;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});

  const pageSize = 10;
  const entries = Object.entries(snapshot).filter(([, info]) => info !== undefined);
  if (entries.length === 0) return null;

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="flex gap-3 flex-wrap mb-3">
      {entries.map(([key, info]) => {
        if (!info) return null;
        const isExpanded = expandedKey === key;
        const allItems = info.allItems ?? info.peek;
        const currentPage = pages[key] ?? 0;
        const totalPages = Math.ceil(allItems.length / pageSize);
        const pageItems = allItems.slice(
          currentPage * pageSize,
          (currentPage + 1) * pageSize,
        );

        const goPage = (page: number) => {
          setPages((prev) => ({ ...prev, [key]: page }));
        };

        return (
          <div
            key={key}
            className="flex-1 min-w-[220px] rounded border border-border/40 bg-muted/20 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
            >
              <Database className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground flex-1">
                {info.label}
              </span>
              <Badge
                variant="outline"
                className="text-cyan-400 border-cyan-800 text-[10px] px-1.5 py-0 shrink-0"
              >
                {info.size} 条
              </Badge>
              {allItems.length > 0 &&
                (isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                ))}
            </button>

            {!isExpanded && allItems.length > 0 && (
              <div className="px-3 pb-2 space-y-0.5">
                {allItems.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`shrink-0 font-bold ${
                        SEVERITY_COLORS[item.severity.toLowerCase()] ??
                        "text-foreground/60"
                      }`}
                    >
                      [{item.severity.toUpperCase().slice(0, 4)}]
                    </span>
                    <span className="text-foreground/70 truncate">{item.title}</span>
                  </div>
                ))}
                {allItems.length > 3 && (
                  <p className="text-[10px] text-muted-foreground/40 pt-0.5">
                    还有 {allItems.length - 3} 条…点击展开查看全部
                  </p>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {allItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 py-1">
                    队列为空
                  </p>
                ) : (
                  <>
                    <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                      {pageItems.map((item, index) => (
                        <QueueItemDetail
                          key={index}
                          item={item}
                          index={currentPage * pageSize + index}
                        />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          disabled={currentPage === 0}
                          onClick={() => goPage(currentPage - 1)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp className="w-3 h-3 rotate-[-90deg]" />
                          上一页
                        </button>
                        <span className="text-[10px] text-muted-foreground/50">
                          {currentPage + 1} / {totalPages}（已收集 {allItems.length} 条）
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages - 1}
                          onClick={() => goPage(currentPage + 1)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          下一页
                          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                        </button>
                      </div>
                    )}

                    {totalPages <= 1 && info.size > allItems.length && (
                      <p className="text-[10px] text-muted-foreground/40">
                        已收集 {allItems.length} 条，队列总计 {info.size} 条
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
