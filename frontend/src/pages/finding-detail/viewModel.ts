import type { FindingNarrativeInput } from "@/pages/AgentAudit/components/findingNarrative";
import type { FindingCodeWindowDisplayLine } from "@/pages/AgentAudit/components/FindingCodeWindow";
import type { AgentFinding } from "@/shared/api/agentTasks";
import type { BanditFinding } from "@/shared/api/bandit";
import type { GitleaksFinding } from "@/shared/api/gitleaks";
import type { PhpstanFinding } from "@/shared/api/phpstan";
import type { PmdFinding } from "@/shared/api/pmd";
import type { YasaFinding } from "@/shared/api/yasa";
import type {
  OpengrepFinding,
  OpengrepFindingContext,
} from "@/shared/api/opengrep";
import { resolveCweDisplay } from "@/shared/security/cweCatalog";
import type { ProjectSourceType } from "@/shared/types";

const CODE_CONTEXT_PADDING = 3;
const ELLIPSIS_PLACEHOLDER = "// ....";
const MISSING_VALUE = "未提供";
const MISSING_SEVERITY = "未分级";
const MISSING_DESCRIPTION = "当前来源未提供扫描说明，请结合命中代码与追踪信息复核。";
const MISSING_REPORT_SECTION = "报告未提供此部分。";
const MISSING_REPORT_CODE_EVIDENCE = "报告未提供代码证据。";
const REPORT_SECTION_HEADING_RE = /^##\s+\d+\.\s*(.+?)\s*$/gm;

type FindingDetailTone = "danger" | "warning" | "info" | "success" | "muted";

export type FindingDetailFullFileRequest = {
  projectId: string;
  filePath: string;
};

export type FindingDetailCodeView = {
  id: string;
  title: string;
  filePath: string | null;
  displayFilePath?: string;
  locationLabel?: string;
  code: string;
  lineStart: number | null;
  lineEnd: number | null;
  highlightStartLine: number | null;
  highlightEndLine: number | null;
  focusLine: number | null;
  displayLines?: FindingCodeWindowDisplayLine[];
  relatedLines?: FindingCodeWindowDisplayLine[];
  fullFileAvailable?: boolean;
  fullFileRequest?: FindingDetailFullFileRequest | null;
};

export type FindingDetailSummaryStat = {
  label: string;
  value: string;
  tone: FindingDetailTone;
};

export type FindingDetailTrackingItem = {
  label: string;
  value: string;
  mono?: boolean;
  title?: string | null;
};

export type FindingDetailNarrativeSection = {
  id: string;
  title: string;
  emphasis?: "primary" | "secondary" | "success" | "neutral";
  finding?: FindingNarrativeInput | null;
  body?: string | null;
};

export type FindingDetailPageModel = {
  pageTitle: string;
  codePanelTitle: string;
  emptyCodeMessage: string;
  narrativeSections: FindingDetailNarrativeSection[];
  trackingItems: FindingDetailTrackingItem[];
  overviewItems: FindingDetailTrackingItem[];
  codeSections: FindingDetailCodeView[];
};

export function isFindingDetailFullFilePathSupported(
  filePath: string | null | undefined,
): boolean {
  let normalized = String(filePath || "").trim().replace(/\\/g, "/");
  if (!normalized) return false;

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (!normalized) return false;
  if (normalized.startsWith("/")) return false;
  if (/^[a-z]:\//i.test(normalized)) return false;

  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("tmp/VulHunter_")) return false;
  return true;
}

