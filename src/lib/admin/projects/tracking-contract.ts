import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";
import { ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS } from "../entity-list/pagination";
import { projectTrackingMediaReferenceSchema } from "../../projects/tracking/contract";

export const PROJECT_TRACKING_ENTITY_KEYS = {
  stages: "project_tracking_stages",
  items: "project_tracking_items",
  updates: "project_tracking_updates",
} as const;

const positiveId = z.coerce.number().int().positive();
const visibility = z.enum(["all", "visible", "hidden"]);
const publication = z.enum(["all", "draft", "published", "unpublished", "archived"]);
const itemStatus = z.enum(["all", "not_started", "in_progress", "completed"]);

export const trackingStageRowSchema = z.object({
  id: positiveId,
  project_id: positiveId,
  name: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  start_date: z.string().nullable(),
  planned_duration_value: z.coerce.number().int().positive().nullable(),
  planned_duration_unit: z.enum(["day", "week", "month"]).nullable(),
  is_visible: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  item_count: z.coerce.number().int().nonnegative(),
  update_count: z.coerce.number().int().nonnegative(),
  derived_status: z.enum(["not_started", "in_progress", "completed"]),
});
export type TrackingStageRow = z.infer<typeof trackingStageRowSchema>;

export const trackingItemRowSchema = z.object({
  id: positiveId,
  stage_id: positiveId,
  name: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  start_date: z.string().nullable(),
  completion_date: z.string().nullable(),
  is_visible: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  update_count: z.coerce.number().int().nonnegative(),
});
export type TrackingItemRow = z.infer<typeof trackingItemRowSchema>;

export const trackingMediaAdminSchema = z.object({
  id: positiveId,
  client_key: z.string().uuid(),
  update_id: positiveId,
  media_kind: z.enum(["image", "video"]),
  public_url: projectTrackingMediaReferenceSchema,
  poster_url: projectTrackingMediaReferenceSchema.nullable(),
  title: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
});
export type TrackingMediaAdminRow = z.infer<typeof trackingMediaAdminSchema>;

export const trackingUpdateRowSchema = z.object({
  id: positiveId,
  item_id: positiveId,
  title: z.string().min(1),
  body: z.string().min(1),
  occurred_at: z.string().min(1),
  publication_status: z.enum(["draft", "published", "unpublished", "archived"]),
  published_at: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  media: z.array(trackingMediaAdminSchema),
});
export type TrackingUpdateRow = z.infer<typeof trackingUpdateRowSchema>;

export const trackingStageMetricsSchema = z.object({
  project: z.object({ id: positiveId, slug: z.string(), arabic_name: z.string(), publication_status: z.string() }),
  profile: z.object({ project_id: positiveId, project_receipt_date: z.string().nullable(), license_receipt_date: z.string().nullable(), contractor_name: z.string().nullable() }).nullable(),
});
export type TrackingStageMetrics = z.infer<typeof trackingStageMetricsSchema>;

export const trackingItemMetricsSchema = z.object({
  project: z.object({ id: positiveId, slug: z.string(), arabic_name: z.string() }),
  stage: trackingStageRowSchema.pick({ id: true, project_id: true, name: true, description: true, sort_order: true, start_date: true, planned_duration_value: true, planned_duration_unit: true, is_visible: true, created_at: true, updated_at: true }).extend({ item_count: z.number().int().nonnegative(), update_count: z.number().int().nonnegative(), derived_status: z.enum(["not_started", "in_progress", "completed"]) }),
});
export type TrackingItemMetrics = z.infer<typeof trackingItemMetricsSchema>;

export const trackingUpdateMetricsSchema = z.object({
  project: z.object({ id: positiveId, slug: z.string(), arabic_name: z.string() }),
  stage: z.object({ id: positiveId, name: z.string() }),
  item: trackingItemRowSchema,
});
export type TrackingUpdateMetrics = z.infer<typeof trackingUpdateMetricsSchema>;

