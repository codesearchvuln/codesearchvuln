import FindingCodeWindow from "./FindingCodeWindow";
import type { ToolEvidencePayload } from "../toolEvidence";
import { toolEvidenceLinesToCode } from "../toolEvidence";

function statusLabel(status: "passed" | "failed" | "error") {
  if (status === "passed") return "执行成功";
  if (status === "failed") return "执行失败";
  return "执行错误";
}

export default function ToolEvidencePreview({
  evidence,
}: {
  evidence: ToolEvidencePayload;
}) {
  if (evidence.renderType === "search_hits") {
    const first = evidence.entries[0];
    if (!first) return null;

    return (
      <FindingCodeWindow
        code={toolEvidenceLinesToCode(first.lines)}
        filePath={first.filePath}
        lineStart={first.windowStartLine}
        lineEnd={first.windowEndLine}
        highlightStartLine={first.matchLine}
        highlightEndLine={first.matchLine}
        focusLine={first.matchLine}
        title="命中窗口"
        density="compact"
        badges={[evidence.displayCommand, "命中"]}
        meta={[`${first.filePath}:${first.matchLine}`, `${evidence.entries.length} 条命中`, first.language]}
      />
    );
  }

  if (evidence.renderType === "execution_result") {
    const first = evidence.entries[0];
    if (!first) return null;

    if (first.code) {
      return (
        <FindingCodeWindow
          code={toolEvidenceLinesToCode(first.code.lines)}
          filePath={first.title || "inline-harness"}
          lineStart={first.code.lines[0]?.lineNumber ?? 1}
          lineEnd={first.code.lines.at(-1)?.lineNumber ?? 1}
          highlightStartLine={first.code.lines.find((line) => line.kind === "focus")?.lineNumber ?? 1}
          highlightEndLine={first.code.lines.find((line) => line.kind === "focus")?.lineNumber ?? 1}
          focusLine={first.code.lines.find((line) => line.kind === "focus")?.lineNumber ?? 1}
          title="执行代码"
          density="compact"
          badges={[evidence.displayCommand, statusLabel(first.status)]}
          meta={[
            `退出码 ${first.exitCode}`,
            first.language || "",
            first.description || first.executionCommand || "",
          ]}
        />
      );
    }

    return (
      <FindingCodeWindow
        code={first.stdoutPreview || first.stderrPreview || first.executionCommand || first.description || "执行证据"}
        filePath={first.title || "execution-result"}
        lineStart={1}
        lineEnd={(first.stdoutPreview || first.stderrPreview || first.executionCommand || first.description || "")
          .split("\n").length}
        focusLine={1}
        title="执行代码"
        density="compact"
        badges={[evidence.displayCommand, statusLabel(first.status)]}
        meta={[`退出码 ${first.exitCode}`, first.language || "text"]}
      />
    );
  }

  const first = evidence.entries[0];
  if (!first) return null;

  return (
    <FindingCodeWindow
      code={toolEvidenceLinesToCode(first.lines)}
      filePath={first.filePath}
      lineStart={first.startLine}
      lineEnd={first.endLine}
      highlightStartLine={first.focusLine}
      highlightEndLine={first.focusLine}
      focusLine={first.focusLine}
      title="代码窗口"
      density="compact"
      badges={[evidence.displayCommand, first.focusLine ? "focus" : "code"]}
      meta={[
        first.language,
        first.symbolName ? `${first.symbolKind || "symbol"} ${first.symbolName}` : "",
        first.focusLine ? `焦点行 ${first.focusLine}` : "",
      ]}
    />
  );
}