function normalizeFindingDetailFullFilePath(
  filePath: string | null | undefined,
): string | null {
  if (!isFindingDetailFullFilePathSupported(filePath)) return null;

  let normalized = String(filePath || "").trim().replace(/\\/g, "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized || null;
}

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeUpper(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function splitCodeLines(code: string): string[] {
  return String(code || "").replace(/\r\n/g, "\n").split("\n");
}

function buildLineLabel(lineStart: number | null, lineEnd: number | null): string {
  if (isFiniteLineNumber(lineStart) && isFiniteLineNumber(lineEnd) && lineEnd > lineStart) {
    return `第 ${lineStart}-${lineEnd} 行`;
  }
  if (isFiniteLineNumber(lineStart)) {
    return `第 ${lineStart} 行`;
  }
  return "行号未提供";
}

function buildDisplayFilePath(filePath: string | null | undefined, projectName?: string | null): string {
  const trimmed = String(filePath || "").trim();
  if (!trimmed) return "未定位文件";

  const normalized = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return trimmed;

  const sourceRootSegments = new Set(["src", "include", "lib", "app", "apps", "test", "tests"]);
  const sourceRootIndex = segments.findIndex((segment) =>
    sourceRootSegments.has(segment.toLowerCase()),
  );

  const projectNameLower = String(projectName || "").trim().toLowerCase();
  if (projectNameLower) {
    const projectIndex = segments.findIndex((segment) => segment.toLowerCase() === projectNameLower);
    const isProjectRootPrefix =
      projectIndex >= 0 &&
      projectIndex < segments.length - 1 &&
      (sourceRootIndex < 0 ? projectIndex <= 1 : projectIndex < sourceRootIndex);
    if (isProjectRootPrefix) {
      return segments.slice(projectIndex + 1).join("/");
    }
  }
  if (sourceRootIndex >= 0) {
    return segments.slice(sourceRootIndex).join("/");
  }

  return normalized;
}

function isFiniteLineNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatLocation(params: {
  filePath?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
}): string | null {
  const filePath = String(params.filePath || "").trim();
  if (!filePath) return null;
  const lineStart = isFiniteLineNumber(params.lineStart) ? params.lineStart : null;
  const lineEnd = isFiniteLineNumber(params.lineEnd) ? params.lineEnd : null;
  if (lineStart !== null && lineEnd !== null && lineEnd > lineStart) {
    return `${filePath}:${lineStart}-${lineEnd}`;
  }
  if (lineStart !== null) {
    return `${filePath}:${lineStart}`;
  }
  return filePath;
}

function buildTrackingItems(params: {
  sourceLabel: string;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  location?: string | null;
  includeSource?: boolean;
}): FindingDetailTrackingItem[] {
  const items: FindingDetailTrackingItem[] = [];

  if (params.includeSource !== false) {
    items.push({ label: "来源", value: params.sourceLabel });
  }

  // const taskName = String(params.taskName || "").trim();
  // if (taskName) {
  //   items.push({ label: "任务名称", value: taskName });
  // }

  items.push(
    { label: "任务 ID", value: params.taskId || "-", mono: true },
    { label: "漏洞 ID", value: params.findingId || "-", mono: true },
  );

  const location = String(params.location || "").trim();
  if (location) {
    items.push({ label: "文件位置", value: location, mono: true });
  }

  return items;
}

function resolveSeverityDisplay(value: unknown): { label: string; tone: FindingDetailTone } {
  const normalized = normalizeUpper(value);
  if (normalized === "CRITICAL" || normalized === "ERROR") {
    return { label: "严重", tone: "danger" };
  }
  if (normalized === "HIGH" || normalized === "WARNING") {
    return { label: "高危", tone: "warning" };
  }
  if (normalized === "MEDIUM" || normalized === "INFO") {
    return { label: "中危", tone: "info" };
  }
  if (normalized === "LOW") return { label: "低危", tone: "success" };
  return { label: MISSING_SEVERITY, tone: "muted" };
}

function resolveTextConfidenceDisplay(value: unknown): {
  label: string;
  tone: FindingDetailTone;
} {
  const normalized = normalizeUpper(value);
  if (normalized === "HIGH") return { label: "高", tone: "success" };
  if (normalized === "MEDIUM") return { label: "中", tone: "warning" };
  if (normalized === "LOW") return { label: "低", tone: "info" };
  return { label: MISSING_VALUE, tone: "muted" };
}

function resolveNumericConfidenceDisplay(value: number | null | undefined): {
  label: string;
  tone: FindingDetailTone;
} {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { label: MISSING_VALUE, tone: "muted" };
  }
  if (value >= 0.8) return { label: "高", tone: "success" };
  if (value >= 0.5) return { label: "中", tone: "warning" };
  if (value > 0) return { label: "低", tone: "info" };
  return { label: MISSING_VALUE, tone: "muted" };
}

function buildStatusLabel(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return MISSING_VALUE;

  const normalized = normalizeToken(raw).replace(/[\s-]+/g, "_");
  if (normalized === "verified") return "已验证";
  if (normalized === "open") return "待处理";
  if (normalized === "false_positive") return "误报";
  if (normalized === "closed") return "已关闭";
  if (normalized === "resolved") return "已处理";
  if (normalized === "confirmed") return "已确认";
  return raw;
}

function buildStaticFindingStatusLabel(value: unknown): string {
  const normalized = normalizeToken(String(value || "").trim()).replace(/[\s-]+/g, "_");
  if (normalized === "verified") return "确报";
  if (normalized === "false_positive") return "误报";
  return "待验证";
}

function buildOverviewItems(params: {
  statusLabel: string;
  headlineLabel: string;
  headlineValue: string;
  headlineTitle?: string | null;
  summaryStats: FindingDetailSummaryStat[];
}): FindingDetailTrackingItem[] {
  const items: FindingDetailTrackingItem[] = [{ label: "状态", value: params.statusLabel }];

  const headlineValue = String(params.headlineValue || "").trim();
  if (headlineValue) {
    items.push({
      label: String(params.headlineLabel || "").trim() || "概览",
      value: headlineValue,
      title: String(params.headlineTitle || "").trim() || null,
    });
  }

  items.push(
    ...params.summaryStats.map((stat) => ({
      label: stat.label,
      value: stat.value,
    })),
  );

  return items;
}

function buildMergedOverviewItems(params: {
  name: string;
  overviewItems: FindingDetailTrackingItem[];
  trackingItems: FindingDetailTrackingItem[];
}): FindingDetailTrackingItem[] {
  const name = String(params.name || "").trim() || MISSING_VALUE;
  return [
    { label: "名称", value: name },
    ...params.overviewItems,
    ...params.trackingItems,
  ];
}

function buildNarrativeSection(params: {
  id: string;
  title: string;
  emphasis?: FindingDetailNarrativeSection["emphasis"];
  content?: string | null;
  emptyBody?: string;
}): FindingDetailNarrativeSection {
  const content = String(params.content || "").trim();
  if (content) {
    return {
      id: params.id,
      title: params.title,
      emphasis: params.emphasis || "neutral",
      finding: {
        description: content,
        description_markdown: content,
      },
    };
  }

  return {
    id: params.id,
    title: params.title,
    emphasis: params.emphasis || "neutral",
    body: params.emptyBody || MISSING_DESCRIPTION,
  };
}

function resolveAgentConfidenceValue(finding: AgentFinding): number | null {
  if (typeof finding.ai_confidence === "number" && Number.isFinite(finding.ai_confidence)) {
    return finding.ai_confidence;
  }
  if (typeof finding.confidence === "number" && Number.isFinite(finding.confidence)) {
    return finding.confidence;
  }
  return null;
}

function extractFindingReportSections(report: string): Map<string, string> {
  const source = String(report || "").replace(/\r\n/g, "\n");
  const matches = [...source.matchAll(REPORT_SECTION_HEADING_RE)];
  const sections = new Map<string, string>();

  matches.forEach((match, index) => {
    const title = String(match[1] || "").trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? source.length) : source.length;
    const content = source.slice(start, end).trim();
    if (title) {
      sections.set(title, content);
    }
  });

  return sections;
}

