import { z } from "zod";

import { TOPICS_LIST_PAGE_SIZES } from "../topics-list-config";
import type { ContentType } from "../content-types";
import type { AdminEntityListQueryContract } from "../../entity-list/data-engine/contracts";

export const topicSortFields = [
  "id",
  "title",
  "category",
  "views",
  "created_at",
  "updated_at",
  "created_by",
  "status",
] as const;
export type TopicSortField = (typeof topicSortFields)[number];

export type TopicFilters = {
  contentType: ContentType | "all";
  categoryId: number | null;
  seriesId: number | null;
  status: "all" | "published" | "draft" | "unpublished" | "archived";
  featured: "all" | "yes" | "no";
};

function positiveId(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export const topicsQueryContract: AdminEntityListQueryContract<
  TopicFilters,
  TopicSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    contentType: z.enum([
      "all",
      "article",
      "news",
      "press",
      "site_update",
      "video",
      "gallery",
    ]),
    categoryId: z.number().int().positive().nullable(),
    seriesId: z.number().int().positive().nullable(),
    status: z.enum(["all", "published", "draft", "unpublished", "archived"]),
    featured: z.enum(["all", "yes", "no"]),
  }),
  sortFields: topicSortFields,
  defaultSort: { field: "title", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: TOPICS_LIST_PAGE_SIZES,
  maxPageSize: 50,
  searchMinLength: 2,
  parseFilters(params) {
    const contentType = params.get("content_type");
    const status = params.get("status");
    const featured = params.get("featured");
    return {
      contentType:
        contentType &&
        ["article", "news", "press", "site_update", "video", "gallery"].includes(
          contentType,
        )
          ? contentType
          : "all",
      categoryId: positiveId(params.get("category")),
      seriesId: positiveId(params.get("series")),
      status:
        status &&
        ["published", "draft", "unpublished", "archived"].includes(status)
          ? status
          : "all",
      featured:
        featured === "yes" || featured === "no" ? featured : "all",
    };
  },
  writeFilters(filters, params) {
    ["content_type", "category", "series", "status", "featured"].forEach((key) =>
      params.delete(key),
    );
    if (filters.contentType !== "all") {
      params.set("content_type", filters.contentType);
    }
    if (filters.categoryId) params.set("category", String(filters.categoryId));
    if (filters.seriesId) params.set("series", String(filters.seriesId));
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.featured !== "all") params.set("featured", filters.featured);
  },
};
