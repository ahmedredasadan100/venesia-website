import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";
import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
} from "../entity-list/pagination";

export const PROJECT_LOCATION_LEVELS = [
  "governorate",
  "city",
  "main_area",
  "sub_area",
] as const;
export type ProjectLocationLevel = (typeof PROJECT_LOCATION_LEVELS)[number];

export const PROJECT_LOCATION_ENTITY_KEYS = {
  governorate: "project_locations_governorate",
  city: "project_locations_city",
  main_area: "project_locations_main_area",
  sub_area: "project_locations_sub_area",
} as const satisfies Record<ProjectLocationLevel, string>;

export const PROJECT_LOCATION_LEVEL_CONFIG = {
  governorate: {
    slug: "governorates",
    label: "المحافظات",
    singularLabel: "محافظة",
    parentLevel: null,
    parentLabel: null,
  },
  city: {
    slug: "cities",
    label: "المدن / المجتمعات العمرانية",
    singularLabel: "مدينة / مجتمع عمراني",
    parentLevel: "governorate",
    parentLabel: "المحافظة",
  },
  main_area: {
    slug: "districts",
    label: "المناطق الرئيسية",
    singularLabel: "منطقة رئيسية",
    parentLevel: "city",
    parentLabel: "المدينة / المجتمع العمراني",
  },
  sub_area: {
    slug: "sub-districts",
    label: "المناطق الفرعية",
    singularLabel: "منطقة فرعية",
    parentLevel: "main_area",
    parentLabel: "المنطقة الرئيسية",
  },
} as const satisfies Record<
  ProjectLocationLevel,
  {
    slug: string;
    label: string;
    singularLabel: string;
    parentLevel: ProjectLocationLevel | null;
    parentLabel: string | null;
  }
>;

export const PROJECT_LOCATION_MANAGEMENT_COLUMN_CONTRACT_VERSION = 1;

export const PROJECT_LOCATION_MANAGEMENT_COLUMN_KEYS = [
  "name",
  "parent",
  "order",
  "relations",
  "status",
  "actions",
] as const;
export type ProjectLocationManagementColumnKey =
  (typeof PROJECT_LOCATION_MANAGEMENT_COLUMN_KEYS)[number];

export function getProjectLocationManagementListViewKey(
  level: ProjectLocationLevel,
) {
  return `project-locations-${PROJECT_LOCATION_LEVEL_CONFIG[level].slug}`;
}

export function getProjectLocationManagementColumnKeys(
  level: ProjectLocationLevel,
): readonly ProjectLocationManagementColumnKey[] {
  return PROJECT_LOCATION_MANAGEMENT_COLUMN_KEYS.filter(
    (key) =>
      level !== "governorate" || (key !== "parent" && key !== "order"),
  );
}

export function getProjectLocationManagementDefaultColumnKeys(
  level: ProjectLocationLevel,
): readonly ProjectLocationManagementColumnKey[] {
  return getProjectLocationManagementColumnKeys(level);
}

export function getProjectLocationManagementPreferenceColumnKeys(
  level: ProjectLocationLevel,
): readonly ProjectLocationManagementColumnKey[] {
  return getProjectLocationManagementColumnKeys(level).filter(
    (key) => key !== "name" && key !== "actions",
  );
}

export function projectLocationManagementPath(level: ProjectLocationLevel) {
  return `/admin/projects/locations/${PROJECT_LOCATION_LEVEL_CONFIG[level].slug}`;
}

export const projectLocationStatusFilterValues = [
  "all",
  "active",
  "inactive",
] as const;
export type ProjectLocationStatusFilter =
  (typeof projectLocationStatusFilterValues)[number];

export type ProjectLocationFilters = {
  status: ProjectLocationStatusFilter;
};

export const projectLocationSortFields = [
  "sort_order",
  "name_ar",
  "updated_at",
] as const;
export type ProjectLocationSortField =
  (typeof projectLocationSortFields)[number];

export const PROJECT_LOCATION_LIST_PAGE_SIZES =
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS;

export const projectLocationsQueryContract: AdminEntityListQueryContract<
  ProjectLocationFilters,
  ProjectLocationSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(projectLocationStatusFilterValues),
  }),
  sortFields: projectLocationSortFields,
  defaultSort: { field: "sort_order", direction: "asc" },
  defaultPageSize: ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions: PROJECT_LOCATION_LIST_PAGE_SIZES,
  maxPageSize: 50,
  searchMinLength: 1,
  rawFilterSchemas: {
    status: z.enum(["active", "inactive"]),
  },
  parseFilters(params) {
    const status = params.get("status");
    return {
      status:
        status === "active" || status === "inactive" ? status : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    if (filters.status !== "all") params.set("status", filters.status);
  },
};

export const projectLocationDeleteEligibilitySchema = z.object({
  canDelete: z.boolean(),
  disabledReason: z.string().min(1).nullable(),
});

export const projectLocationVisibilityEligibilitySchema = z.object({
  canDeactivate: z.boolean(),
  disabledReason: z.string().min(1).nullable(),
});

export function resolveProjectLocationDeleteEligibility(input: {
  projectCount: number;
  childCount: number;
}) {
  if (input.projectCount > 0) {
    return {
      canDelete: false,
      disabledReason:
        "لا يمكن الحذف لأن الموقع مرتبط بمشروعات.",
    } as const;
  }
  if (input.childCount > 0) {
    return {
      canDelete: false,
      disabledReason:
        "لا يمكن الحذف لأن الموقع يحتوي عناصر فرعية.",
    } as const;
  }
  return { canDelete: true, disabledReason: null } as const;
}

export function resolveProjectLocationVisibilityEligibility(input: {
  projectCount: number;
  activeChildCount: number;
}) {
  if (input.activeChildCount > 0) {
    return {
      canDeactivate: false,
      disabledReason:
        "لا يمكن إخفاء الموقع لأنه يحتوي مواقع فرعية نشطة.",
    } as const;
  }
  if (input.projectCount > 0) {
    return {
      canDeactivate: false,
      disabledReason:
        "لا يمكن إخفاء الموقع لأنه مرتبط بمشروعات.",
    } as const;
  }
  return { canDeactivate: true, disabledReason: null } as const;
}

export const projectLocationManagementRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  client_key: z.string().uuid(),
  level: z.enum(PROJECT_LOCATION_LEVELS),
  parent_id: z.coerce.number().int().positive().nullable(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  is_active: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  parent_name_ar: z.string().nullable(),
  parent_name_en: z.string().nullable(),
  project_count: z.coerce.number().int().nonnegative(),
  child_count: z.coerce.number().int().nonnegative(),
  delete_eligibility: projectLocationDeleteEligibilitySchema,
  visibility_eligibility: projectLocationVisibilityEligibilitySchema,
});
export type ProjectLocationManagementRow = z.infer<
  typeof projectLocationManagementRowSchema
>;

export const projectLocationParentOptionSchema = z.object({
  id: z.coerce.number().int().positive(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable(),
  is_active: z.boolean(),
});
export type ProjectLocationParentOption = z.infer<
  typeof projectLocationParentOptionSchema
>;

export const projectLocationManagementMetricsSchema = z.object({
  level: z.enum(PROJECT_LOCATION_LEVELS),
  parentOptions: z.array(projectLocationParentOptionSchema),
});
export type ProjectLocationManagementMetrics = z.infer<
  typeof projectLocationManagementMetricsSchema
>;

export type ProjectLocationMutationResult = {
  ok: boolean;
  code: string;
  message: string;
  location?: ProjectLocationManagementRow;
};
