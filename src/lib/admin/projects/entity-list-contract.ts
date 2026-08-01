import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";

export const projectSortFields = [
  "arabic_name",
  "english_name",
  "slug",
  "location_label",
  "updated_at",
] as const;
export type ProjectSortField = (typeof projectSortFields)[number];

export const projectTypeValues = ["residential", "commercial"] as const;
export type ProjectListType = (typeof projectTypeValues)[number];

export type ProjectFilters = {
  projectType: ProjectListType;
  featured: "all" | "yes" | "no";
};

export const PROJECTS_LIST_PAGE_SIZES = [10, 20, 30] as const;

export const projectsQueryContract: AdminEntityListQueryContract<
  ProjectFilters,
  ProjectSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    projectType: z.enum(projectTypeValues),
    featured: z.enum(["all", "yes", "no"]),
  }),
  sortFields: projectSortFields,
  defaultSort: { field: "updated_at", direction: "desc" },
  defaultPageSize: 10,
  pageSizeOptions: PROJECTS_LIST_PAGE_SIZES,
  maxPageSize: 30,
  searchMinLength: 1,
  rawFilterSchemas: {
    type: z.enum(projectTypeValues),
    featured: z.enum(["yes", "no"]),
  },
  parseFilters(params) {
    return {
      projectType:
        params.get("type") === "commercial" ? "commercial" : "residential",
      featured:
        params.get("featured") === "yes" || params.get("featured") === "no"
          ? (params.get("featured") as "yes" | "no")
          : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("type");
    params.delete("featured");
    params.set("type", filters.projectType);
    if (filters.featured !== "all") params.set("featured", filters.featured);
  },
};

export function withLockedProjectType(
  filters: ProjectFilters,
  projectType: ProjectListType,
): ProjectFilters {
  return { ...filters, projectType };
}
