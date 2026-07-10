"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AdminFilterListbox,
  AdminFiltersShell,
  AdminSearchInput,
} from "../../../../components/admin/ui";
import { useClientMounted } from "../../../../hooks/use-client-mounted";
import { getContentTypeLabel, MEDIA_EDITABLE_CONTENT_TYPES } from "./media-content-config";

type MediaListFiltersProps = {
  q: string;
  contentType: string;
  status: string;
  featured: string;
};

const STATUS_OPTIONS = [
  { value: "published", label: "منشور" },
  { value: "draft", label: "مسودة" },
  { value: "unpublished", label: "مخفي" },
  { value: "archived", label: "أرشيف" },
];

const FEATURED_OPTIONS = [
  { value: "yes", label: "مميز فقط" },
  { value: "no", label: "غير مميز" },
];

export default function MediaListFilters({ q, contentType, status, featured }: MediaListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(q);
  const [contentTypeValue, setContentTypeValue] = useState(contentType);
  const [statusValue, setStatusValue] = useState(status);
  const [featuredValue, setFeaturedValue] = useState(featured);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const isMounted = useClientMounted();

  const filterSyncKey = `${q}|${contentType}|${status}|${featured}`;
  const [lastFilterSyncKey, setLastFilterSyncKey] = useState(filterSyncKey);
  if (filterSyncKey !== lastFilterSyncKey) {
    setLastFilterSyncKey(filterSyncKey);
    setSearchValue(q);
    setContentTypeValue(contentType);
    setStatusValue(status);
    setFeaturedValue(featured);
  }

  const contentTypeOptions = MEDIA_EDITABLE_CONTENT_TYPES.map((type) => ({
    value: type,
    label: getContentTypeLabel(type),
  }));

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    contentTypeValue !== "all" ||
    statusValue !== "all" ||
    featuredValue !== "all";

  function applyFilters(next?: {
    q?: string;
    content_type?: string;
    status?: string;
    featured?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextQ = (next?.q ?? searchValue).trim();
    const nextContentType = next?.content_type ?? contentTypeValue;
    const nextStatus = next?.status ?? statusValue;
    const nextFeatured = next?.featured ?? featuredValue;

    if (nextQ) params.set("q", nextQ);
    else params.delete("q");

    if (nextContentType !== "all") params.set("content_type", nextContentType);
    else params.delete("content_type");

    if (nextStatus !== "all") params.set("status", nextStatus);
    else params.delete("status");

    if (nextFeatured !== "all") params.set("featured", nextFeatured);
    else params.delete("featured");

    params.delete("page");

    const query = params.toString();
    router.push(query ? `/admin/content/media?${query}#media-table` : "/admin/content/media#media-table");
    setOpenDropdown(null);
  }

  return (
    <AdminFiltersShell>
      <AdminSearchInput
        value={searchValue}
        onChange={(value) => {
          setSearchValue(value);
          setOpenDropdown(null);
        }}
        onEnter={() => applyFilters()}
        onClear={() => {
          setSearchValue("");
        }}
        placeholder="ابحث بالعنوان أو الرابط (slug)..."
        clearLabel="مسح البحث"
      />

      <AdminFilterListbox
        id="content_type"
        isMounted={isMounted}
        placeholder="النوع"
        value={contentTypeValue}
        displayValue={
          contentTypeValue === "all"
            ? "النوع"
            : contentTypeOptions.find((item) => item.value === contentTypeValue)?.label ?? "النوع"
        }
        isOpen={openDropdown === "content_type"}
        onToggle={() => setOpenDropdown((current) => (current === "content_type" ? null : "content_type"))}
        onSelect={(value) => {
          setContentTypeValue(value);
          setOpenDropdown(null);
        }}
        options={contentTypeOptions}
        className="min-w-[140px] flex-1 lg:flex-none lg:w-[150px]"
      />

      <AdminFilterListbox
        id="status"
        isMounted={isMounted}
        placeholder="الحالة"
        value={statusValue}
        displayValue={
          statusValue === "all"
            ? "الحالة"
            : STATUS_OPTIONS.find((item) => item.value === statusValue)?.label ?? "الحالة"
        }
        isOpen={openDropdown === "status"}
        onToggle={() => setOpenDropdown((current) => (current === "status" ? null : "status"))}
        onSelect={(value) => {
          setStatusValue(value);
          setOpenDropdown(null);
        }}
        options={STATUS_OPTIONS}
        className="min-w-[120px] flex-1 lg:flex-none lg:w-[130px]"
      />

      <AdminFilterListbox
        id="featured"
        isMounted={isMounted}
        placeholder="التمييز"
        value={featuredValue}
        displayValue={
          featuredValue === "all"
            ? "التمييز"
            : FEATURED_OPTIONS.find((item) => item.value === featuredValue)?.label ?? "التمييز"
        }
        isOpen={openDropdown === "featured"}
        onToggle={() => setOpenDropdown((current) => (current === "featured" ? null : "featured"))}
        onSelect={(value) => {
          setFeaturedValue(value);
          setOpenDropdown(null);
        }}
        options={FEATURED_OPTIONS}
        className="min-w-[110px] flex-1 lg:flex-none lg:w-[120px]"
      />

      <div className="ms-auto flex shrink-0 items-center gap-2">
        {hasActiveFilters ? (
          <Link
            href="/admin/content/media#media-table"
            aria-label="إعادة تعيين جميع الفلاتر"
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/55 transition hover:border-white/20 hover:text-white"
          >
            إعادة تعيين
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => applyFilters()}
          aria-label="تطبيق البحث والفلاتر"
          className="inline-flex h-10 items-center rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          تطبيق
        </button>
      </div>
    </AdminFiltersShell>
  );
}
