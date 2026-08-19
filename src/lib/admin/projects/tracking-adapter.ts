import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import { loadNormalizedAdminEntityListPage, type AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
import { createAdminEntityListResultSchema, type AdminEntityListQuery } from "../entity-list/data-engine/contracts";
import {
  deriveProjectTrackingStageStatus,
} from "../../projects/tracking/contract";
import {
  PROJECT_TRACKING_ENTITY_KEYS,
  trackingItemMetricsSchema,
  trackingItemRowSchema,
  trackingItemsQueryContract,
  trackingStageMetricsSchema,
  trackingStageRowSchema,
  trackingStagesQueryContract,
  trackingUpdateMetricsSchema,
  trackingUpdateRowSchema,
  trackingUpdatesQueryContract,
  type TrackingItemFilters,
  type TrackingItemRow,
  type TrackingItemSort,
  type TrackingStageFilters,
  type TrackingStageRow,
  type TrackingStageSort,
  type TrackingUpdateFilters,
  type TrackingUpdateRow,
  type TrackingUpdateSort,
} from "./tracking-contract";

const stageBaseSchema = trackingStageRowSchema.omit({ item_count: true, update_count: true, derived_status: true });
const itemBaseSchema = trackingItemRowSchema.omit({ update_count: true });
const updateBaseSchema = trackingUpdateRowSchema.omit({ media: true });
const relationCountSchema = z.array(
  z.object({ count: z.coerce.number().int().nonnegative() }),
);
const stageWithAggregatesSchema = stageBaseSchema.extend({
  project_tracking_items: z.array(
    z.object({
      status: z.enum(["not_started", "in_progress", "completed"]),
      project_tracking_updates: relationCountSchema,
    }),
  ),
});
const itemWithAggregateSchema = itemBaseSchema.extend({
  project_tracking_updates: relationCountSchema,
});
export const trackingStagesResultSchema = createAdminEntityListResultSchema(trackingStageRowSchema, trackingStageMetricsSchema);
export const trackingItemsResultSchema = createAdminEntityListResultSchema(trackingItemRowSchema, trackingItemMetricsSchema);
export const trackingUpdatesResultSchema = createAdminEntityListResultSchema(trackingUpdateRowSchema, trackingUpdateMetricsSchema);

export class ProjectTrackingAdminReadError extends Error {
  readonly code: string;
  constructor(message: string, code = "project_tracking_admin_read_failed") {
    super(message);
    this.name = "ProjectTrackingAdminReadError";
    this.code = code;
  }
}

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  throw new ProjectTrackingAdminReadError(error?.message ?? fallback, error?.code);
}

function resultMeta(query: { mode: "server-page" | "bounded-client" }) {
  return { generatedAt: new Date().toISOString(), mode: query.mode };
}

async function projectSummary(projectId: number) {
  const { data, error } = await getSupabaseAdmin().from("projects").select("id,slug,arabic_name,publication_status").eq("id", projectId).maybeSingle();
  if (error) fail(error, "تعذر تحميل المشروع.");
  if (!data) throw new ProjectTrackingAdminReadError("المشروع غير موجود.", "project_not_found");
  return data;
}

async function loadStagePage(query: AdminEntityListQuery<TrackingStageFilters, TrackingStageSort>, page: number) {
  const from = (page - 1) * query.pageSize;
  const searchFilter = buildAdminListSearchOrFilter(["name", "description"], query.search);
  let request = getSupabaseAdmin().from("project_tracking_stages").select("id,project_id,name,description,sort_order,start_date,planned_duration_value,planned_duration_unit,is_visible,created_at,updated_at,project_tracking_items(status,project_tracking_updates(count))", { count: "exact" }).eq("project_id", query.filters.projectId);
  if (query.filters.visibility !== "all") request = request.eq("is_visible", query.filters.visibility === "visible");
  if (searchFilter) request = request.or(searchFilter);
  const { data, error, count } = await request.order(query.sort.field, { ascending: query.sort.direction === "asc" }).order("id", { ascending: true }).range(from, from + query.pageSize - 1);
  if (error) fail(error, "تعذر تحميل المراحل.");
  const stages = z.array(stageWithAggregatesSchema).parse(data ?? []);
  return {
    rows: stages.map((stage) => {
      const { project_tracking_items: children, ...stageRow } = stage;
      return trackingStageRowSchema.parse({
        ...stageRow,
        item_count: children.length,
        update_count: children.reduce(
          (sum, item) => sum + (item.project_tracking_updates[0]?.count ?? 0),
          0,
        ),
        derived_status: deriveProjectTrackingStageStatus(children.map((item) => item.status)),
      });
    }),
    totalRows: count ?? 0,
  };
}

