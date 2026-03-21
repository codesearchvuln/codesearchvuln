import type { SkillCatalogItemPayload } from "@/shared/api/database";
import type { SkillToolCatalogItem } from "./skillToolsCatalog.ts";

export type ExternalToolDisplayType = "PROMPT" | "CLI";

export interface ExternalToolRow {
  id: string;
  type: "skill";
  name: string;
  displayType: ExternalToolDisplayType;
  capabilities: string[];
  summary: string;
}

export const EXTERNAL_TOOLS_PAGE_SIZE = 6;

export interface ExternalToolListState {
  filteredRows: ExternalToolRow[];
  pageRows: ExternalToolRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  startIndex: number;
  searchQuery: string;
}

const CLI_SKILL_IDS = new Set(["run_code", "sandbox_exec"]);

export function resolveExternalToolDisplayType(
  skill: Pick<SkillCatalogItemPayload, "skill_id" | "has_scripts" | "has_bin">,
): ExternalToolDisplayType {
  if (skill.has_scripts || skill.has_bin || CLI_SKILL_IDS.has(skill.skill_id)) {
    return "CLI";
  }
  return "PROMPT";
}

function sanitizeCapabilities(values: string[]): string[] {
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);
}

export function buildExternalToolRows({
  skillCatalog,
  staticSkillCatalog,
}: {
  skillCatalog: SkillCatalogItemPayload[];
  staticSkillCatalog: SkillToolCatalogItem[];
}): ExternalToolRow[] {
  const staticCatalogById = new Map(
    staticSkillCatalog.map((item) => [item.id, item] as const),
  );

  return skillCatalog.map((skill) => {
    const staticSkill = staticCatalogById.get(skill.skill_id);
    const fallbackSummary = String(skill.summary || "").trim();
    const capabilities = sanitizeCapabilities(staticSkill?.taskList || []);

    return {
      id: skill.skill_id,
      type: "skill",
      name: String(skill.name || skill.skill_id),
      displayType: resolveExternalToolDisplayType(skill),
      capabilities:
        capabilities.length > 0
          ? capabilities
          : fallbackSummary
            ? [fallbackSummary]
            : ["暂无执行功能说明"],
      summary: fallbackSummary,
    };
  });
}

export function buildExternalToolListState({
  rows,
  searchQuery,
  page,
  pageSize = EXTERNAL_TOOLS_PAGE_SIZE,
}: {
  rows: ExternalToolRow[];
  searchQuery: string;
  page: number;
  pageSize?: number;
}): ExternalToolListState {
  const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
  const safePageSize = Math.max(1, Math.floor(pageSize) || EXTERNAL_TOOLS_PAGE_SIZE);
  const filteredRows = normalizedQuery
    ? rows.filter((row) => {
        const searchable = [
          row.name,
          row.displayType,
          row.summary,
          ...row.capabilities,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      })
    : rows;
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const normalizedPage =
    totalRows === 0 ? 1 : Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const startIndex = totalRows === 0 ? 0 : (normalizedPage - 1) * safePageSize;

  return {
    filteredRows,
    pageRows: filteredRows.slice(startIndex, startIndex + safePageSize),
    page: normalizedPage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    startIndex,
    searchQuery: String(searchQuery || ""),
  };
}
