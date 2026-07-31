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

const projectEntityListRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  type: z.enum(["residential", "commercial"]),
  slug: z.string().min(1),
  arabic_name: z.string().min(1),
  english_name: z.string().min(1),
  location_label: z.string(),
  featured: z.boolean(),
  updated_at: z.string(),
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

function sanitizeProjectSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadProjectsPage(
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
  page: number,
) {
  const from = (page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const search = sanitizeProjectSearch(query.search);
  const ascending = query.sort.direction === "asc";

  let request = getSupabaseAdmin()
    .from("projects")
    .select(
      "id, type, slug, arabic_name, english_name, location_label, featured, updated_at",
      { count: "exact" },
    )
    .eq("type", query.filters.projectType);

  if (search) {
    const pattern = `%${search}%`;
    request = request.or(
      [
        `arabic_name.ilike.${pattern}`,
        `english_name.ilike.${pattern}`,
        `slug.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error, count } = await request
    .order(query.sort.field, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, to);

  if (error) throw new ProjectsEntityListDatabaseError(error);

  return {
    rows: z.array(projectEntityListRowSchema).parse(data ?? []),
    totalRows: count ?? 0,
  };
}

export async function loadProjectsEntityListResult(
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
) {
  let page = query.page;
  let loaded = await loadProjectsPage(query, page);
  const totalPages = Math.max(1, Math.ceil(loaded.totalRows / query.pageSize));

  if (page > totalPages) {
    page = totalPages;
    loaded = await loadProjectsPage(query, page);
  }

  return projectsEntityListResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages,
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
