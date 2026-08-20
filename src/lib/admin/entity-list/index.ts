export type {
  AdminEntityBulkOption,
  AdminEntityCellContext,
  AdminEntityColumnDef,
  AdminEntityColumnPreferencePayload,
  AdminEntityColumnSticky,
  AdminEntityPrimaryColumnPresentation,
  AdminEntityFeedbackMapper,
  AdminEntityFilterDef,
  AdminEntityFilterGroup,
  AdminEntityFilterOption,
  AdminEntityFilterValues,
  AdminEntityFiltersChangePatch,
  AdminEntityListEmptyState,
  AdminEntityNoticeCodeMap,
  AdminEntityPersistResult,
  AdminEntitySearchConfig,
  AdminEntitySearchSuggestion,
  AdminEntitySearchSuggestionsConfig,
} from "./types";

export {
  ADMIN_ENTITY_PRIMARY_COLUMN_PRESENTATIONS,
  isAdminEntityPrimaryColumnPresentation,
} from "./types";

export {
  filterPersistableColumnKeys,
  getDefaultVisibleColumnKeys,
  resolveActiveSortColumnKey,
  sanitizeVisibleColumnKeys,
} from "./column-preferences";

export { resolveAdminNoticeFeedback } from "./feedback-codes";
export { resolveAdminEntityListEmptyState } from "./empty-state";

export {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  computePageRange,
  computeTotalPages,
  normalizePage,
  normalizePageSize,
  resolveClientPagination,
  slicePageRows,
  type AdminEntityPaginationState,
} from "./pagination";

export {
  applyAdminEntityUrlPatch,
  buildAdminEntityListHref,
  writeAdminBoundedClientPaginationParams,
  type AdminBoundedClientPaginationUrlOptions,
  type AdminBoundedClientPaginationUrlState,
  type AdminEntityUrlPatch,
} from "./url-state";
export {
  adminCollectionSearchIncludes,
  normalizeAdminCollectionSearchText,
} from "./search-normalization";

export {
  useAdminBoundedClientPagination,
  type AdminBoundedClientPaginationOptions,
  type AdminBoundedClientQueryContract,
  type AdminBoundedClientQueryState,
} from "./bounded-client-pagination";
