import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentFinding } from "@/shared/api/agentTasks";

interface FindingsPanelProps {
  findings: AgentFinding[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  critical:
    "bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40",
  high: "bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-500/40",
  medium:
    "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40",
  low: "bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/40",
  info: "bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-500/40",
};

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLocation(item: AgentFinding): string {
  if (!item.file_path) {
    return "未定位文件";
  }
  if (item.line_start && item.line_end && item.line_end !== item.line_start) {
    return `${item.file_path}:${item.line_start}-${item.line_end}`;
  }
  if (item.line_start) {
    return `${item.file_path}:${item.line_start}`;
  }
  return item.file_path;
}

export function FindingsPanel({
  findings,
  loading,
  error,
  onRetry,
}: FindingsPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filteredFindings = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const sorted = [...findings].sort((a, b) => {
      const aSeverity =
        SEVERITY_ORDER[a.severity?.toLowerCase() || "info"] ?? 99;
      const bSeverity =
        SEVERITY_ORDER[b.severity?.toLowerCase() || "info"] ?? 99;
      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return sorted.filter((item) => {
      const matchedKeyword =
        normalizedKeyword.length === 0 ||
        (item.title || "").toLowerCase().includes(normalizedKeyword) ||
        (item.description || "").toLowerCase().includes(normalizedKeyword) ||
        (item.file_path || "").toLowerCase().includes(normalizedKeyword);
      const matchedSeverity =
        severityFilter === "all" ||
        (item.severity || "").toLowerCase() === severityFilter;
      const matchedVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && item.is_verified) ||
        (verificationFilter === "unverified" && !item.is_verified);

      return matchedKeyword && matchedSeverity && matchedVerification;
    });
  }, [findings, keyword, severityFilter, verificationFilter]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderBody = () => {
    if (loading && findings.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载审计结果中...
          </div>
        </div>
      );
    }

    if (error && findings.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              重试加载
            </Button>
          </div>
        </div>
      );
    }

    if (filteredFindings.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <Bug className="w-5 h-5 opacity-60" />
            <span className="text-sm">当前筛选条件下暂无漏洞</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-4">
        {filteredFindings.map((item) => {
          const severityKey = (item.severity || "info").toLowerCase();
          const expanded = expandedIds.has(item.id);
          const confidence =
            typeof item.ai_confidence === "number"
              ? `${Math.round(item.ai_confidence * 100)}%`
              : "未设置";
          return (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card/70 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`border text-xs ${SEVERITY_BADGE_CLASS[severityKey] || SEVERITY_BADGE_CLASS.info}`}
                      >
                        {severityKey.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.is_verified ? "已验证" : "未验证"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        置信度 {confidence}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-foreground whitespace-normal break-words">
                      {item.title || "未命名漏洞"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground whitespace-normal break-words">
                      {formatLocation(item)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      状态：{item.status || "new"} | 创建时间：
                      {formatCreatedAt(item.created_at)}
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border bg-background/40">
                  {item.description && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        漏洞描述
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {item.description}
                      </div>
                    </div>
                  )}
                  {item.suggestion && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        修复建议
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {item.suggestion}
                      </div>
                    </div>
                  )}
                  {item.code_snippet && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        代码片段
                      </div>
                      <pre className="text-xs font-mono bg-card border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {item.code_snippet}
                      </pre>
                    </div>
                  )}
                  {item.poc_code && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        PoC
                      </div>
                      <pre className="text-xs font-mono bg-card border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {item.poc_code}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题 / 描述 / 文件路径"
              className="pl-9 h-9"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="all">全部严重度</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(event) => setVerificationFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="all">全部验证状态</option>
            <option value="verified">已验证</option>
            <option value="unverified">未验证</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {renderBody()}
      </div>
    </div>
  );
}

export default FindingsPanel;
