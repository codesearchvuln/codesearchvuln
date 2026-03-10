export type ToolEvidenceRenderType = "code_window" | "search_hits";
export type ToolEvidenceLineKind = "context" | "focus" | "match";

export interface ToolEvidenceLine {
  lineNumber: number;
  text: string;
  kind: ToolEvidenceLineKind;
}

export interface ToolEvidenceCodeWindowEntry {
  filePath: string;
  startLine: number;
  endLine: number;
  focusLine: number | null;
  language: string;
  lines: ToolEvidenceLine[];
}

export interface ToolEvidenceSearchHitEntry {
  filePath: string;
  matchLine: number;
  matchText: string;
  windowStartLine: number;
  windowEndLine: number;
  language: string;
  lines: ToolEvidenceLine[];
}

export type ToolEvidencePayload =
  | {
      renderType: "code_window";
      commandChain: string[];
      displayCommand: string;
      entries: ToolEvidenceCodeWindowEntry[];
    }
  | {
      renderType: "search_hits";
      commandChain: string[];
      displayCommand: string;
      entries: ToolEvidenceSearchHitEntry[];
    };

const TOOL_EVIDENCE_TOOLS = new Set(["read_file", "search_code"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseCommandChain(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item, index, source) => item.length > 0 && source.indexOf(item) === index);
}

function parseLines(value: unknown): ToolEvidenceLine[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ToolEvidenceLine[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) return null;
    const lineNumber = toInt(record.line_number);
    const kind = toStringValue(record.kind) as ToolEvidenceLineKind;
    if (lineNumber === null || !["context", "focus", "match"].includes(kind)) {
      return null;
    }
    parsed.push({
      lineNumber,
      text: toStringValue(record.text),
      kind,
    });
  }
  return parsed;
}

function parseCodeWindowEntries(value: unknown): ToolEvidenceCodeWindowEntry[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ToolEvidenceCodeWindowEntry[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) return null;
    const filePath = toStringValue(record.file_path).trim();
    const startLine = toInt(record.start_line);
    const endLine = toInt(record.end_line);
    const lines = parseLines(record.lines);
    if (!filePath || startLine === null || endLine === null || !lines) {
      return null;
    }
    parsed.push({
      filePath,
      startLine,
      endLine,
      focusLine: toInt(record.focus_line),
      language: toStringValue(record.language) || "text",
      lines,
    });
  }
  return parsed;
}

function parseSearchHitEntries(value: unknown): ToolEvidenceSearchHitEntry[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ToolEvidenceSearchHitEntry[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) return null;
    const filePath = toStringValue(record.file_path).trim();
    const matchLine = toInt(record.match_line);
    const windowStartLine = toInt(record.window_start_line);
    const windowEndLine = toInt(record.window_end_line);
    const lines = parseLines(record.lines);
    if (
      !filePath ||
      matchLine === null ||
      windowStartLine === null ||
      windowEndLine === null ||
      !lines
    ) {
      return null;
    }
    parsed.push({
      filePath,
      matchLine,
      matchText: toStringValue(record.match_text),
      windowStartLine,
      windowEndLine,
      language: toStringValue(record.language) || "text",
      lines,
    });
  }
  return parsed;
}

export function isToolEvidenceCapableTool(toolName: string | null | undefined): boolean {
  return TOOL_EVIDENCE_TOOLS.has(String(toolName || "").trim().toLowerCase());
}

export function parseToolEvidence(value: unknown): ToolEvidencePayload | null {
  const container = asRecord(value);
  const metadata = asRecord(container?.metadata) || container;
  if (!metadata) return null;

  const renderType = toStringValue(metadata.render_type) as ToolEvidenceRenderType;
  const commandChain = parseCommandChain(metadata.command_chain);
  const displayCommand = toStringValue(metadata.display_command).trim();
  if (!displayCommand || commandChain.length === 0) {
    return null;
  }

  if (renderType === "code_window") {
    const entries = parseCodeWindowEntries(metadata.entries);
    return entries
      ? {
          renderType,
          commandChain,
          displayCommand,
          entries,
        }
      : null;
  }

  if (renderType === "search_hits") {
    const entries = parseSearchHitEntries(metadata.entries);
    return entries
      ? {
          renderType,
          commandChain,
          displayCommand,
          entries,
        }
      : null;
  }

  return null;
}

export function toolEvidenceLinesToCode(lines: ToolEvidenceLine[]): string {
  return lines.map((line) => line.text).join("\n");
}
