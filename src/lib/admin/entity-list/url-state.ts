/**
 * Portable URL query helpers for list search/filters/pagination.
 * No entity or project names.
 */

export type AdminEntityUrlPatch = Record<string, string | null | undefined>;

export type AdminBoundedClientPaginationUrlState = {
  page: number;
  pageSize: number;
};

export type AdminBoundedClientPaginationUrlOptions = {
  pageParamName?: string;
  limitParamName?: string;
  defaultPageSize?: number;
};

export function applyAdminEntityUrlPatch(
  current: URLSearchParams,
  patch: AdminEntityUrlPatch,
  options?: {
    resetPageParam?: string;
    defaultPageSize?: string;
    limitParam?: string;
  },
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  const resetPageParam = options?.resetPageParam ?? "page";
  const limitParam = options?.limitParam ?? "limit";
  const defaultPageSize = options?.defaultPageSize ?? "10";

  Object.entries(patch).forEach(([key, value]) => {
    if (value == null || value === "") {
      next.delete(key);
      return;
    }
    if (key === limitParam && value === defaultPageSize) {
      next.delete(key);
      return;
    }
    next.set(key, value);
  });

  if (!(resetPageParam in patch)) {
    next.delete(resetPageParam);
  } else if (patch[resetPageParam] == null || patch[resetPageParam] === "") {
    next.delete(resetPageParam);
  }

  return next;
}

export function buildAdminEntityListHref(
  basePath: string,
  current: URLSearchParams,
  patch: AdminEntityUrlPatch,
  hash?: string,
): string {
  const next = applyAdminEntityUrlPatch(current, patch);
  const query = next.toString();
  const path = query ? `${basePath}?${query}` : basePath;
  return hash ? `${path}${hash.startsWith("#") ? hash : `#${hash}`}` : path;
}

/**
 * Writes the canonical URL state for a bounded client-side collection while
 * preserving query params owned by the surrounding page (tabs, feedback, etc.).
 */
export function writeAdminBoundedClientPaginationParams(
  current: URLSearchParams,
  state: AdminBoundedClientPaginationUrlState,
  options: AdminBoundedClientPaginationUrlOptions = {},
) {
  const pageParamName = options.pageParamName ?? "page";
  const limitParamName = options.limitParamName ?? "limit";
  const defaultPageSize = options.defaultPageSize ?? 10;

  return applyAdminEntityUrlPatch(
    current,
    {
      [pageParamName]: state.page <= 1 ? null : String(state.page),
      [limitParamName]: String(state.pageSize),
    },
    {
      resetPageParam: pageParamName,
      limitParam: limitParamName,
      defaultPageSize: String(defaultPageSize),
    },
  );
}
