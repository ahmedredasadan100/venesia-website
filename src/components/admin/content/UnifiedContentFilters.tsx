"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  toAdminCategoryFilterOptions,
  type AdminContentCategoryNode,
} from "../../../lib/admin/content/category-hierarchy";
import { CONTENT_TYPE_OPTIONS } from "../../../lib/admin/content/content-types";
import type { AdminEntityFilterDef } from "../../../lib/admin/entity-list";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  AdminEntityListFilters,
  useAdminFloatingLayer,
} from "../entity-list";
import {
  AdminSearchInput,
  ADMIN_FILTER_MENU_PANEL_CLASSES,
  ADMIN_FILTER_MENU_SCROLLBAR_CLASSES,
  useAdminFloatingMenuPosition,
} from "../ui";

type SeriesOption = { id: number; name: string; status: string; deleted_at: string | null };
type Suggestion = { id: number; title: string; category_name: string | null };

type FilterState = {
  q: string;
  contentType: string;
  category: string;
  series: string;
  status: string;
  featured: string;
};

const BASE_PATH = "/admin/content/topics";

export default function UnifiedContentFilters({
  initial,
  categories,
  series,
}: {
  initial: FilterState;
  categories: AdminContentCategoryNode[];
  series: SeriesOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const floating = useAdminFloatingLayer();
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState(initial);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const mounted = useClientMounted();
  const trimmedSearch = values.q.trim();
  const canSearch = trimmedSearch.length >= 2;
  const suggestionPosition = useAdminFloatingMenuPosition(
    suggestionsOpen && canSearch,
    searchAnchorRef,
    {
      minWidth: 280,
      collisionPadding: 12,
      estimatedHeight: 360,
      zIndex: 10000,
    },
  );

  const syncKey = `${initial.q}|${initial.contentType}|${initial.category}|${initial.series}|${initial.status}|${initial.featured}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setValues(initial);
  }

  const categoryOptions = useMemo(
    () => toAdminCategoryFilterOptions(categories),
    [categories],
  );
  const seriesOptions = useMemo(
    () =>
      series
        .filter((item) => item.status === "published" && !item.deleted_at)
        .map((item) => ({ value: String(item.id), label: item.name })),
    [series],
  );

  const filterDefs = useMemo<AdminEntityFilterDef[]>(() => {
    const categoryLabel = new Map(
      categoryOptions.map((option) => [option.value, option.label]),
    );
    return [
      {
        id: "content-type",
        paramKey: "content_type",
        placeholder: "نوع المحتوى",
        options: CONTENT_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        className: "min-w-[132px] flex-1 lg:w-[150px] lg:flex-none",
      },
      {
        id: "category",
        paramKey: "category",
        placeholder: "التصنيف",
        options: categoryOptions,
        className: "min-w-[132px] flex-1 lg:w-[150px] lg:flex-none",
        getDisplayValue: (value) =>
          value === "all" ? "التصنيف" : categoryLabel.get(value),
      },
      {
        id: "series",
        paramKey: "series",
        placeholder: "السلسلة",
        options: seriesOptions,
        className: "min-w-[132px] flex-1 lg:w-[150px] lg:flex-none",
      },
      {
        id: "status",
        paramKey: "status",
        placeholder: "الحالة",
        options: [
          { value: "published", label: "منشور" },
          { value: "draft", label: "مسودة" },
          { value: "unpublished", label: "مخفي" },
          { value: "archived", label: "أرشيف" },
        ],
        className: "min-w-[132px] flex-1 lg:w-[150px] lg:flex-none",
      },
      {
        id: "featured",
        paramKey: "featured",
        placeholder: "التمييز",
        options: [
          { value: "yes", label: "مميز" },
          { value: "no", label: "غير مميز" },
        ],
        className: "min-w-[132px] flex-1 lg:w-[150px] lg:flex-none",
      },
    ];
  }, [categoryOptions, seriesOptions]);

  function navigate(next: Partial<FilterState>, immediateQ?: string) {
    const merged = { ...values, ...next };
    const params = new URLSearchParams(searchParams.toString());
    const q = (immediateQ ?? merged.q).trim();
    const pairs: Array<[string, string, string]> = [
      ["content_type", merged.contentType, "all"],
      ["category", merged.category, "all"],
      ["series", merged.series, "all"],
      ["status", merged.status, "all"],
      ["featured", merged.featured, "all"],
    ];
    if (q.length >= 2) params.set("q", q);
    else params.delete("q");
    pairs.forEach(([key, value, emptyValue]) => {
      if (value === emptyValue) params.delete(key);
      else params.set(key, value);
    });
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${BASE_PATH}?${query}#content-topics-table` : `${BASE_PATH}#content-topics-table`);
    setSuggestionsOpen(false);
    floating?.setOpenLayerId(null);
  }

  useEffect(() => {
    if (trimmedSearch === initial.q || (trimmedSearch.length > 0 && trimmedSearch.length < 2)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) navigate({}, trimmedSearch);
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // URL state is intentionally compared through initial.q.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedSearch, initial.q]);

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `${BASE_PATH}/search?q=${encodeURIComponent(trimmedSearch)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error("search failed");
        const payload = (await response.json()) as { results?: Suggestion[] };
        if (controller.signal.aborted) return;
        setSuggestions(payload.results ?? []);
        setSuggestionsOpen(
          searchAnchorRef.current?.querySelector("input") ===
            document.activeElement,
        );
        setActiveSuggestion(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, trimmedSearch]);

  const autocomplete =
    mounted && suggestionsOpen && suggestionPosition
      ? createPortal(
          <div
            role="listbox"
            dir="rtl"
            data-placement={suggestionPosition.placement}
            style={suggestionPosition.style}
            className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} ${ADMIN_FILTER_MENU_PANEL_CLASSES}`}
          >
            {suggestionsLoading ? <p className="px-3 py-3 text-sm text-white/45">جاري البحث...</p> : null}
            {!suggestionsLoading && !suggestions.length ? <p className="px-3 py-3 text-sm text-white/45">لا توجد نتائج مطابقة.</p> : null}
            {suggestions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === activeSuggestion}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setValues((current) => ({ ...current, q: item.title }));
                  navigate({ q: item.title }, item.title);
                }}
                className={`block w-full border-b border-white/8 px-3 py-2.5 text-right last:border-0 ${index === activeSuggestion ? "bg-[#D8B87A]/12" : "hover:bg-white/[0.05]"}`}
              >
                <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
                <span className="mt-1 block truncate text-xs text-[#D8B87A]/70">{item.category_name || "غير مصنف"}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  // AdminEntityListFilters navigates via paramKey names; Topics uses content_type etc.
  // Map filter values from adapter state keys to URL param keys.
  const filterValues = {
    content_type: values.contentType,
    category: values.category,
    series: values.series,
    status: values.status,
    featured: values.featured,
  };

  return (
    <>
      <AdminEntityListFilters
        basePath={BASE_PATH}
        hash="#content-topics-table"
        preserveParams={["sort", "limit"]}
        search={{
          placeholder: "ابحث في الموضوعات",
          value: values.q,
          minLength: 2,
        }}
        filters={filterDefs}
        values={filterValues}
        clearableFilterKeys={[
          "q",
          "content_type",
          "category",
          "series",
          "status",
          "featured",
        ]}
        onClearFilters={() => {
          setValues({
            q: "",
            contentType: "all",
            category: "all",
            series: "all",
            status: "all",
            featured: "all",
          });
          setSuggestions([]);
          setSuggestionsOpen(false);
          setActiveSuggestion(-1);
        }}
        searchSlot={
          <>
            <AdminSearchInput
              ref={searchAnchorRef}
              value={values.q}
              placeholder="ابحث في الموضوعات"
              onChange={(q) => {
                setValues((current) => ({ ...current, q }));
                if (q.trim().length < 2) {
                  setSuggestions([]);
                  setSuggestionsOpen(false);
                  setActiveSuggestion(-1);
                }
              }}
              onEnter={() => navigate({}, values.q)}
              onEscape={() => {
                setSuggestionsOpen(false);
                floating?.setOpenLayerId(null);
              }}
              onFocus={() => {
                if (canSearch && suggestions.length) setSuggestionsOpen(true);
              }}
              onClear={() => {
                setValues((current) => ({ ...current, q: "" }));
                setSuggestions([]);
                navigate({ q: "" }, "");
              }}
              onKeyDown={(event) => {
                if (!suggestionsOpen || !suggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestion((current) => (current + 1) % suggestions.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
                } else if (event.key === "Enter" && activeSuggestion >= 0) {
                  event.preventDefault();
                  const item = suggestions[activeSuggestion];
                  setValues((current) => ({ ...current, q: item.title }));
                  navigate({ q: item.title }, item.title);
                }
              }}
            />
            {autocomplete}
          </>
        }
      />
    </>
  );
}
