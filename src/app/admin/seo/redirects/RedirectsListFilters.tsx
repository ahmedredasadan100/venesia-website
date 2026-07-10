"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AdminFilterListbox,
  AdminFiltersShell,
  AdminSearchInput,
} from "../../../../components/admin/ui";
import { useClientMounted } from "../../../../hooks/use-client-mounted";

type RedirectsListFiltersProps = {
  q: string;
  status: string;
  redirectType: string;
};

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
];

const TYPE_OPTIONS = [
  { value: "301", label: "301 دائم" },
  { value: "302", label: "302 مؤقت" },
];

export default function RedirectsListFilters({ q, status, redirectType }: RedirectsListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(q);
  const [statusValue, setStatusValue] = useState(status);
  const [typeValue, setTypeValue] = useState(redirectType);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const isMounted = useClientMounted();

  const filterSyncKey = `${q}|${status}|${redirectType}`;
  const [lastFilterSyncKey, setLastFilterSyncKey] = useState(filterSyncKey);
  if (filterSyncKey !== lastFilterSyncKey) {
    setLastFilterSyncKey(filterSyncKey);
    setSearchValue(q);
    setStatusValue(status);
    setTypeValue(redirectType);
  }

  function applyFilters(next?: { q?: string; status?: string; type?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextQ = (next?.q ?? searchValue).trim();
    const nextStatus = next?.status ?? statusValue;
    const nextType = next?.type ?? typeValue;

    if (nextQ) params.set("q", nextQ);
    else params.delete("q");

    if (nextStatus !== "all") params.set("status", nextStatus);
    else params.delete("status");

    if (nextType !== "all") params.set("type", nextType);
    else params.delete("type");

    const query = params.toString();
    router.replace(query ? `/admin/seo/redirects?${query}` : "/admin/seo/redirects");
    setOpenDropdown(null);
  }

  const statusLabel =
    statusValue === "all"
      ? "كل الحالات"
      : (STATUS_OPTIONS.find((option) => option.value === statusValue)?.label ?? "كل الحالات");

  const typeLabel =
    typeValue === "all"
      ? "كل الأنواع"
      : (TYPE_OPTIONS.find((option) => option.value === typeValue)?.label ?? "كل الأنواع");

  return (
    <AdminFiltersShell>
      <AdminSearchInput
        value={searchValue}
        onChange={(value) => {
          setSearchValue(value);
          applyFilters({ q: value });
        }}
        placeholder="ابحث بالمصدر أو الوجهة..."
      />

      <AdminFilterListbox
        id="redirect-status-filter"
        isMounted={isMounted}
        placeholder="الحالة"
        value={statusValue}
        displayValue={statusLabel}
        isOpen={openDropdown === "status"}
        onToggle={() => setOpenDropdown((current) => (current === "status" ? null : "status"))}
        onSelect={(value) => {
          setStatusValue(value);
          applyFilters({ status: value });
        }}
        options={STATUS_OPTIONS}
      />

      <AdminFilterListbox
        id="redirect-type-filter"
        isMounted={isMounted}
        placeholder="نوع التحويل"
        value={typeValue}
        displayValue={typeLabel}
        isOpen={openDropdown === "type"}
        onToggle={() => setOpenDropdown((current) => (current === "type" ? null : "type"))}
        onSelect={(value) => {
          setTypeValue(value);
          applyFilters({ type: value });
        }}
        options={TYPE_OPTIONS}
      />
    </AdminFiltersShell>
  );
}
