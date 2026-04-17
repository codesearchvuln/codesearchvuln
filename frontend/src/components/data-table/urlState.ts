import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DataTableQueryState } from "./types";
import { createDefaultDataTableState } from "./queryState";

export interface DataTableUrlStateOptions {
  prefix?: string;
}

function withPrefix(key: string, options?: DataTableUrlStateOptions): string {
  const prefix = String(options?.prefix || "").trim();
  return `${prefix}${key}`;
}

function deserializeFilters(
  raw: string | null,
): DataTableQueryState["columnFilters"] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).map(([id, value]) => ({ id, value }));
  } catch {
    return [];
  }
}

function serializeFilters(state: DataTableQueryState["columnFilters"]): string {
  const payload = Object.fromEntries(
    state
      .filter((filter) => filter.value !== undefined && filter.value !== "")
      .map((filter) => [filter.id, filter.value]),
  );
  return JSON.stringify(payload);
}

export function parseDataTableUrlState(
  params: URLSearchParams,
  options?: DataTableUrlStateOptions,
): DataTableQueryState {
  const page = Math.max(1, Number(params.get(withPrefix("page", options)) || "1")) - 1;
  const pageSize = Math.max(
    1,
    Number(params.get(withPrefix("pageSize", options)) || "10"),
  );
  const sort = String(params.get(withPrefix("sort", options)) || "").trim();
  const order = String(params.get(withPrefix("order", options)) || "asc")
    .trim()
    .toLowerCase();
  return createDefaultDataTableState({
    globalFilter: String(params.get(withPrefix("q", options)) || ""),
    sorting: sort ? [{ id: sort, desc: order === "desc" }] : [],
    pagination: {
      pageIndex: Number.isFinite(page) ? page : 0,
      pageSize,
    },
    columnFilters: deserializeFilters(params.get(withPrefix("filters", options))),
  });
}

export function serializeDataTableUrlState(
  state: Partial<DataTableQueryState>,
  options?: DataTableUrlStateOptions,
): URLSearchParams {
  const params = new URLSearchParams();
  const globalFilter = String(state.globalFilter || "").trim();
  if (globalFilter) {
    params.set(withPrefix("q", options), globalFilter);
  }

  const sorting = state.sorting ?? [];
  if (sorting.length > 0) {
    params.set(withPrefix("sort", options), sorting[0]?.id ?? "");
    params.set(withPrefix("order", options), sorting[0]?.desc ? "desc" : "asc");
  }

  const pageIndex = state.pagination?.pageIndex ?? 0;
  const pageSize = state.pagination?.pageSize ?? 10;
  if (pageIndex > 0) {
    params.set(withPrefix("page", options), String(pageIndex + 1));
  }
  if (pageSize !== 10) {
    params.set(withPrefix("pageSize", options), String(pageSize));
  }

  const filters = state.columnFilters ?? [];
  if (filters.length > 0) {
    const serialized = serializeFilters(filters);
    if (serialized !== "{}") {
      params.set(withPrefix("filters", options), serialized);
    }
  }

  return params;
}

export function mergeDataTableUrlState(
  params: URLSearchParams,
  state: Partial<DataTableQueryState>,
  options?: DataTableUrlStateOptions,
): URLSearchParams {
  const nextParams = new URLSearchParams(params);
  ["q", "sort", "order", "page", "pageSize", "filters"].forEach((key) => {
    nextParams.delete(withPrefix(key, options));
  });
  const serialized = serializeDataTableUrlState(state, options);
  serialized.forEach((value, key) => {
    nextParams.set(key, value);
  });
  return nextParams;
}

export function useDataTableUrlState(
  enabled = true,
  options?: DataTableUrlStateOptions,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const prefix = String(options?.prefix || "").trim();

  const initialState = useMemo(() => {
    if (!enabled) return createDefaultDataTableState();
    return parseDataTableUrlState(searchParams, { prefix });
  }, [enabled, prefix, searchParams]);

  const syncStateToUrl = useCallback(
    (state: Partial<DataTableQueryState>) => {
      if (!enabled) return;
      setSearchParams(
        (current) =>
          mergeDataTableUrlState(new URLSearchParams(current), state, { prefix }),
        { replace: true },
      );
    },
    [enabled, prefix, setSearchParams],
  );

  return {
    initialState,
    syncStateToUrl,
  };
}
