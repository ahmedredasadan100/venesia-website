import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import {
  loadNormalizedAdminEntityListPage,
  type AdminEntityListAdapter,
} from "../entity-list/data-engine/adapter";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  PROJECT_LOCATION_ENTITY_KEYS,
  projectLocationManagementMetricsSchema,
  projectLocationManagementRowSchema,
  projectLocationParentOptionSchema,
  projectLocationsQueryContract,
  type ProjectLocationFilters,
  type ProjectLocationLevel,
  type ProjectLocationSortField,
} from "./location-management-contract";

const LOCATION_SELECT = [
  "id",
  "client_key",
  "level",
  "parent_id",
  "name_ar",
  "name_en",
  "sort_order",
  "is_active",
  "created_at",
  "updated_at",
].join(",");

const projectLocationBaseRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  client_key: z.string().uuid(),
  level: z.enum(["governorate", "city", "main_area", "sub_area"]),
  parent_id: z.coerce.number().int().positive().nullable(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  is_active: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const projectLocationManagementResultSchema =
  createAdminEntityListResultSchema(
    projectLocationManagementRowSchema,
    projectLocationManagementMetricsSchema,
  );

export class ProjectLocationManagementDatabaseError extends Error {
  readonly code: string;

  constructor(error: { message: string; code?: string }) {
    super(error.message);
    this.name = "ProjectLocationManagementDatabaseError";
    this.code = error.code ?? "project_location_management_failed";
  }
}

function projectReferenceFilter(level: ProjectLocationLevel) {
  return `${
    level === "governorate"
      ? "governorate_id"
      : level === "city"
        ? "city_id"
        : level === "main_area"
          ? "main_area_id"
          : "sub_area_id"
  }`;
}

async function loadProjectLocationPage(
  level: ProjectLocationLevel,
  query: AdminEntityListQuery<
    ProjectLocationFilters,
    ProjectLocationSortField
  >,
  page: number,
) {
  const from = (page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const searchFilter = buildAdminListSearchOrFilter(
    ["name_ar", "name_en"],
    query.search,
  );
  const ascending = query.sort.direction === "asc";

  let request = getSupabaseAdmin()
    .from("project_locations")
    .select(LOCATION_SELECT, { count: "exact" })
    .eq("level", level);
  if (query.filters.status !== "all") {
    request = request.eq("is_active", query.filters.status === "active");
  }
  if (searchFilter) request = request.or(searchFilter);

  const { data, error, count } = await request
    .order(query.sort.field, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, to);
  if (error) throw new ProjectLocationManagementDatabaseError(error);

  const rows = z.array(projectLocationBaseRowSchema.extend({
    level: z.literal(level),
  })).parse(data ?? []);
  const ids = rows.map((row) => row.id);
  const parentIds = rows
    .map((row) => row.parent_id)
    .filter((id): id is number => id !== null);
  const supabase = getSupabaseAdmin();
  const [parentsResult, childrenResult, projectsResult] = await Promise.all([
    parentIds.length
      ? supabase.from("project_locations").select("id,name_ar,name_en").in("id", parentIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("project_locations").select("id,parent_id").in("parent_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("projects").select(`id,${projectReferenceFilter(level)}`).in(projectReferenceFilter(level), ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError =
    parentsResult.error ?? childrenResult.error ?? projectsResult.error;
  if (relatedError) throw new ProjectLocationManagementDatabaseError(relatedError);

  const parents = new Map(
    (parentsResult.data ?? []).map((parent) => [Number(parent.id), parent]),
  );
  const childCounts = new Map<number, number>();
  for (const child of childrenResult.data ?? []) {
    const parentId = Number(child.parent_id);
    childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
  }
  const projectCounts = new Map<number, number>();
  for (const project of (projectsResult.data ?? []) as unknown as Record<string, unknown>[]) {
    const locationId = Number(project[projectReferenceFilter(level)]);
    projectCounts.set(locationId, (projectCounts.get(locationId) ?? 0) + 1);
  }

  return {
    rows: rows.map((row) => {
      const parent = row.parent_id ? parents.get(row.parent_id) : null;
      return projectLocationManagementRowSchema.parse({
        ...row,
        parent_name_ar: parent?.name_ar ?? null,
        parent_name_en: parent?.name_en ?? null,
        project_count: projectCounts.get(row.id) ?? 0,
        child_count: childCounts.get(row.id) ?? 0,
      });
    }),
    totalRows: count ?? 0,
  };
}

async function loadParentOptions(level: ProjectLocationLevel) {
  const parentLevel = PROJECT_LOCATION_LEVEL_CONFIG[level].parentLevel;
  if (!parentLevel) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("project_locations")
    .select("id,name_ar,name_en,is_active")
    .eq("level", parentLevel)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new ProjectLocationManagementDatabaseError(error);
  return z.array(projectLocationParentOptionSchema).parse(data ?? []);
}

export async function loadProjectLocationManagementResult(
  level: ProjectLocationLevel,
  query: AdminEntityListQuery<
    ProjectLocationFilters,
    ProjectLocationSortField
  >,
) {
  const [loaded, parentOptions] = await Promise.all([
    loadNormalizedAdminEntityListPage({
      requestedPage: query.page,
      pageSize: query.pageSize,
      loadPage: (page) => loadProjectLocationPage(level, query, page),
    }),
    loadParentOptions(level),
  ]);

  return projectLocationManagementResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page: loaded.page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages: loaded.totalPages,
    },
    metrics: { level, parentOptions },
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  });
}

export async function loadProjectLocationManagementRow(
  id: number,
  level: ProjectLocationLevel,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("project_locations")
    .select(LOCATION_SELECT)
    .eq("id", id)
    .eq("level", level)
    .maybeSingle();
  if (error) throw new ProjectLocationManagementDatabaseError(error);
  if (!data) return null;
  const location = projectLocationBaseRowSchema.parse(data);

  const parentId = location.parent_id;
  const referenceColumn = projectReferenceFilter(level);
  const [parentResult, childrenResult, projectsResult] = await Promise.all([
    parentId
      ? supabase.from("project_locations").select("name_ar,name_en").eq("id", parentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("project_locations").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq(referenceColumn, id),
  ]);
  const relatedError =
    parentResult.error ?? childrenResult.error ?? projectsResult.error;
  if (relatedError) throw new ProjectLocationManagementDatabaseError(relatedError);

  return projectLocationManagementRowSchema.parse({
    ...location,
    parent_name_ar: parentResult.data?.name_ar ?? null,
    parent_name_en: parentResult.data?.name_en ?? null,
    project_count: projectsResult.count ?? 0,
    child_count: childrenResult.count ?? 0,
  });
}

function createProjectLocationManagementAdapter<
  Level extends ProjectLocationLevel,
>(level: Level): AdminEntityListAdapter<
  (typeof PROJECT_LOCATION_ENTITY_KEYS)[Level],
  ProjectLocationFilters,
  ProjectLocationSortField,
  z.infer<typeof projectLocationManagementRowSchema>,
  z.infer<typeof projectLocationManagementMetricsSchema>
> {
  return {
    entity: PROJECT_LOCATION_ENTITY_KEYS[level],
    queryContract: projectLocationsQueryContract,
    resultSchema: projectLocationManagementResultSchema,
    staleTimeMs: 30_000,
    mutationInvalidation: "entity",
    load: (query) => loadProjectLocationManagementResult(level, query),
  };
}

export const projectLocationGovernoratesEntityListAdapter =
  createProjectLocationManagementAdapter("governorate");
export const projectLocationCitiesEntityListAdapter =
  createProjectLocationManagementAdapter("city");
export const projectLocationDistrictsEntityListAdapter =
  createProjectLocationManagementAdapter("main_area");
export const projectLocationSubDistrictsEntityListAdapter =
  createProjectLocationManagementAdapter("sub_area");