const idRaw = z.string().regex(/^[1-9]\d{0,8}$/);
const shared = {
  mode: "server-page" as const,
  defaultPageSize: 20,
  pageSizeOptions: ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  maxPageSize: 50,
  searchMinLength: 1,
};

export type TrackingStageFilters = { projectId: number; visibility: z.infer<typeof visibility> };
export type TrackingStageSort = "sort_order" | "name" | "updated_at";
export const trackingStagesQueryContract: AdminEntityListQueryContract<TrackingStageFilters, TrackingStageSort> = {
  ...shared,
  filtersSchema: z.strictObject({ projectId: positiveId, visibility }),
  sortFields: ["sort_order", "name", "updated_at"],
  defaultSort: { field: "sort_order", direction: "asc" },
  rawFilterSchemas: { project_id: idRaw, visibility: z.enum(["visible", "hidden"]) },
  parseFilters(params) { return { projectId: Number(params.get("project_id")), visibility: params.get("visibility") ?? "all" }; },
  writeFilters(filters, params) { params.set("project_id", String(filters.projectId)); params.delete("visibility"); if (filters.visibility !== "all") params.set("visibility", filters.visibility); },
};

export type TrackingItemFilters = { projectId: number; stageId: number; visibility: z.infer<typeof visibility>; status: z.infer<typeof itemStatus> };
export type TrackingItemSort = "sort_order" | "name" | "status" | "updated_at";
export const trackingItemsQueryContract: AdminEntityListQueryContract<TrackingItemFilters, TrackingItemSort> = {
  ...shared,
  filtersSchema: z.strictObject({ projectId: positiveId, stageId: positiveId, visibility, status: itemStatus }),
  sortFields: ["sort_order", "name", "status", "updated_at"],
  defaultSort: { field: "sort_order", direction: "asc" },
  rawFilterSchemas: { project_id: idRaw, stage_id: idRaw, visibility: z.enum(["visible", "hidden"]), status: z.enum(["not_started", "in_progress", "completed"]) },
  parseFilters(params) { return { projectId: Number(params.get("project_id")), stageId: Number(params.get("stage_id")), visibility: params.get("visibility") ?? "all", status: params.get("status") ?? "all" }; },
  writeFilters(filters, params) { params.set("project_id", String(filters.projectId)); params.set("stage_id", String(filters.stageId)); params.delete("visibility"); params.delete("status"); if (filters.visibility !== "all") params.set("visibility", filters.visibility); if (filters.status !== "all") params.set("status", filters.status); },
};

export type TrackingUpdateFilters = { projectId: number; itemId: number; publication: z.infer<typeof publication> };
export type TrackingUpdateSort = "occurred_at" | "title" | "publication_status" | "updated_at";
export const trackingUpdatesQueryContract: AdminEntityListQueryContract<TrackingUpdateFilters, TrackingUpdateSort> = {
  ...shared,
  filtersSchema: z.strictObject({ projectId: positiveId, itemId: positiveId, publication }),
  sortFields: ["occurred_at", "title", "publication_status", "updated_at"],
  defaultSort: { field: "occurred_at", direction: "desc" },
  rawFilterSchemas: { project_id: idRaw, item_id: idRaw, publication: z.enum(["draft", "published", "unpublished", "archived"]) },
  parseFilters(params) { return { projectId: Number(params.get("project_id")), itemId: Number(params.get("item_id")), publication: params.get("publication") ?? "all" }; },
  writeFilters(filters, params) { params.set("project_id", String(filters.projectId)); params.set("item_id", String(filters.itemId)); params.delete("publication"); if (filters.publication !== "all") params.set("publication", filters.publication); },
};

export function trackingProjectPath(projectId: number) { return `/admin/projects/${projectId}/tracking`; }
export function trackingStagePath(projectId: number, stageId: number) { return `${trackingProjectPath(projectId)}/stages/${stageId}`; }
export function trackingItemPath(projectId: number, itemId: number) { return `${trackingProjectPath(projectId)}/items/${itemId}`; }
