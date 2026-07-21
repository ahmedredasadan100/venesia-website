import "server-only";

import { z } from "zod";

import type { AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
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

export const projectEntityListRowSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  slug: z.string().nullable(),
  arabic_name: z.string(),
  location_label: z.string().nullable(),
  map_area: z.string().nullable(),
  featured: z.boolean(),
  publication_status: z.string().nullable(),
  status: z.string().nullable(),
  updated_at: z.string(),
});

export const projectEntityListMetricsSchema = z.object({
  published: z.number().int().nonnegative(),
  featured: z.number().int().nonnegative(),
});

export const projectsEntityListResultSchema = createAdminEntityListResultSchema(
  projectEntityListRowSchema,
  projectEntityListMetricsSchema,
);

const projectsReadModelSchema = z.object({
  rows: z.array(projectEntityListRowSchema),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.number().int().positive(),
  metrics: projectEntityListMetricsSchema,
});

export class ProjectsEntityListDatabaseError extends Error {
  readonly code: string;
  readonly details: string;
  readonly hint: string;

  constructor(error: {
    message: string;
    code: string;
    details: string;
    hint: string;
  }) {
    super(error.message);
    this.name = "ProjectsEntityListDatabaseError";
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

export async function loadProjectsEntityListResult(
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
) {
  // One database list operation: filters, search, sort, count, paging, and
  // summary metrics share a single stable snapshot.
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_projects", {
    p_page: query.page,
    p_page_size: query.pageSize,
    p_sort_field: query.sort.field,
    p_sort_direction: query.sort.direction,
    p_project_type: query.filters.projectType,
    p_search: query.search,
    p_publication_status: query.filters.publicationStatus,
    p_implementation_status: query.filters.implementationStatus,
    p_featured: query.filters.featured,
    p_list_mode: query.filters.listMode,
  });
  if (error) throw new ProjectsEntityListDatabaseError(error);

  const readModel = projectsReadModelSchema.parse(data);
  const totalRows = readModel.total_count;
  const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
  const page = readModel.page;

  return {
    rows: readModel.rows,
    pagination: { page, pageSize: query.pageSize, totalRows, totalPages },
    metrics: readModel.metrics,
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  };
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
