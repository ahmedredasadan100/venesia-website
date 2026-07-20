import { z } from "zod";

export const ADMIN_ENTITY_LIST_DATA_MODES = [
  "server-page",
  "bounded-client",
] as const;

export type AdminEntityListDataMode =
  (typeof ADMIN_ENTITY_LIST_DATA_MODES)[number];

export type AdminEntityListSort<SortField extends string = string> = {
  field: SortField;
  direction: "asc" | "desc";
};

export type AdminEntityListQuery<
  Filters extends Record<string, unknown> = Record<string, never>,
  SortField extends string = string,
> = {
  search: string;
  filters: Filters;
  sort: AdminEntityListSort<SortField>;
  page: number;
  pageSize: number;
  mode: AdminEntityListDataMode;
};

export type AdminEntityListResult<Row, Metrics = unknown> = {
  rows: Row[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  metrics?: Metrics;
  meta: {
    generatedAt: string;
    mode: AdminEntityListDataMode;
  };
};

export type AdminEntityListQueryContract<
  Filters extends Record<string, unknown>,
  SortField extends string,
> = {
  mode: AdminEntityListDataMode;
  filtersSchema: z.ZodType<Filters>;
  sortFields: readonly SortField[];
  defaultSort: AdminEntityListSort<SortField>;
  defaultPageSize: number;
  pageSizeOptions: readonly number[];
  maxPageSize: number;
  searchMinLength: number;
  /**
   * Raw request boundary: per URL param key, the values this contract accepts
   * verbatim. Used by the strict endpoint parser before canonical
   * normalization; lenient RSC normalization does not consult these.
   */
  rawFilterSchemas: Record<string, z.ZodType>;
  parseFilters: (params: URLSearchParams) => unknown;
  writeFilters: (filters: Filters, params: URLSearchParams) => void;
};

const sortDirectionSchema = z.enum(["asc", "desc"]);

function normalizeSearch(value: string | null, minLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length >= minLength ? normalized : "";
}

function normalizePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

function parseSort<SortField extends string>(
  value: string | null,
  fields: readonly SortField[],
  fallback: AdminEntityListSort<SortField>,
): AdminEntityListSort<SortField> {
  if (!value) return fallback;
  const match = /^(.*)_(asc|desc)$/.exec(value);
  if (!match || !fields.includes(match[1] as SortField)) return fallback;
  const direction = sortDirectionSchema.safeParse(match[2]);
  if (!direction.success) return fallback;
  return { field: match[1] as SortField, direction: direction.data };
}

export class AdminEntityListQueryValidationError extends Error {
  issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid entity list query: ${issues.join("; ")}`);
    this.name = "AdminEntityListQueryValidationError";
    this.issues = issues;
  }
}

const RAW_POSITIVE_INT_PATTERN = /^[1-9]\d{0,8}$/;

/**
 * Strict request-boundary parser. Raw values are validated verbatim and any
 * invalid input is rejected instead of being silently coerced to defaults.
 * Canonical normalization runs only after raw validation succeeds.
 */
export function parseAdminEntityListRequestQuery<
  Filters extends Record<string, unknown>,
  SortField extends string,
>(
  contract: AdminEntityListQueryContract<Filters, SortField>,
  source: URLSearchParams | string,
): AdminEntityListQuery<Filters, SortField> {
  const params =
    typeof source === "string" ? new URLSearchParams(source) : source;
  const issues: string[] = [];
  const ownedKeys = new Set([
    "q",
    "sort",
    "page",
    "limit",
    ...Object.keys(contract.rawFilterSchemas),
  ]);

  for (const key of new Set(params.keys())) {
    if (!ownedKeys.has(key)) {
      issues.push(`unknown parameter "${key}"`);
    } else if (params.getAll(key).length > 1) {
      issues.push(`parameter "${key}" is repeated`);
    }
  }

  const rawPage = params.get("page");
  if (rawPage !== null && !RAW_POSITIVE_INT_PATTERN.test(rawPage)) {
    issues.push('parameter "page" must be a positive integer');
  }

  const rawLimit = params.get("limit");
  if (
    rawLimit !== null &&
    !contract.pageSizeOptions.some((option) => String(option) === rawLimit)
  ) {
    issues.push(
      `parameter "limit" must be one of ${contract.pageSizeOptions.join(", ")}`,
    );
  }

  const rawSort = params.get("sort");
  if (rawSort !== null) {
    const match = /^(.+)_(asc|desc)$/.exec(rawSort);
    if (!match || !contract.sortFields.includes(match[1] as SortField)) {
      issues.push(`parameter "sort" value "${rawSort}" is not supported`);
    }
  }

  for (const [key, schema] of Object.entries(contract.rawFilterSchemas)) {
    const value = params.get(key);
    if (value !== null && !schema.safeParse(value).success) {
      issues.push(`parameter "${key}" value is invalid`);
    }
  }

  if (issues.length > 0) {
    throw new AdminEntityListQueryValidationError(issues);
  }
  return normalizeAdminEntityListQuery(contract, params);
}

export const adminEntityListRawPositiveIntSchema = z
  .string()
  .regex(RAW_POSITIVE_INT_PATTERN);

export function normalizeAdminEntityListQuery<
  Filters extends Record<string, unknown>,
  SortField extends string,
>(
  contract: AdminEntityListQueryContract<Filters, SortField>,
  source: URLSearchParams | string,
): AdminEntityListQuery<Filters, SortField> {
  const params =
    typeof source === "string" ? new URLSearchParams(source) : source;
  const requestedPageSize = normalizePositiveInteger(
    params.get("limit"),
    contract.defaultPageSize,
    contract.maxPageSize,
  );
  const pageSize = contract.pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : contract.defaultPageSize;

  return {
    search: normalizeSearch(params.get("q"), contract.searchMinLength),
    filters: contract.filtersSchema.parse(contract.parseFilters(params)),
    sort: parseSort(
      params.get("sort"),
      contract.sortFields,
      contract.defaultSort,
    ),
    page: normalizePositiveInteger(params.get("page"), 1, Number.MAX_SAFE_INTEGER),
    pageSize,
    mode: contract.mode,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function serializeAdminEntityListQuery(
  query: AdminEntityListQuery<Record<string, unknown>, string>,
) {
  return JSON.stringify(stableValue(query));
}

/**
 * Dataset membership for optimistic total/row removal patches.
 * search/filters/mode define membership; page/sort/pageSize are view params only.
 * Empty search may be omitted from serialized query keys, so normalize before compare.
 */
export function isSameAdminEntityListScope(
  left: AdminEntityListQuery<Record<string, unknown>, string>,
  right: AdminEntityListQuery<Record<string, unknown>, string>,
) {
  return (
    (left.search ?? "") === (right.search ?? "") &&
    left.mode === right.mode &&
    JSON.stringify(stableValue(left.filters ?? {})) ===
      JSON.stringify(stableValue(right.filters ?? {}))
  );
}

export function parseAdminEntityListQueryFromKey(
  queryKey: readonly unknown[],
): AdminEntityListQuery<Record<string, unknown>, string> | null {
  if (queryKey.length < 4 || typeof queryKey[3] !== "string") return null;
  try {
    const parsed = JSON.parse(queryKey[3]) as AdminEntityListQuery<
      Record<string, unknown>,
      string
    >;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.page !== "number" ||
      typeof parsed.pageSize !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeAdminEntityListQuery<
  Filters extends Record<string, unknown>,
  SortField extends string,
>(
  contract: AdminEntityListQueryContract<Filters, SortField>,
  query: AdminEntityListQuery<Filters, SortField>,
  current?: URLSearchParams,
) {
  const params = new URLSearchParams(current?.toString());
  params.delete("q");
  params.delete("sort");
  params.delete("page");
  params.delete("limit");

  if (query.search) params.set("q", query.search);
  contract.writeFilters(query.filters, params);

  if (
    query.sort.field !== contract.defaultSort.field ||
    query.sort.direction !== contract.defaultSort.direction
  ) {
    params.set("sort", `${query.sort.field}_${query.sort.direction}`);
  }
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== contract.defaultPageSize) {
    params.set("limit", String(query.pageSize));
  }

  params.sort();
  return params;
}

export function createAdminEntityListResultSchema<
  RowSchema extends z.ZodType,
  MetricsSchema extends z.ZodType | undefined = undefined,
>(
  rowSchema: RowSchema,
  metricsSchema?: MetricsSchema,
): z.ZodType<
  AdminEntityListResult<
    z.output<RowSchema>,
    MetricsSchema extends z.ZodType ? z.output<MetricsSchema> : unknown
  >
> {
  const schema = z.object({
    rows: z.array(rowSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      totalRows: z.number().int().nonnegative(),
      totalPages: z.number().int().positive(),
    }),
    ...(metricsSchema ? { metrics: metricsSchema.optional() } : {}),
    meta: z.object({
      generatedAt: z.string(),
      mode: z.enum(ADMIN_ENTITY_LIST_DATA_MODES),
    }),
  });
  return schema as unknown as z.ZodType<
    AdminEntityListResult<
      z.output<RowSchema>,
      MetricsSchema extends z.ZodType ? z.output<MetricsSchema> : unknown
    >
  >;
}