function parseReportEvidenceLocation(section: string): {
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
} {
  const locationMatch = section.match(
    /(?:^|\n)-\s*位置[：:]\s*(?:`([^`]+)`|([^\n`]+?))(?:\s+行\s+(\d+)(?:-(\d+))?)?(?=\n|$)/m,
  );
  if (locationMatch) {
    const filePath = String(locationMatch[1] || locationMatch[2] || "").trim() || null;
    const lineStart = locationMatch[3] ? Number(locationMatch[3]) : null;
    const lineEnd = locationMatch[4] ? Number(locationMatch[4]) : lineStart;
    return {
      filePath,
      lineStart: isFiniteLineNumber(lineStart) ? lineStart : null,
      lineEnd: isFiniteLineNumber(lineEnd) ? lineEnd : null,
    };
  }

  const fallbackMatch = section.match(/(?:^|\n)-\s*位置[：:]\s*`?([^`\n]+?)`?(?=\n|$)/m);
  if (!fallbackMatch) {
    return { filePath: null, lineStart: null, lineEnd: null };
  }

  const rawLocation = String(fallbackMatch[1] || "").trim();
  const rangeMatch = rawLocation.match(/^(.*?):(\d+)(?:-(\d+))?$/);
  if (!rangeMatch) {
    return { filePath: rawLocation || null, lineStart: null, lineEnd: null };
  }

  const lineStart = Number(rangeMatch[2]);
  const lineEnd = rangeMatch[3] ? Number(rangeMatch[3]) : lineStart;
  return {
    filePath: String(rangeMatch[1] || "").trim() || null,
    lineStart: isFiniteLineNumber(lineStart) ? lineStart : null,
    lineEnd: isFiniteLineNumber(lineEnd) ? lineEnd : null,
  };
}

function buildAgentReportCodeViews(finding: AgentFinding): FindingDetailCodeView[] {
  const report = String(finding.report || "").trim();
  if (!report) return [];

  const sections = extractFindingReportSections(report);
  const codeEvidence = String(sections.get("代码证据") || "").trim();
  if (!codeEvidence) return [];

  const codeBlocks = [...codeEvidence.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)];
  if (codeBlocks.length === 0) return [];

  const location = parseReportEvidenceLocation(codeEvidence);
  return codeBlocks
    .map((match, index) => {
      const code = String(match[2] || "").trim();
      if (!code) return null;

      return {
        id: `agent-report:${finding.id}:${index}`,
        title: index === 0 ? "代码证据" : `代码证据 ${index + 1}`,
        filePath: location.filePath,
        code,
        lineStart: location.lineStart,
        lineEnd: location.lineEnd,
        highlightStartLine: location.lineStart,
        highlightEndLine: location.lineEnd,
        focusLine: location.lineStart,
      } satisfies FindingDetailCodeView;
    })
    .filter((view): view is FindingDetailCodeView => Boolean(view));
}

function buildAgentReportNarrativeSections(finding: AgentFinding): FindingDetailNarrativeSection[] {
  const sections = extractFindingReportSections(String(finding.report || ""));
  return [
    buildNarrativeSection({
      id: `agent:${finding.id}:principle`,
      title: "漏洞原理",
      emphasis: "primary",
      content: sections.get("漏洞原理"),
      emptyBody: MISSING_REPORT_SECTION,
    }),
    buildNarrativeSection({
      id: `agent:${finding.id}:impact`,
      title: "业务影响",
      emphasis: "secondary",
      content: sections.get("业务影响"),
      emptyBody: MISSING_REPORT_SECTION,
    }),
    buildNarrativeSection({
      id: `agent:${finding.id}:remediation`,
      title: "修复建议",
      emphasis: "success",
      content: sections.get("修复建议"),
      emptyBody: MISSING_REPORT_SECTION,
    }),
  ];
}

function parseStaticEndLine(finding: OpengrepFinding): number | null {
  const rule = finding.rule as {
    end?: { line?: number | string | null } | null;
  } | null;
  const raw = Number(rule?.end?.line);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return isFiniteLineNumber(finding.start_line) ? finding.start_line : null;
}

function getActualLineEnd(view: FindingDetailCodeView, lineCount: number): number | null {
  if (!isFiniteLineNumber(view.lineStart)) return null;
  if (isFiniteLineNumber(view.lineEnd)) {
    const expected = view.lineEnd - view.lineStart + 1;
    if (expected === lineCount) {
      return view.lineEnd;
    }
  }
  return view.lineStart + lineCount - 1;
}

export function buildFullFileDisplayLines(params: {
  content: string;
  lineStart?: number | null;
  focusLine?: number | null;
  highlightStartLine?: number | null;
  highlightEndLine?: number | null;
}): FindingCodeWindowDisplayLine[] {
  const lines = splitCodeLines(params.content);
  const lineStart = isFiniteLineNumber(params.lineStart) ? params.lineStart : 1;
  const highlightStart = isFiniteLineNumber(params.highlightStartLine)
    ? params.highlightStartLine
    : null;
  const highlightEnd = isFiniteLineNumber(params.highlightEndLine)
    ? params.highlightEndLine
    : highlightStart;
  const focusLine = isFiniteLineNumber(params.focusLine) ? params.focusLine : null;

  return lines.map((content, index) => {
    const lineNumber = lineStart + index;
    const isHighlighted =
      highlightStart !== null &&
      highlightEnd !== null &&
      lineNumber >= highlightStart &&
      lineNumber <= highlightEnd;
    return {
      lineNumber,
      content,
      kind: "code",
      isHighlighted,
      isFocus: focusLine !== null && lineNumber === focusLine,
    };
  });
}

function finalizeCodeSectionView(
  view: FindingDetailCodeView,
  params: {
    projectId?: string | null;
    projectSourceType?: ProjectSourceType | null;
    projectName?: string | null;
  },
): FindingDetailCodeView {
  const displayFilePath = buildDisplayFilePath(view.filePath, params.projectName);
  const locationLabel = buildLineLabel(
    isFiniteLineNumber(view.highlightStartLine) ? view.highlightStartLine : view.lineStart,
    isFiniteLineNumber(view.highlightEndLine) ? view.highlightEndLine : view.lineEnd,
  );
  const relatedLines =
    Array.isArray(view.displayLines) && view.displayLines.length > 0
      ? view.displayLines
      : buildFullFileDisplayLines({
          content: view.code,
          lineStart: view.lineStart,
          focusLine: view.focusLine,
          highlightStartLine: view.highlightStartLine,
          highlightEndLine: view.highlightEndLine,
        });
  const projectId = String(params.projectId || "").trim();
  const filePath = normalizeFindingDetailFullFilePath(view.filePath);
  const fullFileAvailable =
    params.projectSourceType === "zip" && projectId.length > 0 && filePath !== null;

  return {
    ...view,
    displayFilePath,
    locationLabel,
    relatedLines,
    fullFileAvailable,
    fullFileRequest: fullFileAvailable
      ? {
          projectId,
          filePath,
        }
      : null,
  };
}

export function isAgentFalsePositiveFinding(finding: AgentFinding | null): boolean {
  if (!finding) return false;
  return (
    normalizeToken(finding.authenticity) === "false_positive" ||
    normalizeToken(finding.status) === "false_positive"
  );
}

export function getAgentFalsePositiveEvidence(finding: AgentFinding | null): string {
  if (!finding) return "未生成详细判定说明";
  const evidence = String(finding.verification_evidence || "").trim();
  if (evidence) return evidence;
  const descriptionMarkdown = String(finding.description_markdown || "").trim();
  if (descriptionMarkdown) return descriptionMarkdown;
  const description = String(finding.description || "").trim();
  if (description) return description;
  return "未生成详细判定说明";
}

export function buildFindingDetailCodeSections(
  codeViews: FindingDetailCodeView[],
): FindingDetailCodeView[] {
  return codeViews.map((view) => {
    const lines = splitCodeLines(view.code);
    const lineStart = isFiniteLineNumber(view.lineStart) ? view.lineStart : null;
    const actualEnd = getActualLineEnd(view, lines.length);
    const highlightStart = isFiniteLineNumber(view.highlightStartLine)
      ? view.highlightStartLine
      : null;
    const highlightEnd = isFiniteLineNumber(view.highlightEndLine)
      ? view.highlightEndLine
      : null;
    const focusLine = isFiniteLineNumber(view.focusLine) ? view.focusLine : highlightStart;
    const highlightSpan =
      highlightStart !== null && highlightEnd !== null ? highlightEnd - highlightStart + 1 : null;

    if (
      lineStart === null ||
      actualEnd === null ||
      highlightStart === null ||
      highlightEnd === null ||
      highlightStart < lineStart ||
      highlightEnd > actualEnd ||
      highlightSpan === null ||
      highlightSpan <= 1
    ) {
      return { ...view };
    }

    const keepStart = Math.max(lineStart, highlightStart - CODE_CONTEXT_PADDING);
    const keepEnd = Math.min(actualEnd, highlightEnd + CODE_CONTEXT_PADDING);

    if (keepStart === lineStart && keepEnd === actualEnd) {
      return { ...view };
    }

    const displayLines: FindingCodeWindowDisplayLine[] = [];

    if (keepStart > lineStart) {
      displayLines.push({
        lineNumber: null,
        content: ELLIPSIS_PLACEHOLDER,
        kind: "placeholder",
      });
    }

    for (let currentLine = keepStart; currentLine <= keepEnd; currentLine += 1) {
      displayLines.push({
        lineNumber: currentLine,
        content: lines[currentLine - lineStart] ?? "",
        kind: "code",
        isHighlighted: currentLine >= highlightStart && currentLine <= highlightEnd,
        isFocus: focusLine !== null && currentLine === focusLine,
      });
    }

    if (keepEnd < actualEnd) {
      displayLines.push({
        lineNumber: null,
        content: ELLIPSIS_PLACEHOLDER,
        kind: "placeholder",
      });
    }

    return {
      ...view,
      displayLines,
    };
  });
}

export function buildOpengrepFindingCodeViews(
  finding: OpengrepFinding,
  context: OpengrepFindingContext | null,
): FindingDetailCodeView[] {
  if (context && Array.isArray(context.lines) && context.lines.length > 0) {
    const sortedLines = [...context.lines].sort((a, b) => a.line_number - b.line_number);
    const hitLines = sortedLines.filter((line) => line.is_hit).map((line) => line.line_number);
    const lineStart = sortedLines[0]?.line_number ?? context.start_line;
    const lineEnd = sortedLines[sortedLines.length - 1]?.line_number ?? context.end_line;
    return [
      {
        id: `static:${finding.id}`,
        title: "命中代码",
        filePath: context.file_path || finding.file_path || null,
        code: sortedLines.map((line) => line.content || "").join("\n"),
        lineStart,
        lineEnd,
        highlightStartLine:
          hitLines[0] ?? context.start_line ?? finding.start_line ?? null,
        highlightEndLine:
          hitLines[hitLines.length - 1] ??
          context.end_line ??
          parseStaticEndLine(finding) ??
          finding.start_line ??
          null,
        focusLine: hitLines[0] ?? finding.start_line ?? context.start_line ?? lineStart ?? null,
      },
    ];
  }

  const fallbackCode = String(finding.code_snippet || "").trim();
  if (!fallbackCode) return [];
  return [
    {
      id: `static:${finding.id}`,
      title: "命中代码",
      filePath: finding.file_path || null,
      code: fallbackCode,
      lineStart: finding.start_line ?? null,
      lineEnd: parseStaticEndLine(finding),
      highlightStartLine: finding.start_line ?? null,
      highlightEndLine: parseStaticEndLine(finding),
      focusLine: finding.start_line ?? null,
    },
  ];
}

export function buildGitleaksFindingCodeViews(
  finding: GitleaksFinding,
): FindingDetailCodeView[] {
  const content = String(finding.match || finding.secret || "").trim();
  if (!content) return [];
  return [
    {
      id: `gitleaks:${finding.id}`,
      title: "命中内容",
      filePath: finding.file_path || null,
      code: content,
      lineStart: finding.start_line ?? null,
      lineEnd: finding.end_line ?? finding.start_line ?? null,
      highlightStartLine: finding.start_line ?? null,
      highlightEndLine: finding.end_line ?? finding.start_line ?? null,
      focusLine: finding.start_line ?? null,
    },
  ];
}

export function buildBanditFindingCodeViews(finding: BanditFinding): FindingDetailCodeView[] {
  const content = String(finding.code_snippet || "").trim();
  if (!content) return [];
  return [
    {
      id: `bandit:${finding.id}`,
      title: "风险代码",
      filePath: finding.file_path || null,
      code: content,
      lineStart: finding.line_number ?? null,
      lineEnd: finding.line_number ?? null,
      highlightStartLine: finding.line_number ?? null,
      highlightEndLine: finding.line_number ?? null,
      focusLine: finding.line_number ?? null,
    },
  ];
}

export function buildPhpstanFindingCodeViews(
  _finding: PhpstanFinding,
): FindingDetailCodeView[] {
  return [];
}

export function buildPmdFindingCodeViews(
  _finding: PmdFinding,
): FindingDetailCodeView[] {
  return [];
}

export function buildYasaFindingCodeViews(
  _finding: YasaFinding,
): FindingDetailCodeView[] {
  return [];
}

export function buildAgentFindingCodeViews(finding: AgentFinding): FindingDetailCodeView[] {
  const contextCode = String(finding.code_context || "").trim();
  const snippetCode = String(finding.code_snippet || "").trim();
  const code = contextCode || snippetCode;
  if (!code) return [];

  const lineStart = isFiniteLineNumber(finding.context_start_line)
    ? finding.context_start_line
    : finding.line_start;
  const lineEnd = isFiniteLineNumber(finding.context_end_line)
    ? finding.context_end_line
    : finding.line_end;

  return [
    {
      id: `agent:${finding.id}`,
      title: contextCode ? "命中代码" : "命中片段",
      filePath: finding.file_path,
      code,
      lineStart: lineStart ?? null,
      lineEnd: lineEnd ?? lineStart ?? null,
      highlightStartLine: finding.line_start ?? lineStart ?? null,
      highlightEndLine: finding.line_end ?? lineEnd ?? lineStart ?? null,
      focusLine: finding.line_start ?? lineStart ?? null,
    },
  ];
}

function buildBaseModel(params: {
  pageTitle: string;
  codePanelTitle: string;
  emptyCodeMessage: string;
  narrativeSections: FindingDetailNarrativeSection[];
  trackingItems: FindingDetailTrackingItem[];
  overviewItems: FindingDetailTrackingItem[];
  codeSections: FindingDetailCodeView[];
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  return {
    pageTitle: params.pageTitle,
    codePanelTitle: params.codePanelTitle,
    emptyCodeMessage: params.emptyCodeMessage,
    narrativeSections: params.narrativeSections,
    trackingItems: params.trackingItems,
    overviewItems: params.overviewItems,
    codeSections: params.codeSections.map((section) =>
      finalizeCodeSectionView(section, {
        projectId: params.projectId,
        projectSourceType: params.projectSourceType,
        projectName: params.projectName,
      }),
    ),
  };
}

export function buildAgentFindingDetailModel(params: {
  finding: AgentFinding;
  taskId: string;
  findingId: string;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const isFalsePositive = isAgentFalsePositiveFinding(finding);
  const severity = resolveSeverityDisplay(finding.severity);
  const confidence = resolveNumericConfidenceDisplay(resolveAgentConfidenceValue(finding));
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.line_start,
    lineEnd: finding.line_end,
  });
  const typeDisplay = resolveCweDisplay({
    cwe: finding.cwe_id,
    fallbackLabel: String(finding.vulnerability_type || "").trim() || MISSING_VALUE,
  });
  const trackingItems = buildTrackingItems({
    sourceLabel: "智能扫描",
    taskId: params.taskId,
    findingId: params.findingId,
    location,
    includeSource: false,
  });
  const codeSections = buildFindingDetailCodeSections(buildAgentFindingCodeViews(finding));

  if (isFalsePositive) {
    const statusLabel = buildStatusLabel(finding.status || "false_positive");
    const summaryStats: FindingDetailSummaryStat[] = [
      { label: "漏洞类型", value: typeDisplay.label, tone: "info" },
      { label: "漏洞危害", value: severity.label, tone: severity.tone },
      { label: "漏洞置信度", value: confidence.label, tone: confidence.tone },
    ];

    return buildBaseModel({
      pageTitle: "误报判定依据",
      codePanelTitle: "关联代码 / 命中位置",
      emptyCodeMessage: "该误报未保留可展示代码，仅提供判定结论。",
      narrativeSections: [
        buildNarrativeSection({
          id: `agent:${finding.id}:false-positive`,
          title: "判定依据",
          content: getAgentFalsePositiveEvidence(finding),
          emphasis: "neutral",
          emptyBody: "未生成详细判定说明",
        }),
      ],
      trackingItems,
      overviewItems: buildMergedOverviewItems({
        name:
          String(finding.display_title || "").trim() ||
          String(finding.title || "").trim() ||
          "该问题已在验证阶段判定为误报",
        overviewItems: buildOverviewItems({
          statusLabel,
          headlineLabel: "验证结论",
          headlineValue: "该问题已在验证阶段判定为误报",
          summaryStats,
        }),
        trackingItems,
      }),
      codeSections,
      projectId: params.projectId,
      projectSourceType: params.projectSourceType,
      projectName: params.projectName,
    });
  }

  const statusLabel = buildStatusLabel(finding.status);
  const summaryStats: FindingDetailSummaryStat[] = [
    { label: "漏洞危害", value: severity.label, tone: severity.tone },
    { label: "漏洞置信度", value: confidence.label, tone: confidence.tone },
  ];

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "代码证据",
    emptyCodeMessage: MISSING_REPORT_CODE_EVIDENCE,
    narrativeSections: buildAgentReportNarrativeSections(finding),
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name:
        String(finding.display_title || "").trim() ||
        String(finding.title || "").trim() ||
        typeDisplay.label,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue: typeDisplay.label,
        headlineTitle: typeDisplay.tooltip,
        summaryStats,
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildAgentReportCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}

export function buildOpengrepFindingDetailModel(params: {
  finding: OpengrepFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  context?: OpengrepFindingContext | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const severity = resolveSeverityDisplay(finding.severity);
  const confidence = resolveTextConfidenceDisplay(finding.confidence);
  const statusLabel = buildStaticFindingStatusLabel(finding.status);
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.start_line,
    lineEnd: parseStaticEndLine(finding),
  });
  const typeDisplay = resolveCweDisplay({
    cwe: finding.cwe,
    fallbackLabel: String(finding.rule_name || "").trim() || "unknown-rule",
  });
  const summaryStats: FindingDetailSummaryStat[] = [
    { label: "漏洞危害", value: severity.label, tone: severity.tone },
    { label: "漏洞置信度", value: confidence.label, tone: confidence.tone },
  ];
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · Opengrep",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });
  const ruleName = String(finding.rule_name || "").trim();
  if (ruleName) {
    trackingItems.push({ label: "规则标识", value: ruleName, mono: true });
  }

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "暂无可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `opengrep:${finding.id}:summary`,
        title: "扫描说明",
        content: String(finding.description || "").trim() || MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: typeDisplay.label,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue: typeDisplay.label,
        headlineTitle: typeDisplay.tooltip,
        summaryStats,
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(
      buildOpengrepFindingCodeViews(finding, params.context ?? null),
    ),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}

export function buildGitleaksFindingDetailModel(params: {
  finding: GitleaksFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.start_line,
    lineEnd: finding.end_line,
  });
  const statusLabel = buildStaticFindingStatusLabel(finding.status);
  const summaryStats: FindingDetailSummaryStat[] = [
    { label: "漏洞危害", value: MISSING_SEVERITY, tone: "muted" },
    { label: "漏洞置信度", value: MISSING_VALUE, tone: "muted" },
  ];
  const headlineValue = String(finding.rule_id || "").trim() || "gitleaks-rule";
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · Gitleaks",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "暂无可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `gitleaks:${finding.id}:summary`,
        title: "扫描说明",
        content: String(finding.description || "").trim() || MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: headlineValue,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue,
        summaryStats,
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildGitleaksFindingCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}

export function buildBanditFindingDetailModel(params: {
  finding: BanditFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const severity = resolveSeverityDisplay(finding.issue_severity);
  const confidence = resolveTextConfidenceDisplay(finding.issue_confidence);
  const statusLabel = buildStaticFindingStatusLabel(finding.status);
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.line_number,
    lineEnd: finding.line_number,
  });
  const headlineValue = [
    String(finding.test_id || "").trim(),
    String(finding.test_name || "").trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const summaryStats: FindingDetailSummaryStat[] = [
    { label: "漏洞危害", value: severity.label, tone: severity.tone },
    { label: "漏洞置信度", value: confidence.label, tone: confidence.tone },
  ];
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · Bandit",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "暂无可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `bandit:${finding.id}:summary`,
        title: "扫描说明",
        content:
          String(finding.issue_text || "").trim() ||
          String(finding.more_info || "").trim() ||
          MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: headlineValue || "bandit-rule",
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue: headlineValue || "bandit-rule",
        summaryStats,
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildBanditFindingCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}

export function buildPhpstanFindingDetailModel(params: {
  finding: PhpstanFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const statusLabel = buildStaticFindingStatusLabel(finding.status);
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.line ?? null,
    lineEnd: finding.line ?? null,
  });
  const summaryStats: FindingDetailSummaryStat[] = [
    { label: "漏洞危害", value: "低危", tone: "success" },
    { label: "漏洞置信度", value: "中", tone: "warning" },
  ];
  const headlineValue =
    String(finding.identifier || "").trim() ||
    String(finding.message || "").trim() ||
    "phpstan-rule";
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · PHPStan",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "当前来源未提供可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `phpstan:${finding.id}:summary`,
        title: "扫描说明",
        content:
          String(finding.message || "").trim() ||
          String(finding.tip || "").trim() ||
          MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: headlineValue,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue,
        summaryStats,
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildPhpstanFindingCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}


export function buildYasaFindingDetailModel(params: {
  finding: YasaFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const statusLabel = buildStatusLabel(finding.status);
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.start_line ?? null,
    lineEnd: finding.end_line ?? finding.start_line ?? null,
  });
  const normalizedLevel = String(finding.level || "warning").trim().toLowerCase();
  const severityLabel = normalizedLevel === "error" ? "中危" : "低危";
  const severityTone: FindingDetailTone = normalizedLevel === "error" ? "warning" : "success";
  const headlineValue =
    String(finding.rule_id || "").trim() ||
    String(finding.rule_name || "").trim() ||
    String(finding.message || "").trim() ||
    "yasa-rule";
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · YASA",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "当前来源未提供可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `yasa:${finding.id}:summary`,
        title: "扫描说明",
        content: String(finding.message || "").trim() || MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: headlineValue,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue,
        summaryStats: [
          { label: "漏洞危害", value: severityLabel, tone: severityTone },
          { label: "漏洞置信度", value: "中", tone: "warning" },
        ],
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildYasaFindingCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}

export function buildPmdFindingDetailModel(params: {
  finding: PmdFinding;
  taskId: string;
  findingId: string;
  taskName?: string | null;
  projectId?: string | null;
  projectSourceType?: ProjectSourceType | null;
  projectName?: string | null;
}): FindingDetailPageModel {
  const { finding } = params;
  const statusLabel = buildStaticFindingStatusLabel(finding.status);
  const location = formatLocation({
    filePath: finding.file_path,
    lineStart: finding.begin_line ?? null,
    lineEnd: finding.end_line ?? finding.begin_line ?? null,
  });
  const priority = Number(finding.priority);
  const severityLabel =
    Number.isFinite(priority) && priority > 0 && priority <= 2
      ? "高危"
      : Number.isFinite(priority) && priority === 3
        ? "中危"
        : "低危";
  const severityTone: FindingDetailTone =
    Number.isFinite(priority) && priority > 0 && priority <= 2
      ? "danger"
      : Number.isFinite(priority) && priority === 3
        ? "warning"
        : "success";
  const headlineValue =
    [String(finding.rule || "").trim(), String(finding.ruleset || "").trim()]
      .filter(Boolean)
      .join(" · ") ||
    String(finding.message || "").trim() ||
    "pmd-rule";
  const trackingItems = buildTrackingItems({
    sourceLabel: "静态扫描 · PMD",
    taskId: params.taskId,
    findingId: params.findingId,
    taskName: params.taskName,
    location,
  });

  return buildBaseModel({
    pageTitle: "统一漏洞详情",
    codePanelTitle: "关联代码",
    emptyCodeMessage: "当前来源未提供可展示的命中代码。",
    narrativeSections: [
      buildNarrativeSection({
        id: `pmd:${finding.id}:summary`,
        title: "扫描说明",
        content: String(finding.message || "").trim() || MISSING_DESCRIPTION,
      }),
    ],
    trackingItems,
    overviewItems: buildMergedOverviewItems({
      name: headlineValue,
      overviewItems: buildOverviewItems({
        statusLabel,
        headlineLabel: "漏洞类型",
        headlineValue,
        summaryStats: [
          { label: "漏洞危害", value: severityLabel, tone: severityTone },
          { label: "漏洞置信度", value: "中", tone: "warning" },
        ],
      }),
      trackingItems,
    }),
    codeSections: buildFindingDetailCodeSections(buildPmdFindingCodeViews(finding)),
    projectId: params.projectId,
    projectSourceType: params.projectSourceType,
    projectName: params.projectName,
  });
}
