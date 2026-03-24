import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import FindingCodeWindow from "./FindingCodeWindow";
import type { ParsedToolEvidence, ToolEvidencePayload } from "../toolEvidence";
import {
  asParsedToolEvidence,
  isToolEvidenceCapableTool,
  toolEvidenceLinesToCode,
} from "../toolEvidence";

function TimelineSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

function RawOnlyEvidence({ evidence }: { evidence: ParsedToolEvidence }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
        {evidence.notices?.[0] || "仅能展示原始 JSON。"}
      </div>
      <TimelineSection title="原始数据">
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(evidence.rawOutput ?? null, null, 2)}
        </pre>
      </TimelineSection>
    </div>
  );
}

function renderInputSection(payload: ToolEvidencePayload) {
  const first = payload.entries[0] as any;
  if (!first) return null;
  if (payload.renderType === "search_hits") {
    return <div className="font-mono text-sm">{first.filePath}:{first.matchLine}</div>;
  }
  if (payload.renderType === "code_window" || payload.renderType === "symbol_body") {
    return <div className="font-mono text-sm">{first.filePath}:{first.startLine}-{first.endLine}</div>;
  }
  if (payload.renderType === "execution_result") {
    return <div className="font-mono text-sm">{first.executionCommand || first.description || "执行记录"}</div>;
  }
  if (payload.renderType === "file_list") {
    return <div className="font-mono text-sm">{first.directory}{first.pattern ? ` (${first.pattern})` : ""}</div>;
  }
  if (payload.renderType === "locator_result") {
    return <div className="font-mono text-sm">{first.filePath}:{first.line}</div>;
  }
  if (payload.renderType === "analysis_summary") {
    return <div className="text-sm">{first.title}</div>;
  }
  if (payload.renderType === "flow_analysis") {
    return <div className="text-sm">{first.filePath || first.engine}</div>;
  }
  if (payload.renderType === "verification_summary") {
    return <div className="font-mono text-sm">{first.target}</div>;
  }
  return <div className="font-mono text-sm">{first.location}</div>;
}

