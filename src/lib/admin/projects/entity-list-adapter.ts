import "server-only";

import { z } from "zod";

import {
  loadNormalizedAdminEntityListPage,
  type AdminEntityListAdapter,
} from "../entity-list/data-engine/adapter";
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
  publication_status: z.enum(["draft", "published", "unpublished"]),
  published_at: z.string().nullable(),
  updated_at: z.string(),
});

const projectEntityListRpcResultSchema = z.object({
  rows: z.array(projectEntityListRowSchema),
  total_count: z.coerce.number().int().nonnegative(),
  page: z.coerce.number().int().positive(),
  metrics: z.object({ total: z.coerce.number().int().nonnegative() }),
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
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_projects", {
    p_page: page,
    p_page_size: query.pageSize,
    p_sort_field: query.sort.field,
    p_sort_direction: query.sort.direction,
    p_project_type: query.filters.projectType,
    p_search: query.search,
    p_publication_status: query.filters.publicationStatus,
    p_featured: query.filters.featured,
  });

  if (error) throw new ProjectsEntityListDatabaseError(error);
  const parsed = projectEntityListRpcResultSchema.parse(data);

  return {
    rows: parsed.rows,
    totalRows: parsed.total_count,
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
