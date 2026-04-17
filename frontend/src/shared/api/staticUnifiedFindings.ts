import { apiClient } from "@/shared/api/serverClient";

export type UnifiedStaticFindingEngine =
  | "opengrep"
  | "gitleaks"
  | "bandit"
  | "phpstan"
  | "pmd"
  | "yasa";

export type UnifiedStaticFindingSortBy =
  | "severity"
  | "confidence"
  | "file_path"
  | "line"
  | "created_at";

export type UnifiedStaticFindingSortOrder = "asc" | "desc";

export interface UnifiedStaticFindingsQuery {
  opengrepTaskId?: string;
  gitleaksTaskId?: string;
  banditTaskId?: string;
  phpstanTaskId?: string;
  yasaTaskId?: string;
  pmdTaskId?: string;
  page: number;
  pageSize: number;
  engine?: UnifiedStaticFindingEngine;
  status?: "open" | "verified" | "false_positive";
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  keyword?: string;
  sortBy?: UnifiedStaticFindingSortBy;
  sortOrder?: UnifiedStaticFindingSortOrder;
}

export interface UnifiedStaticFindingItem {
  engine: UnifiedStaticFindingEngine;
  id: string;
  task_id: string;
  rule: string;
  file_path: string;
  line: number | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: string;
}

export interface UnifiedStaticFindingsPage {
  items: UnifiedStaticFindingItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function getUnifiedStaticFindings(
  query: UnifiedStaticFindingsQuery,
): Promise<UnifiedStaticFindingsPage> {
  const searchParams = new URLSearchParams();

  const appendIfPresent = (key: string, value?: string | number | null) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    searchParams.set(key, normalized);
  };

  appendIfPresent("opengrep_task_id", query.opengrepTaskId);
  appendIfPresent("gitleaks_task_id", query.gitleaksTaskId);
  appendIfPresent("bandit_task_id", query.banditTaskId);
  appendIfPresent("phpstan_task_id", query.phpstanTaskId);
  appendIfPresent("yasa_task_id", query.yasaTaskId);
  appendIfPresent("pmd_task_id", query.pmdTaskId);

  appendIfPresent("page", query.page);
  appendIfPresent("page_size", query.pageSize);
  appendIfPresent("engine", query.engine);
  appendIfPresent("status", query.status);
  appendIfPresent("severity", query.severity);
  appendIfPresent("confidence", query.confidence);
  appendIfPresent("keyword", query.keyword);
  appendIfPresent("sort_by", query.sortBy);
  appendIfPresent("sort_order", query.sortOrder);

  const queryString = searchParams.toString();
  const response = await apiClient.get(
    `/static-tasks/findings/unified${queryString ? `?${queryString}` : ""}`,
  );

  return response.data;
}
