"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AdminFilterListbox,
  AdminFiltersShell,
  AdminSearchInput,
  ADMIN_FILTER_MENU_SCROLLBAR_CLASSES,
  ADMIN_FILTER_MENU_PANEL_CLASSES,
  isInsideAdminFilterMenu,
  useAdminFloatingMenuPosition,
} from "../../../components/admin/ui";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import type { TopicCategoryGroup } from "./topics-category-groups";

type SeriesOption = {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
};

type Suggestion = {
  id: number;
  title: string;
  slug: string;
  category?: string | null;
};

type TopicsListFiltersProps = {
  q: string;
  status: string;
  category: string;
  series: string;
  featured: string;
  categoryGroups: TopicCategoryGroup[];
  seriesOptions: SeriesOption[];
};

const AUTOCOMPLETE_MENU_ATTR = "data-topics-autocomplete-menu";

function isInsideTopicsAutocomplete(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return false;
  return Boolean(element.closest(`[${AUTOCOMPLETE_MENU_ATTR}]`));
}

export default function TopicsListFilters({
  q,
  status,
  category,
  series,
  featured,
  categoryGroups,
  seriesOptions,
}: TopicsListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLElement>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);

  const [searchValue, setSearchValue] = useState(q);
  const [categoryValue, setCategoryValue] = useState(category);
  const [seriesValue, setSeriesValue] = useState(series);
  const [statusValue, setStatusValue] = useState(status);
  const [featuredValue, setFeaturedValue] = useState(featured);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const isMounted = useClientMounted();

  const filterSyncKey = `${q}|${category}|${series}|${status}|${featured}`;
  const [lastFilterSyncKey, setLastFilterSyncKey] = useState(filterSyncKey);
  if (filterSyncKey !== lastFilterSyncKey) {
    setLastFilterSyncKey(filterSyncKey);
    setSearchValue(q);
    setCategoryValue(category);
    setSeriesValue(series);
    setStatusValue(status);
    setFeaturedValue(featured);
  }

  const categorySlugToId = useMemo(() => {
    const map = new Map<string, number>();
    categoryGroups.forEach((group) => {
      group.options.forEach((option) => map.set(option.slug, option.id));
    });
    return map;
  }, [categoryGroups]);

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    categoryGroups.forEach((group) => {
      group.options.forEach((option) => map.set(option.slug, option.name));
    });
    return map;
  }, [categoryGroups]);

  const visibleSeriesOptions = useMemo(() => {
    if (categoryValue === "all") return seriesOptions;

    const categoryId = categorySlugToId.get(categoryValue);
    if (!categoryId) return seriesOptions;

    return seriesOptions.filter((item) => item.category_id === categoryId);
  }, [categoryValue, categorySlugToId, seriesOptions]);

  if (
    seriesValue !== "all" &&
    !visibleSeriesOptions.some((item) => item.slug === seriesValue)
  ) {
    setSeriesValue("all");
  }

  const trimmedSearch = searchValue.trim();
  const canSuggest = trimmedSearch.length >= 2;
  const autocompletePosition = useAdminFloatingMenuPosition(isSuggestionsOpen && canSuggest, searchAnchorRef);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (rootRef.current?.contains(target as Node)) return;
      if (isInsideAdminFilterMenu(target)) return;
      if (isInsideTopicsAutocomplete(target)) return;

      setOpenDropdown(null);
      setIsSuggestionsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!canSuggest) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setIsSuggestionsLoading(true);
      try {
        const response = await fetch(
          `/admin/topics/search?q=${encodeURIComponent(trimmedSearch)}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("application/json")) {
          setSuggestions([]);
          setIsSuggestionsOpen(false);
          return;
        }

        const json = await response.json();
        const nextSuggestions = (json.results ?? []) as Suggestion[];
        setSuggestions(nextSuggestions);
        setIsSuggestionsOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setIsSuggestionsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedSearch, canSuggest]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    categoryValue !== "all" ||
    seriesValue !== "all" ||
    statusValue !== "all" ||
    featuredValue !== "all";

  function applyFilters(next?: {
    q?: string;
    category?: string;
    series?: string;
    status?: string;
    featured?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextQ = (next?.q ?? searchValue).trim();
    const nextCategory = next?.category ?? categoryValue;
    const nextSeries = next?.series ?? seriesValue;
    const nextStatus = next?.status ?? statusValue;
    const nextFeatured = next?.featured ?? featuredValue;

    if (nextQ) params.set("q", nextQ);
    else params.delete("q");

    if (nextCategory !== "all") params.set("category", nextCategory);
    else params.delete("category");

    if (nextSeries !== "all") params.set("series", nextSeries);
    else params.delete("series");

    if (nextStatus !== "all") params.set("status", nextStatus);
    else params.delete("status");

    if (nextFeatured !== "all") params.set("featured", nextFeatured);
    else params.delete("featured");

    params.delete("page");

    const query = params.toString();
    router.push(query ? `/admin/topics?${query}#topics-table` : "/admin/topics#topics-table");
    setIsSuggestionsOpen(false);
    setOpenDropdown(null);
  }

  const statusOptions = [
    { value: "published", label: "منشور" },
    { value: "draft", label: "مسودة" },
    { value: "unpublished", label: "مخفي" },
    { value: "archived", label: "أرشيف" },
  ];

  const featuredOptions = [
    { value: "yes", label: "مميز" },
    { value: "no", label: "غير مميز" },
  ];

  const seriesDropdownOptions = visibleSeriesOptions.map((item) => ({
    value: item.slug,
    label: item.name,
  }));

  const autocompleteMenu =
    isMounted &&
    canSuggest &&
    isSuggestionsOpen &&
    autocompletePosition &&
    createPortal(
      <div
        {...{ [AUTOCOMPLETE_MENU_ATTR]: "" }}
        dir="rtl"
        style={{
          position: "fixed",
          top: autocompletePosition.top,
          left: autocompletePosition.left,
          width: autocompletePosition.width,
          zIndex: 9999,
        }}
        className={`${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} ${ADMIN_FILTER_MENU_PANEL_CLASSES}`}
      >
        {isSuggestionsLoading ? (
          <p className="px-3 py-2.5 text-sm text-white/45">جاري البحث...</p>
        ) : suggestions.length > 0 ? (
          suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSearchValue(item.title);
                setIsSuggestionsOpen(false);
              }}
              className="block w-full border-b border-white/10 px-3 py-2.5 text-right transition last:border-b-0 hover:bg-[#4A8DFF]/10"
            >
              <span className="block truncate text-sm font-medium text-white">{item.title}</span>
              <span className="mt-0.5 block truncate font-en text-[11px] text-white/35">/topics/{item.slug}</span>
              {item.category ? (
                <span className="mt-0.5 block truncate text-[11px] text-[#D8B87A]/70">{item.category}</span>
              ) : null}
            </button>
          ))
        ) : (
          <p className="px-3 py-2.5 text-sm text-white/45">لا توجد اقتراحات مطابقة.</p>
        )}
      </div>,
      document.body,
    );

  return (
    <AdminFiltersShell ref={rootRef}>
      <AdminSearchInput
        ref={searchAnchorRef}
        value={searchValue}
        onChange={(value) => {
          setSearchValue(value);
          setOpenDropdown(null);
        }}
        onEnter={() => applyFilters()}
        onEscape={() => setIsSuggestionsOpen(false)}
        onFocus={() => {
          if (canSuggest && suggestions.length > 0) setIsSuggestionsOpen(true);
        }}
        onClear={() => {
          setSearchValue("");
          setSuggestions([]);
          setIsSuggestionsOpen(false);
        }}
        placeholder="البحث بالعنوان أو الرابط..."
      />

      {autocompleteMenu}

      <AdminFilterListbox
        id="category"
        isMounted={isMounted}
        placeholder="التصنيف"
        value={categoryValue}
        displayValue={categoryValue === "all" ? "التصنيف" : categoryLabelMap.get(categoryValue) ?? "التصنيف"}
        isOpen={openDropdown === "category"}
        onToggle={() => setOpenDropdown((current) => (current === "category" ? null : "category"))}
        onSelect={(value) => {
          setCategoryValue(value);
          setOpenDropdown(null);
        }}
        groups={categoryGroups.map((group) => ({
          label: group.label,
          options: group.options.map((option) => ({ value: option.slug, label: option.name })),
        }))}
        className="min-w-[140px] flex-1 lg:flex-none lg:w-[150px]"
      />

      <AdminFilterListbox
        id="series"
        isMounted={isMounted}
        placeholder="السلسلة"
        value={seriesValue}
        displayValue={
          seriesValue === "all"
            ? "السلسلة"
            : visibleSeriesOptions.find((item) => item.slug === seriesValue)?.name ?? "السلسلة"
        }
        isOpen={openDropdown === "series"}
        onToggle={() => setOpenDropdown((current) => (current === "series" ? null : "series"))}
        onSelect={(value) => {
          setSeriesValue(value);
          setOpenDropdown(null);
        }}
        options={seriesDropdownOptions}
        className="min-w-[140px] flex-1 lg:flex-none lg:w-[170px]"
      />

      <AdminFilterListbox
        id="status"
        isMounted={isMounted}
        placeholder="الحالة"
        value={statusValue}
        displayValue={
          statusValue === "all"
            ? "الحالة"
            : statusOptions.find((item) => item.value === statusValue)?.label ?? "الحالة"
        }
        isOpen={openDropdown === "status"}
        onToggle={() => setOpenDropdown((current) => (current === "status" ? null : "status"))}
        onSelect={(value) => {
          setStatusValue(value);
          setOpenDropdown(null);
        }}
        options={statusOptions}
        className="min-w-[120px] flex-1 lg:flex-none lg:w-[130px]"
      />

      <AdminFilterListbox
        id="featured"
        isMounted={isMounted}
        placeholder="مميز"
        value={featuredValue}
        displayValue={
          featuredValue === "all"
            ? "مميز"
            : featuredOptions.find((item) => item.value === featuredValue)?.label ?? "مميز"
        }
        isOpen={openDropdown === "featured"}
        onToggle={() => setOpenDropdown((current) => (current === "featured" ? null : "featured"))}
        onSelect={(value) => {
          setFeaturedValue(value);
          setOpenDropdown(null);
        }}
        options={featuredOptions}
        className="min-w-[110px] flex-1 lg:flex-none lg:w-[120px]"
      />

      <div className="ms-auto flex shrink-0 items-center gap-2">
        {hasActiveFilters ? (
          <Link
            href="/admin/topics#topics-table"
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/55 transition hover:border-white/20 hover:text-white"
          >
            تصفير
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => applyFilters()}
          className="inline-flex h-10 items-center rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          بحث
        </button>
      </div>
    </AdminFiltersShell>
  );
}
