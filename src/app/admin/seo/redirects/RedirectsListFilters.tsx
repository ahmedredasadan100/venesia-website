"use client";

import { AdminEntityListFilters } from "../../../../components/admin/entity-list";
import type { AdminEntityFilterDef } from "../../../../lib/admin/entity-list";
import {
  redirectsQueryContract,
  type RedirectStatusFilter,
  type RedirectTypeFilter,
} from "../../../../lib/admin/redirects/entity-list-contract";

type RedirectsListFiltersProps = {
  search: string;
  status: RedirectStatusFilter;
  redirectType: RedirectTypeFilter;
  onQueryPatch: (patch: {
    q?: string | null;
    status?: string | null;
    type?: string | null;
  }) => void;
};

const REDIRECT_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "redirect-status-filter",
    paramKey: "status",
    placeholder: "الحالة",
    options: [
      { value: "active", label: "نشط" },
      { value: "inactive", label: "غير نشط" },
    ],
    className: "min-w-[150px] flex-1 lg:flex-none",
  },
  {
    id: "redirect-type-filter",
    paramKey: "type",
    placeholder: "نوع التحويل",
    options: [
      { value: "301", label: "301 دائم" },
      { value: "302", label: "302 مؤقت" },
    ],
    className: "min-w-[150px] flex-1 lg:flex-none",
  },
];

export default function RedirectsListFilters({
  search,
  status,
  redirectType,
  onQueryPatch,
}: RedirectsListFiltersProps) {
  return (
    <AdminEntityListFilters
      basePath="/admin/seo/redirects"
      preserveParams={["sort", "limit"]}
      search={{
        value: search,
        placeholder: "ابحث بالمصدر أو الوجهة...",
        minLength: redirectsQueryContract.searchMinLength,
      }}
      filters={REDIRECT_FILTERS}
      values={{ status, type: redirectType }}
      clearableFilterKeys={["q", "status", "type"]}
      onQueryPatch={onQueryPatch}
    />
  );
}
