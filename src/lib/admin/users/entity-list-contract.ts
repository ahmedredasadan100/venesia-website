import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";
import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
} from "../entity-list/pagination";

export const adminUserEntityListRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  email: z.string().min(1),
  username: z.string().min(1),
  full_name: z.string().nullable(),
  role: z.string().min(1),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type AdminUserEntityListRow = z.infer<
  typeof adminUserEntityListRowSchema
>;

export const adminUserEntityListMetricsSchema = z.object({
  roles: z.array(z.string().min(1)),
});
export type AdminUserEntityListMetrics = z.infer<
  typeof adminUserEntityListMetricsSchema
>;

export const adminUserSortFields = ["created_at"] as const;
export type AdminUserSortField = (typeof adminUserSortFields)[number];

export const adminUserStatusFilterValues = [
  "all",
  "active",
  "inactive",
] as const;
export type AdminUserStatusFilter =
  (typeof adminUserStatusFilterValues)[number];

export type AdminUserFilters = {
  status: AdminUserStatusFilter;
  role: string;
};

export const ADMIN_USERS_LIST_PAGE_SIZES =
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS;

const adminUserRoleFilterSchema = z
  .string()
  .min(1);

export const adminUsersQueryContract: AdminEntityListQueryContract<
  AdminUserFilters,
  AdminUserSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(adminUserStatusFilterValues),
    role: z.string().min(1),
  }),
  sortFields: adminUserSortFields,
  defaultSort: { field: "created_at", direction: "asc" },
  defaultPageSize: ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions: ADMIN_USERS_LIST_PAGE_SIZES,
  maxPageSize: 50,
  searchMinLength: 1,
  rawFilterSchemas: {
    status: z.enum(["active", "inactive"]),
    role: adminUserRoleFilterSchema,
  },
  parseFilters(params) {
    const status = params.get("status");
    const role = params.get("role");
    return {
      status:
        status === "active" || status === "inactive" ? status : "all",
      role: role && adminUserRoleFilterSchema.safeParse(role).success
        ? role
        : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    params.delete("role");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.role !== "all") params.set("role", filters.role);
  },
};
