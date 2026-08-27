"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { AdminEntityFilterDef, AdminEntityFilterValues } from "./types";
import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  normalizePageSize,
  resolveClientPagination,
  slicePageRows,
} from "./pagination";
import {
  applyAdminEntityUrlPatch,
  writeAdminBoundedClientPaginationParams,
  type AdminEntityUrlPatch,
} from "./url-state";

type HistoryBehavior = "push" | "replace";

export type AdminBoundedClientQueryState = {
  search: string;
  filters: AdminEntityFilterValues;
};

export type AdminBoundedClientQueryContract<Row> = {
  mode: "bounded-client";
  search?: {
    paramKey?: string;
    minLength?: number;
  };
  filters?: readonly AdminEntityFilterDef[];
  matchesRow: (row: Row, query: AdminBoundedClientQueryState) => boolean;
  getRowId: (row: Row) => string | number;
};

export type AdminBoundedClientPaginationOptions<Row> = {
  rows: readonly Row[];
  /** Stable identity of the complete collection scope, excluding query and sort. */
  datasetKey: string;
  queryContract: AdminBoundedClientQueryContract<Row>;
  pageParamName?: string;
  limitParamName?: string;
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
};

function currentLocationHref(params: URLSearchParams) {
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

/**
 * Shared URL/history owner for collections whose complete bounded dataset is
 * already available in the client. It deliberately does not fetch or cache.
 */
export function useAdminBoundedClientPagination<Row>({
  rows,
  datasetKey,
  queryContract,
  pageParamName = "page",
  limitParamName = "limit",
  pageSizeOptions = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  defaultPageSize = ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
}: AdminBoundedClientPaginationOptions<Row>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamName = queryContract.search?.paramKey ?? "q";
  const searchMinLength = queryContract.search?.minLength ?? 0;
  const rawSearch = (searchParams.get(searchParamName) ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const search = rawSearch.length >= searchMinLength ? rawSearch : "";
  const filterValues = useMemo(
    () =>
      Object.fromEntries(
        (queryContract.filters ?? []).map((filter) => [
          filter.paramKey,
          searchParams.get(filter.paramKey) ??
            filter.defaultValue ??
            filter.allValue ??
            "all",
        ]),
      ),
    [queryContract.filters, searchParams],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        queryContract.matchesRow(row, { search, filters: filterValues }),
      ),
    [filterValues, queryContract, rows, search],
  );
  const resolvedDatasetKey = useMemo(
    () =>
      [
        datasetKey,
        search,
        ...Object.entries(filterValues)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}:${value}`),
        ...filteredRows
          .map((row) => String(queryContract.getRowId(row)))
          .sort(),
      ].join("|"),
    [datasetKey, filterValues, filteredRows, queryContract, search],
  );
  const pagination = resolveClientPagination(
    filteredRows.length,
    searchParams.get(pageParamName),
    searchParams.get(limitParamName),
    pageSizeOptions,
    defaultPageSize,
  );
  const paginatedRows = useMemo(
    () => slicePageRows(filteredRows, pagination.page, pagination.pageSize),
    [filteredRows, pagination.page, pagination.pageSize],
  );

  const applyQueryPatch = useCallback(
    (patch: AdminEntityUrlPatch, behavior: HistoryBehavior = "push") => {
      const current = new URLSearchParams(window.location.search);
      const next = applyAdminEntityUrlPatch(current, patch, {
        resetPageParam: pageParamName,
        limitParam: limitParamName,
        defaultPageSize: String(defaultPageSize),
      });
      if (current.toString() === next.toString()) return;
      const href = currentLocationHref(next);
      if (behavior === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [defaultPageSize, limitParamName, pageParamName, router],
  );

  const commit = useCallback(
    (page: number, pageSize: number, behavior: HistoryBehavior) => {
      const current = new URLSearchParams(window.location.search);
      const next = writeAdminBoundedClientPaginationParams(
        current,
        { page, pageSize },
        { pageParamName, limitParamName, defaultPageSize },
      );
      if (current.toString() === next.toString()) return;

      const href = currentLocationHref(next);
      if (behavior === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [defaultPageSize, limitParamName, pageParamName, router],
  );

  const previousDatasetKey = useRef(resolvedDatasetKey);
  useEffect(() => {
    const datasetChanged = previousDatasetKey.current !== resolvedDatasetKey;
    previousDatasetKey.current = resolvedDatasetKey;

    const current = new URLSearchParams(window.location.search);
    const next = writeAdminBoundedClientPaginationParams(
      current,
      {
        page: datasetChanged ? 1 : pagination.page,
        pageSize: pagination.pageSize,
      },
      { pageParamName, limitParamName, defaultPageSize },
    );
    if (current.toString() === next.toString()) return;

    router.replace(currentLocationHref(next), { scroll: false });
  }, [
    resolvedDatasetKey,
    defaultPageSize,
    limitParamName,
    pageParamName,
    pagination.page,
    pagination.pageSize,
    router,
  ]);

  const setPage = useCallback(
    (page: number) => commit(page, pagination.pageSize, "push"),
    [commit, pagination.pageSize],
  );
  const setPageSize = useCallback(
    (pageSize: number) =>
      commit(
        1,
        normalizePageSize(pageSize, pageSizeOptions, defaultPageSize),
        "push",
      ),
    [commit, defaultPageSize, pageSizeOptions],
  );
  const resetPage = useCallback(
    () => commit(1, pagination.pageSize, "replace"),
    [commit, pagination.pageSize],
  );

  return {
    ...pagination,
    search,
    filterValues,
    rows: paginatedRows,
    applyQueryPatch,
    setPage,
    setPageSize,
    resetPage,
  };
}
