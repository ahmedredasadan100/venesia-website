import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";

export const projectSortFields = [
  "homepage_order",
  "arabic_name",
  "code",
  "featured",
  "publication_status",
  "location",
  "updated_at",
] as const;
export type ProjectSortField = (typeof projectSortFields)[number];

export const projectTypeValues = ["residential", "commercial"] as const;
export type ProjectListType = (typeof projectTypeValues)[number];

export const projectPublicationStatusValues = [
  "all",
  "draft",
  "published",
  "unpublished",
  "archived",
] as const;

export const projectImplementationStatusValues = [
  "all",
  "under-construction",
  "excavation",
  "near-delivery",
  "delivered",
] as const;

export const projectFeaturedValues = ["all", "yes", "no"] as const;
export const projectListModeValues = ["all", "active", "archived"] as const;

export type ProjectFilters = {
  projectType: ProjectListType;
  publicationStatus: (typeof projectPublicationStatusValues)[number];
  implementationStatus: (typeof projectImplementationStatusValues)[number];
  featured: (typeof projectFeaturedValues)[number];
  listMode: (typeof projectListModeValues)[number];
};

export const PROJECTS_LIST_PAGE_SIZES = [10, 20, 30] as const;

export const projectsQueryContract: AdminEntityListQueryContract<
  ProjectFilters,
  ProjectSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    projectType: z.enum(projectTypeValues),
    publicationStatus: z.enum(projectPublicationStatusValues),
    implementationStatus: z.enum(projectImplementationStatusValues),
    featured: z.enum(projectFeaturedValues),
    listMode: z.enum(projectListModeValues),
  }),
  sortFields: projectSortFields,
  defaultSort: { field: "homepage_order", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: PROJECTS_LIST_PAGE_SIZES,
  maxPageSize: 30,
  searchMinLength: 1,
  rawFilterSchemas: {
    type: z.enum(projectTypeValues),
    publication_status: z.enum(projectPublicationStatusValues),
    implementation_status: z.enum(projectImplementationStatusValues),
    featured: z.enum(projectFeaturedValues),
    list_mode: z.enum(projectListModeValues),
  },
  parseFilters(params) {
    const projectType = params.get("type");
    const publicationStatus = params.get("publication_status");
    const implementationStatus = params.get("implementation_status");
    const featured = params.get("featured");
    const listMode = params.get("list_mode");
    return {
      projectType:
        projectType === "commercial" || projectType === "residential"
          ? projectType
          : "residential",
      publicationStatus:
        publicationStatus &&
        (projectPublicationStatusValues as readonly string[]).includes(
          publicationStatus,
        )
          ? publicationStatus
          : "all",
      implementationStatus:
        implementationStatus &&
        (projectImplementationStatusValues as readonly string[]).includes(
          implementationStatus,
        )
          ? implementationStatus
          : "all",
      featured:
        featured === "yes" || featured === "no" ? featured : "all",
      listMode:
        listMode === "active" || listMode === "archived" ? listMode : "all",
    };
  },
  writeFilters(filters, params) {
    [
      "type",
      "publication_status",
      "implementation_status",
      "featured",
      "list_mode",
    ].forEach((key) => params.delete(key));
    params.set("type", filters.projectType);
    if (filters.publicationStatus !== "all") {
      params.set("publication_status", filters.publicationStatus);
    }
    if (filters.implementationStatus !== "all") {
      params.set("implementation_status", filters.implementationStatus);
    }
    if (filters.featured !== "all") params.set("featured", filters.featured);
    if (filters.listMode !== "all") params.set("list_mode", filters.listMode);
  },
};

export function withLockedProjectType(
  filters: ProjectFilters,
  projectType: ProjectListType,
): ProjectFilters {
  return { ...filters, projectType };
}
