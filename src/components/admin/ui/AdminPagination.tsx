export {
  default,
  buildAdminPaginationHref,
  buildAdminPaginationItems,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS,
} from "./AdminTablePagination";
export type { AdminTablePaginationProps } from "./AdminTablePagination";

/** @deprecated Use AdminTablePagination — legacy layout shell removed. */
export { default as AdminPagination } from "./AdminTablePagination";