export async function loadTrackingStagesResult(query: AdminEntityListQuery<TrackingStageFilters, TrackingStageSort>) {
  const [loaded, project, profileResult] = await Promise.all([
    loadNormalizedAdminEntityListPage({ requestedPage: query.page, pageSize: query.pageSize, loadPage: (page) => loadStagePage(query, page) }),
    projectSummary(query.filters.projectId),
    getSupabaseAdmin().from("project_tracking_profiles").select("project_id,project_receipt_date,license_receipt_date,contractor_name").eq("project_id", query.filters.projectId).maybeSingle(),
  ]);
  if (profileResult.error) fail(profileResult.error, "تعذر تحميل بيانات متابعة المشروع.");
  return trackingStagesResultSchema.parse({ rows: loaded.rows, pagination: { page: loaded.page, pageSize: query.pageSize, totalRows: loaded.totalRows, totalPages: loaded.totalPages }, metrics: { project, profile: profileResult.data }, meta: resultMeta(query) });
}

async function loadItemPage(query: AdminEntityListQuery<TrackingItemFilters, TrackingItemSort>, page: number) {
  const from = (page - 1) * query.pageSize;
  const searchFilter = buildAdminListSearchOrFilter(["name", "description"], query.search);
  let request = getSupabaseAdmin().from("project_tracking_items").select("id,stage_id,name,description,sort_order,status,start_date,completion_date,is_visible,created_at,updated_at,project_tracking_updates(count)", { count: "exact" }).eq("stage_id", query.filters.stageId);
  if (query.filters.visibility !== "all") request = request.eq("is_visible", query.filters.visibility === "visible");
  if (query.filters.status !== "all") request = request.eq("status", query.filters.status);
  if (searchFilter) request = request.or(searchFilter);
  const { data, error, count } = await request.order(query.sort.field, { ascending: query.sort.direction === "asc" }).order("id", { ascending: true }).range(from, from + query.pageSize - 1);
  if (error) fail(error, "تعذر تحميل بنود المرحلة.");
  const items = z.array(itemWithAggregateSchema).parse(data ?? []);
  return {
    rows: items.map((item) => {
      const { project_tracking_updates: updates, ...itemRow } = item;
      return trackingItemRowSchema.parse({
        ...itemRow,
        update_count: updates[0]?.count ?? 0,
      });
    }),
    totalRows: count ?? 0,
  };
}

async function stageSummary(projectId: number, stageId: number) {
  const { data, error } = await getSupabaseAdmin().from("project_tracking_stages").select("id,project_id,name,description,sort_order,start_date,planned_duration_value,planned_duration_unit,is_visible,created_at,updated_at,project_tracking_items(status,project_tracking_updates(count))").eq("id", stageId).eq("project_id", projectId).maybeSingle();
  if (error) fail(error, "تعذر تحميل المرحلة.");
  if (!data) throw new ProjectTrackingAdminReadError("المرحلة لا تتبع هذا المشروع.", "stage_not_found");
  const stage = stageWithAggregatesSchema.parse(data);
  const { project_tracking_items: items, ...stageRow } = stage;
  return trackingStageRowSchema.parse({
    ...stageRow,
    item_count: items.length,
    update_count: items.reduce(
      (sum, item) => sum + (item.project_tracking_updates[0]?.count ?? 0),
      0,
    ),
    derived_status: deriveProjectTrackingStageStatus(
      items.map((item) => item.status),
    ),
  });
}

export async function loadTrackingItemsResult(query: AdminEntityListQuery<TrackingItemFilters, TrackingItemSort>) {
  const [loaded, project, stage] = await Promise.all([
    loadNormalizedAdminEntityListPage({ requestedPage: query.page, pageSize: query.pageSize, loadPage: (page) => loadItemPage(query, page) }),
    projectSummary(query.filters.projectId),
    stageSummary(query.filters.projectId, query.filters.stageId),
  ]);
  return trackingItemsResultSchema.parse({ rows: loaded.rows, pagination: { page: loaded.page, pageSize: query.pageSize, totalRows: loaded.totalRows, totalPages: loaded.totalPages }, metrics: { project, stage }, meta: resultMeta(query) });
}

