import { z } from "zod";

import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
} from "../entity-list/pagination.ts";
import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";

export const activityLogSortFields = ["created_at"] as const;
export type ActivityLogSortField = (typeof activityLogSortFields)[number];

export type ActivityLogFilters = {
  actorUsername: string;
  action: string;
  entityType: string;
  dateFrom: string;
  dateTo: string;
};

const boundedFilterSchema = z.string().trim().min(1).max(200);
const optionalDateSchema = z.union([z.literal(""), z.iso.date()]);

function normalizeFilter(params: URLSearchParams, key: string) {
  const parsed = boundedFilterSchema.safeParse(params.get(key));
  return parsed.success ? parsed.data : "";
}

function normalizeDateFilter(params: URLSearchParams, key: string) {
  const parsed = z.iso.date().safeParse(params.get(key));
  return parsed.success ? parsed.data : "";
}

export const activityLogQueryContract: AdminEntityListQueryContract<
  ActivityLogFilters,
  ActivityLogSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    actorUsername: z.string().max(200),
    action: z.string().max(200),
    entityType: z.string().max(200),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
  }),
  sortFields: activityLogSortFields,
  defaultSort: { field: "created_at", direction: "desc" },
  defaultPageSize: ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions: ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  maxPageSize: 50,
  searchMinLength: 0,
  rawFilterSchemas: {
    actor: boundedFilterSchema,
    action: boundedFilterSchema,
    entityType: boundedFilterSchema,
    dateFrom: z.iso.date(),
    dateTo: z.iso.date(),
  },
  parseFilters(params) {
    return {
      actorUsername: normalizeFilter(params, "actor"),
      action: normalizeFilter(params, "action"),
      entityType: normalizeFilter(params, "entityType"),
      dateFrom: normalizeDateFilter(params, "dateFrom"),
      dateTo: normalizeDateFilter(params, "dateTo"),
    };
  },
  writeFilters(filters, params) {
    ["actor", "action", "entityType", "dateFrom", "dateTo"].forEach(
      (key) => params.delete(key),
    );
    if (filters.actorUsername) params.set("actor", filters.actorUsername);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
  },
};
