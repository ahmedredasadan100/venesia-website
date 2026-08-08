import { z } from "zod";

import { TOPICS_LIST_PAGE_SIZES } from "../topics-list-config";
import type { ContentType } from "../content-types";
import type { AdminEntityListQueryContract } from "../../entity-list/data-engine/contracts";

export const topicSortFields = [
  "id",
  "title",
  "content_type",
  "category",
  "series",
  "featured",
  "seo",
  "views",
  "created_at",
  "updated_at",
  "created_by",
  "status",
] as const;
export type TopicSortField = (typeof topicSortFields)[number];

export type TopicFilters = {
  view: "active" | "trash";
  contentType: ContentType | "all";
  categoryId: number | null;
  seriesId: number | "any" | null;
  status: "all" | "published" | "unpublished";
  featured: "all" | "yes" | "no";
  image: "all" | "without";
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
    view: z.enum(["active", "trash"]),
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
    seriesId: z.union([z.number().int().positive(), z.literal("any")]).nullable(),
    status: z.enum(["all", "published", "unpublished"]),
    featured: z.enum(["all", "yes", "no"]),
    image: z.enum(["all", "without"]),
  }),
  sortFields: topicSortFields,
  defaultSort: { field: "title", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: TOPICS_LIST_PAGE_SIZES,
  maxPageSize: 50,
  searchMinLength: 2,
  rawFilterSchemas: {
    view: z.enum(["active", "trash"]),
    content_type: z.enum([
      "all",
      "article",
      "news",
      "press",
      "site_update",
      "video",
      "gallery",
    ]),
    category: z.string().regex(/^[1-9]\d{0,8}$/),
    series: z.union([z.string().regex(/^[1-9]\d{0,8}$/), z.literal("any")]),
    status: z.enum(["all", "published", "unpublished"]),
    featured: z.enum(["all", "yes", "no"]),
    image: z.enum(["all", "without"]),
  },
  parseFilters(params) {
    const view = params.get("view");
    const contentType = params.get("content_type");
    const status = params.get("status");
    const featured = params.get("featured");
    const series = params.get("series");
    const image = params.get("image");
    return {
      view: view === "trash" ? "trash" : "active",
      contentType:
        contentType &&
        ["article", "news", "press", "site_update", "video", "gallery"].includes(
          contentType,
        )
          ? contentType
          : "all",
      categoryId: positiveId(params.get("category")),
      seriesId: series === "any" ? "any" : positiveId(series),
      status:
        status &&
        ["published", "unpublished"].includes(status)
          ? status
          : "all",
      featured:
        featured === "yes" || featured === "no" ? featured : "all",
      image: image === "without" ? "without" : "all",
    };
  },
  writeFilters(filters, params) {
    ["view", "content_type", "category", "series", "status", "featured", "image"].forEach((key) =>
      params.delete(key),
    );
    if (filters.view === "trash") params.set("view", "trash");
    if (filters.contentType !== "all") {
      params.set("content_type", filters.contentType);
    }
    if (filters.categoryId) params.set("category", String(filters.categoryId));
    if (filters.seriesId) params.set("series", String(filters.seriesId));
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.featured !== "all") params.set("featured", filters.featured);
    if (filters.image !== "all") params.set("image", filters.image);
  },
};
