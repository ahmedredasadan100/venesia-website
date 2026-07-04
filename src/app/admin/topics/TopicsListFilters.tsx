"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type DropdownOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
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

const FILTER_MENU_ATTR = "data-topics-filter-menu";
const AUTOCOMPLETE_MENU_ATTR = "data-topics-autocomplete-menu";

const MENU_SCROLLBAR_CLASSES =
  "max-h-[260px] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.24)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function isInsideTopicsOverlay(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return false;
  return Boolean(
    element.closest(`[${FILTER_MENU_ATTR}]`) ||
      element.closest(`[${AUTOCOMPLETE_MENU_ATTR}]`),
  );
}

function useFixedMenuPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
) {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, anchorRef]);

  return position;
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSearchValue(q);
    setCategoryValue(category);
    setSeriesValue(series);
    setStatusValue(status);
    setFeaturedValue(featured);
  }, [q, category, series, status, featured]);

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

  useEffect(() => {
    if (seriesValue === "all") return;
    if (!visibleSeriesOptions.some((item) => item.slug === seriesValue)) {
      setSeriesValue("all");
    }
  }, [seriesValue, visibleSeriesOptions]);

  const trimmedSearch = searchValue.trim();
  const canSuggest = trimmedSearch.length >= 2;
  const autocompletePosition = useFixedMenuPosition(isSuggestionsOpen && canSuggest, searchAnchorRef);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (rootRef.current?.contains(target as Node)) return;
      if (isInsideTopicsOverlay(target)) return;

      setOpenDropdown(null);
      setIsSuggestionsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!canSuggest) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      setIsSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsSuggestionsLoading(true);

    const timer = window.setTimeout(async () => {
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

  const statusOptions: DropdownOption[] = [
    { value: "published", label: "منشور" },
    { value: "draft", label: "مسودة" },
    { value: "unpublished", label: "مخفي" },
    { value: "archived", label: "أرشيف" },
  ];

  const featuredOptions: DropdownOption[] = [
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
        className={`${MENU_SCROLLBAR_CLASSES} rounded-[14px] border border-white/10 bg-[#080B10]/95 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl`}
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
    <section
      ref={rootRef}
      dir="rtl"
      className="group relative overflow-visible rounded-[26px] border border-white/10 bg-[#080B10]/70 px-3 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:px-4"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[26px] opacity-70 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at 85% 12%, rgba(74,141,255,0.16), transparent 40%)" }}
      />

      <div className="flex flex-wrap items-center gap-2 overflow-visible lg:flex-nowrap">
        <div
          ref={searchAnchorRef}
          className="relative w-full min-w-[180px] overflow-visible sm:w-[220px] lg:w-[240px] lg:shrink-0"
        >
          <input
            name="q"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setOpenDropdown(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
              }
              if (event.key === "Escape") {
                setIsSuggestionsOpen(false);
              }
            }}
            onFocus={() => {
              if (canSuggest && suggestions.length > 0) setIsSuggestionsOpen(true);
            }}
            placeholder="البحث بالعنوان أو الرابط..."
            className="h-10 w-full rounded-[10px] border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#4A8DFF]/35"
            autoComplete="off"
          />

          {searchValue ? (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setSuggestions([]);
                setIsSuggestionsOpen(false);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[11px] text-white/45 transition hover:text-white"
            >
              مسح
            </button>
          ) : null}
        </div>

        {autocompleteMenu}

        <FilterDropdown
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

        <FilterDropdown
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

        <FilterDropdown
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

        <FilterDropdown
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
      </div>
    </section>
  );
}

function FilterDropdown({
  id,
  isMounted,
  placeholder,
  value,
  displayValue,
  isOpen,
  onToggle,
  onSelect,
  options = [],
  groups = [],
  className = "",
}: {
  id: string;
  isMounted: boolean;
  placeholder: string;
  value: string;
  displayValue: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  options?: DropdownOption[];
  groups?: Array<{ label: string; options: DropdownOption[] }>;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPosition = useFixedMenuPosition(isOpen, triggerRef);
  const isPlaceholder = value === "all";

  const menu =
    isMounted &&
    isOpen &&
    menuPosition &&
    createPortal(
      <div
        {...{ [FILTER_MENU_ATTR]: "" }}
        id={`${id}-listbox`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
        dir="rtl"
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 9999,
        }}
        className={`${MENU_SCROLLBAR_CLASSES} rounded-[14px] border border-white/10 bg-[#080B10]/95 p-1.5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl`}
      >
        <DropdownItem label={placeholder} selected={value === "all"} onSelect={() => onSelect("all")} />

        {groups.length > 0
          ? groups.map((group) => (
              <div key={group.label} className="mt-1">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D8B87A]/65">
                  {group.label}
                </p>
                {group.options.map((option) => (
                  <DropdownItem
                    key={option.value}
                    label={option.label}
                    selected={value === option.value}
                    onSelect={() => onSelect(option.value)}
                  />
                ))}
              </div>
            ))
          : options.map((option) => (
              <DropdownItem
                key={option.value}
                label={option.label}
                selected={value === option.value}
                onSelect={() => onSelect(option.value)}
              />
            ))}
      </div>,
      document.body,
    );

  return (
    <div className={`relative overflow-visible ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        onClick={onToggle}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-black/25 px-3 text-sm transition hover:border-white/18 focus:border-[#4A8DFF]/35 focus:outline-none ${
          isPlaceholder ? "text-white/45" : "font-medium text-white"
        }`}
      >
        <span className="truncate">{displayValue}</span>
        <span className={`shrink-0 text-white/45 transition ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDownIcon />
        </span>
      </button>

      {menu}
    </div>
  );
}

function DropdownItem({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`block w-full rounded-[8px] px-2.5 py-2 text-right text-sm transition ${
        selected
          ? "bg-[#D8B87A]/14 font-medium text-[#E6C882]"
          : "text-white/78 hover:bg-white/[0.05]"
      }`}
    >
      {label}
    </button>
  );
}
