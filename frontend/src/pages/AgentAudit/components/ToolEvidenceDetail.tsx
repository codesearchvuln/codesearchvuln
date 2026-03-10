import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import FindingCodeWindow from "./FindingCodeWindow";
import type {
  ToolEvidenceCodeWindowEntry,
  ToolEvidencePayload,
  ToolEvidenceSearchHitEntry,
} from "../toolEvidence";
import { isToolEvidenceCapableTool, toolEvidenceLinesToCode } from "../toolEvidence";

function UnsupportedProtocol({
  rawOutput,
}: {
  rawOutput: unknown;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
        旧版工具结果协议，无法在新版证据视图中展示
      </div>
      <details className="rounded-lg border border-border bg-background/70">
        <summary className="cursor-pointer px-4 py-3 text-sm text-primary">查看原始 JSON</summary>
        <pre className="border-t border-border px-4 py-3 text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(rawOutput ?? null, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SearchHitDetail({ entry }: { entry: ToolEvidenceSearchHitEntry }) {
  return (
    <FindingCodeWindow
      code={toolEvidenceLinesToCode(entry.lines)}
      filePath={entry.filePath}
      lineStart={entry.windowStartLine}
      lineEnd={entry.windowEndLine}
      highlightStartLine={entry.matchLine}
      highlightEndLine={entry.matchLine}
      focusLine={entry.matchLine}
      title="命中窗口"
      variant="detail"
    />
  );
}

function CodeWindowDetail({ entry }: { entry: ToolEvidenceCodeWindowEntry }) {
  return (
    <FindingCodeWindow
      code={toolEvidenceLinesToCode(entry.lines)}
      filePath={entry.filePath}
      lineStart={entry.startLine}
      lineEnd={entry.endLine}
      highlightStartLine={entry.focusLine}
      highlightEndLine={entry.focusLine}
      focusLine={entry.focusLine}
      title="代码窗口"
      variant="detail"
    />
  );
}

export default function ToolEvidenceDetail({
  toolName,
  evidence,
  rawOutput,
}: {
  toolName?: string | null;
  evidence: ToolEvidencePayload | null;
  rawOutput: unknown;
}) {
  const activeCapableTool = isToolEvidenceCapableTool(toolName);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSearchEntry = useMemo(() => {
    if (!evidence || evidence.renderType !== "search_hits") return null;
    return evidence.entries[Math.max(0, Math.min(activeIndex, evidence.entries.length - 1))] || null;
  }, [activeIndex, evidence]);

  if (!evidence) {
    return activeCapableTool ? <UnsupportedProtocol rawOutput={rawOutput} /> : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          {evidence.displayCommand}
        </Badge>
        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {evidence.renderType === "search_hits" ? `${evidence.entries.length} 条命中` : `${evidence.entries.length} 个窗口`}
        </span>
      </div>

      {evidence.renderType === "search_hits" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {evidence.entries.map((entry, index) => (
              <button
                key={`${entry.filePath}-${entry.matchLine}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  index === activeIndex
                    ? "border-cyan-500/50 bg-cyan-500/10 text-foreground"
                    : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="text-xs font-mono">{entry.filePath}:{entry.matchLine}</div>
                <div className="mt-1 text-sm">{entry.matchText || "命中代码"}</div>
              </button>
            ))}
          </div>
          {activeSearchEntry ? <SearchHitDetail entry={activeSearchEntry} /> : null}
        </>
      ) : (
        evidence.entries.map((entry) => (
          <CodeWindowDetail
            key={`${entry.filePath}-${entry.startLine}-${entry.endLine}`}
            entry={entry}
          />
        ))
      )}
    </div>
  );
}
