/**
 * Portable pagination helpers — no entity or project names.
 */

export const ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE = 10;
export const ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

export function normalizePageSize(
  raw: string | number | null | undefined,
  options: readonly number[] = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  defaultSize: number = ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
): number {
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (Number.isFinite(parsed) && options.includes(parsed)) return parsed;
  return defaultSize;
}

export function computeTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function normalizePage(
  raw: string | number | null | undefined,
  totalPages: number,
): number {
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), Math.max(1, totalPages));
}

export function computePageRange(
  page: number,
  pageSize: number,
  totalCount: number,
): { rangeStart: number; rangeEnd: number } {
  if (totalCount <= 0) return { rangeStart: 0, rangeEnd: 0 };
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  return { rangeStart, rangeEnd };
}

export function slicePageRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export type AdminEntityPaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export function resolveClientPagination(
  totalCount: number,
  rawPage: string | number | null | undefined,
  rawLimit: string | number | null | undefined,
  options: readonly number[] = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  defaultSize: number = ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
): AdminEntityPaginationState {
  const pageSize = normalizePageSize(rawLimit, options, defaultSize);
  const totalPages = computeTotalPages(totalCount, pageSize);
  const page = normalizePage(rawPage, totalPages);
  const { rangeStart, rangeEnd } = computePageRange(page, pageSize, totalCount);
  return { page, pageSize, totalCount, totalPages, rangeStart, rangeEnd };
}
