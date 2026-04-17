import {
  createDefaultDataTableState,
  type DataTableQueryState,
} from "@/components/data-table";
import type {
  UnifiedStaticFindingsQuery,
  UnifiedStaticFindingSortBy,
} from "@/shared/api/staticUnifiedFindings";

const DEFAULT_PAGE_SIZE = 15;
const DEFAULT_SORT_BY: UnifiedStaticFindingSortBy = "severity";

function getColumnFilterValue(
  state: DataTableQueryState,
  columnId: string,
): unknown {
  return state.columnFilters.find((filter) => filter.id === columnId)?.value;
}

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function toOptionalFilterValue(value: unknown): string | undefined {
  const normalized = toTrimmedString(value);
  return normalized ? normalized : undefined;
}

function resolveSortBy(state: DataTableQueryState): UnifiedStaticFindingSortBy {
  const sorting = state.sorting[0];
  if (!sorting) return DEFAULT_SORT_BY;
  if (sorting.id === "confidence") return "confidence";
  if (sorting.id === "location") return "file_path";
  if (sorting.id === "line") return "line";
  if (sorting.id === "created_at") return "created_at";
  return "severity";
}

function resolveSortOrder(state: DataTableQueryState): "asc" | "desc" {
  const sorting = state.sorting[0];
  if (!sorting) return "desc";
  return sorting.desc ? "desc" : "asc";
}

export function resolveStaticAnalysisTableState(
  initialState: DataTableQueryState,
): DataTableQueryState {
  return createDefaultDataTableState({
    ...initialState,
    sorting:
      initialState.sorting.length > 0
        ? initialState.sorting
        : [{ id: "severity", desc: true }],
    pagination: {
      pageIndex: initialState.pagination.pageIndex,
      pageSize: initialState.pagination.pageSize || DEFAULT_PAGE_SIZE,
    },
    columnVisibility: {
      ...initialState.columnVisibility,
      location: false,
    },
  });
}

export function createStaticAnalysisInitialTableState(
  initialState: DataTableQueryState,
): DataTableQueryState {
  return resolveStaticAnalysisTableState(initialState);
}

export function buildStaticAnalysisUnifiedFindingsQuery(input: {
  state: DataTableQueryState;
  opengrepTaskId: string;
  gitleaksTaskId: string;
  banditTaskId: string;
  phpstanTaskId: string;
  yasaTaskId: string;
  pmdTaskId: string;
}): UnifiedStaticFindingsQuery {
  const pageIndex = Math.max(0, Number(input.state.pagination.pageIndex || 0));
  const pageSize = Math.max(1, Number(input.state.pagination.pageSize || DEFAULT_PAGE_SIZE));

  return {
    opengrepTaskId: toOptionalFilterValue(input.opengrepTaskId),
    gitleaksTaskId: toOptionalFilterValue(input.gitleaksTaskId),
    banditTaskId: toOptionalFilterValue(input.banditTaskId),
    phpstanTaskId: toOptionalFilterValue(input.phpstanTaskId),
    yasaTaskId: toOptionalFilterValue(input.yasaTaskId),
    pmdTaskId: toOptionalFilterValue(input.pmdTaskId),
    page: pageIndex + 1,
    pageSize,
    engine: toOptionalFilterValue(getColumnFilterValue(input.state, "engine")) as
      | UnifiedStaticFindingsQuery["engine"]
      | undefined,
    status: toOptionalFilterValue(getColumnFilterValue(input.state, "status")) as
      | UnifiedStaticFindingsQuery["status"]
      | undefined,
    severity: toOptionalFilterValue(getColumnFilterValue(input.state, "severity")) as
      | UnifiedStaticFindingsQuery["severity"]
      | undefined,
    confidence: toOptionalFilterValue(getColumnFilterValue(input.state, "confidence")) as
      | UnifiedStaticFindingsQuery["confidence"]
      | undefined,
    keyword:
      toOptionalFilterValue(getColumnFilterValue(input.state, "rule")) ??
      toOptionalFilterValue(input.state.globalFilter),
    sortBy: resolveSortBy(input.state),
    sortOrder: resolveSortOrder(input.state),
  };
}
