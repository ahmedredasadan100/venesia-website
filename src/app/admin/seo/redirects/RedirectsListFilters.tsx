import type { AdminEntityListFiltersProps } from "../../../../components/admin/entity-list/AdminEntityListFilters";
import type { AdminEntityFilterDef } from "../../../../lib/admin/entity-list";
import {
  redirectsQueryContract,
  type RedirectStatusFilter,
  type RedirectTypeFilter,
} from "../../../../lib/admin/redirects/entity-list-contract";

const REDIRECT_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "redirect-status-filter",
    paramKey: "status",
    label: "الحالة",
    placeholder: "الحالة",
    type: "status",
    options: [
      { value: "active", label: "نشط" },
      { value: "inactive", label: "غير نشط" },
    ],
  },
  {
    id: "redirect-type-filter",
    paramKey: "type",
    label: "نوع التحويل",
    placeholder: "نوع التحويل",
    type: "single_select",
    options: [
      { value: "301", label: "301 دائم" },
      { value: "302", label: "302 مؤقت" },
    ],
  },
];

export function createRedirectsCollectionToolbar({
  search,
  status,
  redirectType,
  onQueryPatch,
}: {
  search: string;
  status: RedirectStatusFilter;
  redirectType: RedirectTypeFilter;
  onQueryPatch: AdminEntityListFiltersProps["onQueryPatch"];
}): AdminEntityListFiltersProps {
  return {
    basePath: "/admin/seo/redirects",
    preserveParams: ["sort", "limit"],
    search: {
      value: search,
      placeholder: "ابحث بالمصدر أو الوجهة أو الملاحظة...",
      minLength: redirectsQueryContract.searchMinLength,
    },
    filters: REDIRECT_FILTERS,
    values: { status, type: redirectType },
    clearableFilterKeys: ["status", "type"],
    onQueryPatch,
  };
}
