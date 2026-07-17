"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminContentCategoryNode } from "../../../lib/admin/content/category-hierarchy";
import { CONTENT_TYPE_OPTIONS } from "../../../lib/admin/content/content-types";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  AdminFilterListbox,
  AdminFiltersShell,
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
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState(initial);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
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
    { minWidth: 280 },
  );

  const syncKey = `${initial.q}|${initial.contentType}|${initial.category}|${initial.series}|${initial.status}|${initial.featured}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setValues(initial);
  }

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: `${"— ".repeat(category.depth)}${category.name}`,
      })),
    [categories],
  );
  const categoryLabel = new Map(categoryOptions.map((option) => [option.value, option.label]));
  const seriesOptions = series
    .filter((item) => item.status === "published" && !item.deleted_at)
    .map((item) => ({ value: String(item.id), label: item.name }));

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
    setOpenDropdown(null);
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
        setSuggestionsOpen(true);
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

  function selectFilter(key: keyof FilterState, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    navigate({ [key]: value });
  }

  function resetFilters() {
    const params = new URLSearchParams(searchParams.toString());
    ["q", "content_type", "category", "series", "status", "featured", "page"].forEach((key) =>
      params.delete(key),
    );
    setValues({ q: "", contentType: "all", category: "all", series: "all", status: "all", featured: "all" });
    setSuggestions([]);
    setSuggestionsOpen(false);
    setOpenDropdown(null);
    const query = params.toString();
    router.push(query ? `${BASE_PATH}?${query}#content-topics-table` : `${BASE_PATH}#content-topics-table`);
  }

  const hasFilters =
    values.q.length > 0 ||
    values.contentType !== "all" ||
    values.category !== "all" ||
    values.series !== "all" ||
    values.status !== "all" ||
    values.featured !== "all";

  const autocomplete =
    mounted && suggestionsOpen && suggestionPosition
      ? createPortal(
          <div
            role="listbox"
            dir="rtl"
            style={{ position: "fixed", top: suggestionPosition.top, left: suggestionPosition.left, width: suggestionPosition.width, zIndex: 10000 }}
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

  return (
    <AdminFiltersShell>
      <AdminSearchInput
        ref={searchAnchorRef}
        value={values.q}
        placeholder="البحث في العنوان..."
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
          setOpenDropdown(null);
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
      <Filter
        id="content-type"
        label="نوع المحتوى"
        value={values.contentType}
        options={CONTENT_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        open={openDropdown}
        setOpen={setOpenDropdown}
        onSelect={(value) => selectFilter("contentType", value)}
        mounted={mounted}
      />
      <Filter
        id="category"
        label="التصنيف"
        value={values.category}
        options={categoryOptions}
        open={openDropdown}
        setOpen={setOpenDropdown}
        onSelect={(value) => selectFilter("category", value)}
        mounted={mounted}
        displayValue={values.category === "all" ? "التصنيف" : categoryLabel.get(values.category)}
      />
      <Filter
        id="series"
        label="السلسلة"
        value={values.series}
        options={seriesOptions}
        open={openDropdown}
        setOpen={setOpenDropdown}
        onSelect={(value) => selectFilter("series", value)}
        mounted={mounted}
      />
      <Filter
        id="status"
        label="الحالة"
        value={values.status}
        options={[
          { value: "published", label: "منشور" },
          { value: "draft", label: "مسودة" },
          { value: "unpublished", label: "مخفي" },
          { value: "archived", label: "أرشيف" },
        ]}
        open={openDropdown}
        setOpen={setOpenDropdown}
        onSelect={(value) => selectFilter("status", value)}
        mounted={mounted}
      />
      <Filter
        id="featured"
        label="التمييز"
        value={values.featured}
        options={[
          { value: "yes", label: "مميز" },
          { value: "no", label: "غير مميز" },
        ]}
        open={openDropdown}
        setOpen={setOpenDropdown}
        onSelect={(value) => selectFilter("featured", value)}
        mounted={mounted}
      />
      {hasFilters ? (
        <button type="button" onClick={resetFilters} className="ms-auto h-10 rounded-full border border-white/10 px-4 text-sm text-white/58 transition hover:border-white/20 hover:text-white">
          مسح الفلاتر
        </button>
      ) : null}
    </AdminFiltersShell>
  );
}

function Filter({
  id,
  label,
  value,
  options,
  open,
  setOpen,
  onSelect,
  mounted,
  displayValue,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  open: string | null;
  setOpen: (value: string | null) => void;
  onSelect: (value: string) => void;
  mounted: boolean;
  displayValue?: string;
}) {
  return (
    <AdminFilterListbox
      id={id}
      isMounted={mounted}
      placeholder={label}
      value={value}
      displayValue={displayValue ?? (value === "all" ? label : options.find((option) => option.value === value)?.label ?? label)}
      isOpen={open === id}
      onToggle={() => setOpen(open === id ? null : id)}
      onSelect={onSelect}
      options={options}
      className="min-w-[132px] flex-1 lg:w-[150px] lg:flex-none"
    />
  );
}