async function loadUpdatePage(query: AdminEntityListQuery<TrackingUpdateFilters, TrackingUpdateSort>, page: number) {
  const from = (page - 1) * query.pageSize;
  const searchFilter = buildAdminListSearchOrFilter(["title", "body"], query.search);
  let request = getSupabaseAdmin().from("project_tracking_updates").select("id,item_id,title,body,occurred_at,publication_status,published_at,created_at,updated_at", { count: "exact" }).eq("item_id", query.filters.itemId);
  if (query.filters.publication !== "all") request = request.eq("publication_status", query.filters.publication);
  if (searchFilter) request = request.or(searchFilter);
  const { data, error, count } = await request.order(query.sort.field, { ascending: query.sort.direction === "asc" }).order("id", { ascending: query.sort.direction === "asc" }).range(from, from + query.pageSize - 1);
  if (error) fail(error, "تعذر تحميل تحديثات التنفيذ.");
  const updates = z.array(updateBaseSchema).parse(data ?? []);
  const ids = updates.map((update) => update.id);
  const mediaResult = ids.length ? await getSupabaseAdmin().from("project_tracking_update_media").select("id,client_key,update_id,media_kind,public_url,poster_url,title,sort_order").in("update_id", ids).order("sort_order", { ascending: true }) : { data: [], error: null };
  if (mediaResult.error) fail(mediaResult.error, "تعذر تحميل وسائط التحديثات.");
  return { rows: updates.map((update) => trackingUpdateRowSchema.parse({ ...update, media: (mediaResult.data ?? []).filter((media) => media.update_id === update.id) })), totalRows: count ?? 0 };
}

async function itemSummary(projectId: number, itemId: number) {
  const { data, error } = await getSupabaseAdmin().from("project_tracking_items").select("id,stage_id,name,description,sort_order,status,start_date,completion_date,is_visible,created_at,updated_at,project_tracking_stages!inner(id,project_id,name)").eq("id", itemId).eq("project_tracking_stages.project_id", projectId).maybeSingle();
  if (error) fail(error, "تعذر تحميل البند.");
  if (!data) throw new ProjectTrackingAdminReadError("البند لا يتبع هذا المشروع.", "item_not_found");
  const stageJoin = Array.isArray(data.project_tracking_stages) ? data.project_tracking_stages[0] : data.project_tracking_stages;
  const { count, error: updateError } = await getSupabaseAdmin().from("project_tracking_updates").select("id", { count: "exact", head: true }).eq("item_id", itemId);
  if (updateError) fail(updateError, "تعذر تحميل ملخص البند.");
  return { stage: { id: stageJoin.id, name: stageJoin.name }, item: trackingItemRowSchema.parse({ ...data, project_tracking_stages: undefined, update_count: count ?? 0 }) };
}

export async function loadTrackingUpdatesResult(query: AdminEntityListQuery<TrackingUpdateFilters, TrackingUpdateSort>) {
  const [loaded, project, summary] = await Promise.all([
    loadNormalizedAdminEntityListPage({ requestedPage: query.page, pageSize: query.pageSize, loadPage: (page) => loadUpdatePage(query, page) }),
    projectSummary(query.filters.projectId),
    itemSummary(query.filters.projectId, query.filters.itemId),
  ]);
  return trackingUpdatesResultSchema.parse({ rows: loaded.rows, pagination: { page: loaded.page, pageSize: query.pageSize, totalRows: loaded.totalRows, totalPages: loaded.totalPages }, metrics: { project, ...summary }, meta: resultMeta(query) });
}

export const trackingStagesEntityListAdapter: AdminEntityListAdapter<typeof PROJECT_TRACKING_ENTITY_KEYS.stages, TrackingStageFilters, TrackingStageSort, TrackingStageRow, z.infer<typeof trackingStageMetricsSchema>> = { entity: PROJECT_TRACKING_ENTITY_KEYS.stages, queryContract: trackingStagesQueryContract, resultSchema: trackingStagesResultSchema, staleTimeMs: 15_000, mutationInvalidation: "entity", load: loadTrackingStagesResult };
export const trackingItemsEntityListAdapter: AdminEntityListAdapter<typeof PROJECT_TRACKING_ENTITY_KEYS.items, TrackingItemFilters, TrackingItemSort, TrackingItemRow, z.infer<typeof trackingItemMetricsSchema>> = { entity: PROJECT_TRACKING_ENTITY_KEYS.items, queryContract: trackingItemsQueryContract, resultSchema: trackingItemsResultSchema, staleTimeMs: 15_000, mutationInvalidation: "entity", load: loadTrackingItemsResult };
export const trackingUpdatesEntityListAdapter: AdminEntityListAdapter<typeof PROJECT_TRACKING_ENTITY_KEYS.updates, TrackingUpdateFilters, TrackingUpdateSort, TrackingUpdateRow, z.infer<typeof trackingUpdateMetricsSchema>> = { entity: PROJECT_TRACKING_ENTITY_KEYS.updates, queryContract: trackingUpdatesQueryContract, resultSchema: trackingUpdatesResultSchema, staleTimeMs: 15_000, mutationInvalidation: "entity", load: loadTrackingUpdatesResult };
