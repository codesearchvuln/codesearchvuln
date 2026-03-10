import { Badge } from "@/components/ui/badge";
import type { ToolEvidencePayload } from "../toolEvidence";

function buildSearchLocationSummary(evidence: Extract<ToolEvidencePayload, { renderType: "search_hits" }>) {
  const first = evidence.entries[0];
  if (!first) return "暂无命中";
  return `${first.filePath}:${first.matchLine}`;
}

function buildCodeLocationSummary(evidence: Extract<ToolEvidencePayload, { renderType: "code_window" }>) {
  const first = evidence.entries[0];
  if (!first) return "暂无窗口";
  return `${first.filePath}:${first.startLine}-${first.endLine}`;
}

export default function ToolEvidencePreview({
  evidence,
}: {
  evidence: ToolEvidencePayload;
}) {
  if (evidence.renderType === "search_hits") {
    const previewEntries = evidence.entries.slice(0, 3);
    return (
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 shadow-[0_0_0_1px_rgba(34,211,238,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200">
            {evidence.displayCommand}
          </Badge>
          <span className="text-xs font-mono text-foreground">{buildSearchLocationSummary(evidence)}</span>
          <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {evidence.entries.length} 条命中
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {previewEntries.map((entry) => (
            <div key={`${entry.filePath}-${entry.matchLine}`} className="rounded-md border border-border/60 bg-background/70 p-2">
              <div className="text-[11px] font-mono text-muted-foreground">
                {entry.filePath}:{entry.matchLine}
              </div>
              <div className="mt-1 text-sm text-foreground break-words">{entry.matchText}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const first = evidence.entries[0];
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 shadow-[0_0_0_1px_rgba(245,158,11,0.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200">
          {evidence.displayCommand}
        </Badge>
        <span className="text-xs font-mono text-foreground">{buildCodeLocationSummary(evidence)}</span>
        {first?.focusLine ? (
          <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            焦点行 {first.focusLine}
          </span>
        ) : null}
      </div>
      {first ? (
        <div className="mt-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 font-mono text-xs leading-6 text-foreground">
          {first.lines.slice(0, 3).map((line) => (
            <div key={`${line.lineNumber}-${line.kind}`} className="grid grid-cols-[56px_1fr] gap-2">
              <span className={line.kind === "focus" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}>
                {line.lineNumber}
              </span>
              <span className={line.kind === "focus" ? "text-foreground" : "text-muted-foreground"}>{line.text || " "}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