function renderEvidenceSection(payload: ToolEvidencePayload) {
  const first = payload.entries[0] as any;
  if (!first) return null;
  if (payload.renderType === "search_hits") {
    return (
      <div className="space-y-2">
        {payload.entries.map((entry) => (
          <div key={`${entry.filePath}-${entry.matchLine}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
            <div className="font-mono text-xs">{entry.filePath}:{entry.matchLine}</div>
            <div className="mt-1">{entry.matchText}</div>
          </div>
        ))}
      </div>
    );
  }
  if (payload.renderType === "code_window" || payload.renderType === "symbol_body") {
    return (
      <FindingCodeWindow
        code={toolEvidenceLinesToCode(first.lines)}
        filePath={first.filePath}
        lineStart={first.startLine}
        lineEnd={first.endLine}
        highlightStartLine={first.focusLine}
        highlightEndLine={first.focusLine}
        focusLine={first.focusLine}
        title={first.title || "代码窗口"}
        density="detail"
      />
    );
  }
  if (payload.renderType === "execution_result") {
    const content =
      first.stdoutPreview || first.stderrPreview || first.executionCommand || first.description || "执行证据";
    return (
      <FindingCodeWindow
        code={content}
        filePath={first.title || "execution"}
        lineStart={1}
        lineEnd={content.split("\n").length}
        focusLine={1}
        title={first.title || "执行结果"}
        density="detail"
      />
    );
  }
  if (payload.renderType === "file_list") {
    return (
      <pre className="text-xs whitespace-pre-wrap break-words">
        {[...first.directories, ...first.files].join("\n") || "暂无可展示条目"}
      </pre>
    );
  }
  if (payload.renderType === "locator_result") {
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono">{first.signature || first.symbolName}</div>
        <div>参数: {first.parameters.join(", ") || "无"}</div>
      </div>
    );
  }
  if (payload.renderType === "analysis_summary") {
    return (
      <div className="space-y-2 text-sm">
        <div>{first.summary}</div>
        {first.highlights.map((item: string) => (
          <div key={item} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">{item}</div>
        ))}
      </div>
    );
  }
  if (payload.renderType === "flow_analysis") {
    return (
      <div className="space-y-2 text-sm">
        <div>Source: {first.sourceNodes.join(", ") || "无"}</div>
        <div>Sink: {first.sinkNodes.join(", ") || "无"}</div>
        <div>路径: {[...first.callChain, ...first.taintSteps].join(" -> ") || "无"}</div>
        {first.blockedReasons.length > 0 ? <div>阻塞原因: {first.blockedReasons.join(", ")}</div> : null}
      </div>
    );
  }
  if (payload.renderType === "verification_summary") {
    return (
      <div className="space-y-2 text-sm">
        <div>Payload: <span className="font-mono">{first.payload}</span></div>
        <div>{first.evidence || "暂无证据文本"}</div>
      </div>
    );
  }
  return <div className="text-sm">{first.recommendation}</div>;
}

function renderConclusionSection(payload: ToolEvidencePayload) {
  const first = payload.entries[0] as any;
  if (!first) return null;
  if (payload.renderType === "execution_result") {
    return <div className="text-sm">状态 {first.status}，退出码 {first.exitCode}</div>;
  }
  if (payload.renderType === "file_list") {
    return <div className="text-sm">{first.fileCount} 个文件，{first.dirCount} 个目录{first.truncated ? "，结果已截断" : ""}</div>;
  }
  if (payload.renderType === "locator_result") {
    return <div className="text-sm">{first.engine} · confidence {first.confidence.toFixed(2)} · {first.degraded ? "degraded" : "stable"}</div>;
  }
  if (payload.renderType === "analysis_summary") {
    return <div className="text-sm">{first.hitCount} 个发现 · {Object.entries(first.severityStats).map(([k, v]) => `${k}:${v}`).join(" · ")}</div>;
  }
  if (payload.renderType === "flow_analysis") {
    return <div className="text-sm">{first.reachability} · path={String(first.pathFound)} · score {first.pathScore.toFixed(2)}</div>;
  }
  if (payload.renderType === "verification_summary") {
    return <div className="text-sm">{first.verdict}{first.responseStatus ? ` · HTTP ${first.responseStatus}` : ""}</div>;
  }
  if (payload.renderType === "report_summary") {
    return <div className="text-sm">{first.severity} · confidence {first.confidence.toFixed(2)} · CVSS {first.cvssScore.toFixed(1)}</div>;
  }
  return <div className="text-sm">{payload.entries.length} 条结构化证据</div>;
}

export default function ToolEvidenceDetail({
  toolName,
  evidence,
  rawOutput,
}: {
  toolName?: string | null;
  evidence: ParsedToolEvidence | ToolEvidencePayload | null;
  rawOutput: unknown;
}) {
  const parsed = asParsedToolEvidence(evidence);
  if (!parsed) {
    return isToolEvidenceCapableTool(toolName) ? (
      <RawOnlyEvidence
        evidence={{
          state: "raw-only",
          payload: null,
          rawOutput,
          notices: ["无法安全提炼结构化证据，已回退原始 JSON。"],
        }}
      />
    ) : null;
  }

  if (!parsed.payload) {
    return <RawOnlyEvidence evidence={parsed} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{parsed.payload.displayCommand}</Badge>
        <Badge variant="outline">{parsed.state}</Badge>
        {parsed.notices?.map((notice) => (
          <span key={notice} className="text-xs text-muted-foreground">{notice}</span>
        ))}
      </div>

      <TimelineSection title="输入与目标">{renderInputSection(parsed.payload)}</TimelineSection>
      <TimelineSection title="关键证据">{renderEvidenceSection(parsed.payload)}</TimelineSection>
      <TimelineSection title="结论与判断">{renderConclusionSection(parsed.payload)}</TimelineSection>
      <TimelineSection title="原始数据">
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(parsed.rawOutput ?? rawOutput ?? parsed.payload, null, 2)}
        </pre>
      </TimelineSection>
    </div>
  );
}
