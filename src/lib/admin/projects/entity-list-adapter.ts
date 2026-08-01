import "server-only";

import { z } from "zod";

import {
  loadNormalizedAdminEntityListPage,
  type AdminEntityListAdapter,
} from "../entity-list/data-engine/adapter";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  projectsQueryContract,
  type ProjectFilters,
  type ProjectSortField,
} from "./entity-list-contract";
import type {
  ProjectEntityListMetrics,
  ProjectEntityListRow,
} from "./entity-list-types";

export type { ProjectEntityListMetrics, ProjectEntityListRow };

const projectEntityListRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  type: z.enum(["residential", "commercial"]),
  slug: z.string().min(1),
  arabic_name: z.string().min(1),
  english_name: z.string().min(1),
  location_label: z.string(),
  city_name: z.string(),
  main_area_name: z.string(),
  sub_area_name: z.string(),
  featured: z.boolean(),
  updated_at: z.string(),
});

const projectLocationRelationSchema = z
  .object({ name_ar: z.string().min(1) })
  .nullable();

const projectEntityListDatabaseRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  type: z.enum(["residential", "commercial"]),
  slug: z.string().min(1),
  arabic_name: z.string().min(1),
  english_name: z.string().min(1),
  location_label: z.string(),
  featured: z.boolean(),
  updated_at: z.string(),
  city: projectLocationRelationSchema,
  main_area: projectLocationRelationSchema,
  sub_area: projectLocationRelationSchema,
});

const projectEntityListMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
});

export const projectsEntityListResultSchema = createAdminEntityListResultSchema(
  projectEntityListRowSchema,
  projectEntityListMetricsSchema,
);

export class ProjectsEntityListDatabaseError extends Error {
  readonly code: string;
  readonly details: string;
  readonly hint: string;

  constructor(error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }) {
    super(error.message);
    this.name = "ProjectsEntityListDatabaseError";
    this.code = error.code ?? "projects_list_failed";
    this.details = error.details ?? "";
    this.hint = error.hint ?? "";
  }
}

async function loadProjectsPage(
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
  page: number,
) {
  const from = (page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const searchFilter = buildAdminListSearchOrFilter(
    ["arabic_name", "english_name", "slug", "code"],
    query.search,
  );
  const ascending = query.sort.direction === "asc";

  let request = getSupabaseAdmin()
    .from("projects")
    .select(
      "id, type, slug, arabic_name, english_name, location_label, featured, updated_at, city:project_locations!projects_city_id_fkey(name_ar), main_area:project_locations!projects_main_area_id_fkey(name_ar), sub_area:project_locations!projects_sub_area_id_fkey(name_ar)",
      { count: "exact" },
    )
    .eq("type", query.filters.projectType);

  if (query.filters.featured !== "all") {
    request = request.eq("featured", query.filters.featured === "yes");
  }

  if (searchFilter) request = request.or(searchFilter);

  const { data, error, count } = await request
    .order(query.sort.field, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, to);

  if (error) throw new ProjectsEntityListDatabaseError(error);

  const databaseRows = z
    .array(projectEntityListDatabaseRowSchema)
    .parse(data ?? []);

  return {
    rows: databaseRows.map(({ city, main_area, sub_area, ...row }) =>
      projectEntityListRowSchema.parse({
        ...row,
        city_name: city?.name_ar ?? "—",
        main_area_name: main_area?.name_ar ?? "—",
        sub_area_name: sub_area?.name_ar ?? "—",
      }),
    ),
    totalRows: count ?? 0,
  };
}

export async function loadProjectsEntityListResult(
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
) {
  const loaded = await loadNormalizedAdminEntityListPage({
    requestedPage: query.page,
    pageSize: query.pageSize,
    loadPage: (page) => loadProjectsPage(query, page),
  });

  return projectsEntityListResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page: loaded.page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages: loaded.totalPages,
    },
    metrics: { total: loaded.totalRows },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  });
}

export const projectsEntityListAdapter: AdminEntityListAdapter<
  "projects",
  ProjectFilters,
  ProjectSortField,
  ProjectEntityListRow,
  ProjectEntityListMetrics
> = {
  entity: "projects",
  queryContract: projectsQueryContract,
  resultSchema: projectsEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadProjectsEntityListResult,
};
