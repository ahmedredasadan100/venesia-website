"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  adminCollectionSearchIncludes,
  buildAdminEntityListHref,
  type AdminEntityFilterDef,
  type AdminEntityFilterOption,
  type AdminEntityFilterValues,
  type AdminEntitySearchConfig,
  type AdminEntitySearchSuggestion,
} from "../../../lib/admin/entity-list";
import VenesiaModal, {
  AdminModalCancelButton,
  AdminModalPrimaryButton,
} from "../VenesiaModal";
import AdminSearchInput from "../ui/AdminSearchInput";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "../ui/admin-scrollbar-styles";
import { useAdminFloatingMenuPosition } from "../ui/useAdminFloatingMenuPosition";
import { useAdminFloatingLayer } from "./AdminFloatingLayerContext";

type HistoryBehavior = "push" | "replace";

export type AdminEntityListFiltersProps = {
  basePath: string;
  search: AdminEntitySearchConfig;
  filters: readonly AdminEntityFilterDef[];
  values: AdminEntityFilterValues;
  hash?: string;
  preserveParams?: readonly string[];
  clearableFilterKeys?: readonly string[];
  onClearFilters?: () => void;
  onQueryPatch?: (
    patch: Record<string, string | null>,
    behavior?: HistoryBehavior,
  ) => void;
  /** Collection-owned columns control, rendered at inline-end. */
  columnsControl?: ReactNode;
  /** Bulk actions replace chips while selection is active. */
  contextOverride?: ReactNode;
  contextOverrideActive?: boolean;
  /** Temporary compatibility slots removed from eligible adopters in this pass. */
  trailing?: ReactNode;
  searchSlot?: ReactNode;
  className?: string;
  rowClassName?: string;
};

function activeFilterValue(filter: AdminEntityFilterDef, values: AdminEntityFilterValues) {
  return values[filter.paramKey] ?? filter.defaultValue ?? filter.allValue ?? "all";
}

function isFilterActive(filter: AdminEntityFilterDef, value: string) {
  return value !== (filter.allValue ?? filter.defaultValue ?? "all") && value !== "";
}

function optionsForFilter(filter: AdminEntityFilterDef) {
  return [
    ...(filter.options ?? []),
    ...(filter.groups?.flatMap((group) => group.options) ?? []),
  ];
}

function optionLabel(filter: AdminEntityFilterDef, value: string) {
  return (
    filter.getAppliedLabel?.(value) ??
    filter.getDisplayValue?.(value) ??
    optionsForFilter(filter).find((option) => option.value === value)?.label ??
    value
  );
}

function sameValues(left: AdminEntityFilterValues, right: AdminEntityFilterValues) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => (left[key] ?? "") === (right[key] ?? ""));
}

function FilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 5h16l-6.2 7.1v5.1l-3.6 1.8v-6.9L4 5Z" />
    </svg>
  );
}

function renderHighlightedText(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const index = text.toLocaleLowerCase("ar").indexOf(trimmed.toLocaleLowerCase("ar"));
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-[#D8B87A]/18 px-0.5 text-[#F4E7C5]">
        {text.slice(index, index + trimmed.length)}
      </mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}

function AdminFilterOptionButton({
  option,
  selected,
  onSelect,
}: {
  option: AdminEntityFilterOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={option.disabled}
      onClick={onSelect}
      className={`min-w-0 rounded-[11px] border px-3 py-2.5 text-right text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-[#D8B87A]/55 bg-[#D8B87A]/16 text-[#F4E7C5]"
          : "border-white/9 bg-black/18 text-white/64 hover:border-[#D8B87A]/28 hover:bg-white/[0.04] hover:text-white/85"
      }`}
    >
      <span className="block truncate font-semibold" style={{ paddingInlineStart: option.depth ? `${option.depth * 14}px` : undefined }}>
        {option.label}
      </span>
      {option.secondaryLabel ? (
        <span className="mt-1 block truncate text-xs text-white/38">{option.secondaryLabel}</span>
      ) : null}
    </button>
  );
}

function AdminFilterField({
  filter,
  value,
  onChange,
}: {
  filter: AdminEntityFilterDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const [optionQuery, setOptionQuery] = useState("");
  const allValue = filter.allValue ?? filter.defaultValue ?? "all";
  const allOptions = optionsForFilter(filter);
  const searchable = filter.searchable || ["entity_select", "hierarchical_entity_select", "multi_select"].includes(filter.type ?? "");
  const visibleOptions = optionQuery.trim()
    ? allOptions.filter((option) =>
        adminCollectionSearchIncludes(
          `${option.label} ${option.secondaryLabel ?? ""} ${option.searchText ?? ""}`,
          optionQuery,
        ),
      )
    : allOptions;
  const isDate = filter.type === "date" || filter.type === "date_range";

  return (
    <fieldset
      disabled={filter.disabled}
      className={`min-w-0 rounded-[15px] border border-white/8 bg-black/16 p-3.5 ${searchable || isDate ? "md:col-span-2" : ""}`}
      data-admin-filter-field={filter.id}
    >
      <legend className="px-1 text-sm font-semibold text-white/82">
        {filter.label ?? filter.placeholder}
      </legend>

      {isDate ? (
        <input
          type="date"
          value={value === allValue ? "" : value}
          onChange={(event) => onChange(event.currentTarget.value || allValue)}
          className="mt-2 h-11 w-full rounded-[11px] border border-white/10 bg-[#080B10] px-3 text-sm text-white outline-none focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/10"
        />
      ) : (
        <>
          {searchable ? (
            <input
              type="search"
              value={optionQuery}
              onChange={(event) => setOptionQuery(event.currentTarget.value)}
              placeholder={filter.optionSearchPlaceholder ?? `ابحث داخل ${filter.label ?? filter.placeholder}...`}
              className="mt-2 h-10 w-full rounded-[10px] border border-white/10 bg-[#080B10] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45"
            />
          ) : null}

          <div
            role="listbox"
            aria-label={filter.label ?? filter.placeholder}
            className={`mt-2 grid gap-2 ${searchable ? `max-h-52 overflow-y-auto pe-1 ${ADMIN_SCROLLBAR_VISUAL_CLASSES}` : "sm:grid-cols-2"}`}
          >
            <AdminFilterOptionButton
              option={{ value: allValue, label: "الكل" }}
              selected={value === allValue}
              onSelect={() => onChange(allValue)}
            />
            {visibleOptions.map((option) => (
              <AdminFilterOptionButton
                key={option.value}
                option={option}
                selected={value === option.value}
                onSelect={() => onChange(option.value)}
              />
            ))}
          </div>

          {searchable && optionQuery.trim() && visibleOptions.length === 0 ? (
            <p className="mt-2 text-xs text-white/42">لا توجد خيارات مطابقة.</p>
          ) : null}
        </>
      )}
    </fieldset>
  );
}

export default function AdminEntityListFilters({
  basePath,
  search,
  filters,
  values,
  hash,
  preserveParams = [],
  clearableFilterKeys,
  onClearFilters,
  onQueryPatch,
  columnsControl,
  contextOverride,
  contextOverrideActive = false,
  className = "",
}: AdminEntityListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useClientMounted();
  const floating = useAdminFloatingLayer();
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const suggestionsLayerRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const suggestionsListId = useId();
  const [draftSearch, setDraftSearch] = useState(search.value);
  const [lastExternalSearch, setLastExternalSearch] = useState(search.value);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdminEntityFilterValues>({ ...values });
  const [suggestions, setSuggestions] = useState<readonly AdminEntitySearchSuggestion[]>([]);
  const [suggestionsQuery, setSuggestionsQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [, startTransition] = useTransition();
  const suggestionConfig = search.suggestions?.enabled ? search.suggestions : null;
  const searchParamKey = search.paramKey ?? "q";
  const minLength = search.minLength ?? 0;
  const debounceMs = search.debounceMs ?? 350;
  const suggestionMinLength = suggestionConfig?.minLength ?? Math.max(2, minLength);
  const trimmedSearch = draftSearch.replace(/\s+/g, " ").trim();
  const canSuggest = Boolean(suggestionConfig && trimmedSearch.length >= suggestionMinLength);
  const visibleSuggestions = suggestionsQuery === trimmedSearch ? suggestions : [];
  const suggestionPosition = useAdminFloatingMenuPosition(
    suggestionsOpen && canSuggest,
    searchAnchorRef,
    { minWidth: 280, collisionPadding: 12, estimatedHeight: 360, zIndex: 10000 },
  );

  if (search.value !== lastExternalSearch) {
    setLastExternalSearch(search.value);
    setDraftSearch(search.value);
  }

  function navigate(
    patch: Record<string, string | null>,
    behavior: HistoryBehavior,
  ) {
    floating?.setOpenLayerId(null);
    if (onQueryPatch) {
      onQueryPatch(patch, behavior);
      return;
    }

    const current = new URLSearchParams(searchParams.toString());
    preserveParams.forEach((key) => {
      if (!(key in patch) && current.has(key)) patch[key] = current.get(key);
    });
    const href = buildAdminEntityListHref(basePath, current, patch, hash);
    startTransition(() => router[behavior](href, { scroll: false }));
  }

  function commitSearch(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    const next = normalized.length > 0 && normalized.length < minLength ? "" : normalized;
    navigate({ [searchParamKey]: next || null }, "replace");
  }

  useEffect(() => {
    if (trimmedSearch === search.value.trim()) return;
    const timer = window.setTimeout(() => commitSearch(trimmedSearch), debounceMs);
    return () => window.clearTimeout(timer);
    // URL/query state is intentionally compared through search.value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedSearch, search.value, minLength, debounceMs]);

  useEffect(() => {
    if (!suggestionConfig || !canSuggest) return;

    const controller = new AbortController();
    const requestedQuery = trimmedSearch;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      setSuggestionsError(null);
      try {
        const loaded = await suggestionConfig.load(requestedQuery, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestedQuery !== trimmedSearch) return;
        setSuggestions(loaded.slice(0, suggestionConfig.maxResults ?? 8));
        setSuggestionsQuery(requestedQuery);
        setActiveSuggestion(-1);
        if (searchAnchorRef.current?.querySelector("input") === document.activeElement) {
          setSuggestionsOpen(true);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSuggestionsError(error instanceof Error ? error.message : "تعذر تحميل الاقتراحات.");
        setSuggestionsOpen(true);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSuggest, debounceMs, suggestionConfig, trimmedSearch]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        searchAnchorRef.current?.contains(target) ||
        suggestionsLayerRef.current?.contains(target)
      ) return;
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [suggestionsOpen]);

  function selectSuggestion(suggestion: AdminEntitySearchSuggestion) {
    const value = suggestion.searchValue ?? suggestion.primaryText;
    setDraftSearch(value);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    suggestionConfig?.onSelect?.(suggestion);
    if ((suggestionConfig?.selectionAction ?? "set_query") !== "navigate_to_entity") {
      commitSearch(value);
    }
  }

  const appliedFilters = useMemo(
    () => filters.map((filter) => ({ filter, value: activeFilterValue(filter, values) })).filter(({ filter, value }) => isFilterActive(filter, value)),
    [filters, values],
  );
  const activeCount = appliedFilters.reduce((count, { filter, value }) => {
    if (filter.activeCountBehavior === "value" && filter.selectionMode === "multi") {
      return count + Math.max(1, value.split(",").filter(Boolean).length);
    }
    return count + 1;
  }, 0);
  const registeredClearableKeys = clearableFilterKeys ?? filters.map((filter) => filter.paramKey);
  const normalizedAppliedValues = Object.fromEntries(
    filters.map((filter) => [filter.paramKey, activeFilterValue(filter, values)]),
  );
  const normalizedDraftValues = Object.fromEntries(
    filters.map((filter) => [filter.paramKey, activeFilterValue(filter, draftFilters)]),
  );
  const draftChanged = !sameValues(normalizedAppliedValues, normalizedDraftValues);
  const dateFrom = draftFilters.dateFrom ?? "";
  const dateTo = draftFilters.dateTo ?? "";
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  function openFilters() {
    setDraftFilters({ ...values });
    floating?.setOpenLayerId(null);
    setSuggestionsOpen(false);
    setFilterModalOpen(true);
  }

  function cancelFilters() {
    setDraftFilters({ ...values });
    setFilterModalOpen(false);
  }

  function clearDraftFilters() {
    setDraftFilters(
      Object.fromEntries(
        filters.map((filter) => [
          filter.paramKey,
          filter.defaultValue ?? filter.allValue ?? "all",
        ]),
      ),
    );
  }

  function applyDraftFilters() {
    if (invalidDateRange) return;
    const patch: Record<string, string | null> = {};
    filters.forEach((filter) => {
      const value = activeFilterValue(filter, draftFilters);
      patch[filter.paramKey] = isFilterActive(filter, value) ? value : null;
    });
    navigate(patch, "push");
    setFilterModalOpen(false);
  }

  function removeFilter(filter: AdminEntityFilterDef) {
    navigate({ [filter.paramKey]: null }, "push");
  }

  function clearAppliedFilters() {
    const patch: Record<string, string | null> = {};
    filters.forEach((filter) => {
      if (registeredClearableKeys.includes(filter.paramKey)) patch[filter.paramKey] = null;
    });
    navigate(patch, "push");
    onClearFilters?.();
  }

  const suggestionsLayer =
    mounted && suggestionsOpen && canSuggest && suggestionPosition
      ? createPortal(
          <div
            ref={suggestionsLayerRef}
            id={suggestionsListId}
            role="listbox"
            aria-label="اقتراحات البحث"
            dir="rtl"
            data-admin-search-suggestions=""
            data-placement={suggestionPosition.placement}
            style={suggestionPosition.style}
            className={`overflow-y-auto rounded-[14px] border border-[#D8B87A]/22 bg-[#090C11]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
          >
            {suggestionsLoading ? (
              <p role="status" className="px-3 py-3 text-sm text-white/48">جاري تحميل الاقتراحات...</p>
            ) : null}
            {!suggestionsLoading && suggestionsError ? (
              <p role="alert" className="px-3 py-3 text-sm text-red-200/80">{suggestionsError}</p>
            ) : null}
            {!suggestionsLoading && !suggestionsError && visibleSuggestions.length === 0 ? (
              <p className="px-3 py-3 text-sm text-white/48">لا توجد اقتراحات مطابقة.</p>
            ) : null}
            {visibleSuggestions.map((suggestion, index) => (
              <button
                key={String(suggestion.id)}
                id={`${suggestionsListId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeSuggestion}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSuggestion(index)}
                onClick={() => selectSuggestion(suggestion)}
                className={`block w-full rounded-[10px] px-3 py-2.5 text-right transition ${
                  index === activeSuggestion ? "bg-[#D8B87A]/14" : "hover:bg-white/[0.05]"
                }`}
              >
                <span className="block truncate text-sm font-semibold text-white">
                  {renderHighlightedText(suggestion.primaryText, trimmedSearch)}
                </span>
                {suggestion.secondaryText || suggestion.typeLabel ? (
                  <span className="mt-1 block truncate text-xs text-[#D8B87A]/68">
                    {[suggestion.secondaryText, suggestion.typeLabel].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  const showContextRow = contextOverrideActive || appliedFilters.length > 0;

  return (
    <>
      <section
        dir="rtl"
        data-admin-collection-toolbar-owner=""
        className={`overflow-visible rounded-t-[20px] border border-b-0 border-[#D8B87A]/14 bg-[#080B10]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${className}`.trim()}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <AdminSearchInput
              ref={searchAnchorRef}
              value={draftSearch}
              placeholder={search.placeholder}
              disabled={search.disabled}
              pending={search.pending}
              expanded={suggestionConfig ? suggestionsOpen : undefined}
              controls={suggestionConfig ? suggestionsListId : undefined}
              activeDescendant={activeSuggestion >= 0 ? `${suggestionsListId}-${activeSuggestion}` : undefined}
              className={search.className ?? "min-w-[160px] flex-1 sm:max-w-[420px]"}
              onChange={(value) => {
                setDraftSearch(value);
                setActiveSuggestion(-1);
                setSuggestionsError(null);
                setSuggestionsLoading(
                  Boolean(suggestionConfig && value.trim().length >= suggestionMinLength),
                );
                if (value.trim().length < suggestionMinLength) setSuggestionsOpen(false);
              }}
              onEnter={() => {
                if (suggestionsOpen && activeSuggestion >= 0 && visibleSuggestions[activeSuggestion]) {
                  selectSuggestion(visibleSuggestions[activeSuggestion]);
                } else {
                  commitSearch(draftSearch);
                  setSuggestionsOpen(false);
                }
              }}
              onEscape={() => {
                if (suggestionsOpen) {
                  setSuggestionsOpen(false);
                  setActiveSuggestion(-1);
                } else {
                  setDraftSearch(search.value);
                }
              }}
              onFocus={() => {
                if (canSuggest && (visibleSuggestions.length || suggestionsLoading || suggestionsError)) setSuggestionsOpen(true);
              }}
              onClear={() => {
                setDraftSearch("");
                setSuggestions([]);
                setSuggestionsOpen(false);
                commitSearch("");
              }}
              onKeyDown={(event) => {
                if (!suggestionsOpen || visibleSuggestions.length === 0) {
                  if (event.key === "ArrowDown" && canSuggest) setSuggestionsOpen(true);
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestion((current) => (current + 1) % visibleSuggestions.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestion((current) => (current <= 0 ? visibleSuggestions.length - 1 : current - 1));
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setActiveSuggestion(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setActiveSuggestion(visibleSuggestions.length - 1);
                } else if (event.key === "Tab") {
                  setSuggestionsOpen(false);
                }
              }}
            />

            <button
              ref={filterTriggerRef}
              type="button"
              data-admin-filter-trigger=""
              aria-haspopup="dialog"
              aria-expanded={filterModalOpen}
              aria-label={activeCount ? `الفلاتر، ${activeCount} نشطة` : "الفلاتر"}
              onClick={openFilters}
              disabled={filters.length === 0}
              className="relative flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[11px] border border-white/10 bg-black/24 px-3.5 text-sm font-semibold text-white/72 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/9 hover:text-[#F4E7C5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FilterIcon className="h-4 w-4 text-[#D8B87A]/78" />
              <span className="hidden sm:inline">الفلاتر</span>
              {activeCount ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D8B87A] px-1 text-[10px] font-bold text-[#080B10]">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="ms-auto shrink-0" data-admin-toolbar-columns="">
            {columnsControl}
          </div>
        </div>

        {showContextRow ? (
          <div
            data-admin-collection-context-row=""
            data-admin-context-mode={contextOverrideActive ? "bulk" : "filters"}
            className="border-t border-white/8 px-3 py-2.5 sm:px-4"
          >
            {contextOverrideActive ? (
              contextOverride
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {appliedFilters.map(({ filter, value }) => (
                  <span
                    key={filter.id}
                    className="inline-flex min-w-0 items-center gap-2 rounded-[9px] border border-[#D8B87A]/16 bg-[#D8B87A]/8 px-2.5 py-1.5 text-xs text-[#F4E7C5]/82"
                  >
                    <span className="max-w-[230px] truncate">
                      <span className="text-white/48">{filter.label ?? filter.placeholder}: </span>
                      {optionLabel(filter, value)}
                    </span>
                    <button
                      type="button"
                      aria-label={`إزالة فلتر ${filter.label ?? filter.placeholder}`}
                      onClick={() => removeFilter(filter)}
                      className="rounded px-1 text-white/45 transition hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B87A]/70"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearAppliedFilters}
                  className="ms-auto rounded-[9px] px-2.5 py-1.5 text-xs font-semibold text-[#D8B87A]/78 transition hover:bg-[#D8B87A]/8 hover:text-[#F4E7C5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B87A]/70"
                >
                  مسح كل الفلاتر
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {suggestionsLayer}

      <VenesiaModal
        open={filterModalOpen}
        eyebrow="FILTERS"
        title="الفلاتر"
        description="خصّص النتائج التي تريد ظهورها في الجدول."
        size="lg"
        onClose={cancelFilters}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <AdminModalPrimaryButton disabled={!draftChanged || invalidDateRange} onClick={applyDraftFilters}>
              تطبيق الفلاتر
            </AdminModalPrimaryButton>
            <div className="ms-auto flex items-center gap-2">
              <AdminModalCancelButton onClick={cancelFilters}>إلغاء</AdminModalCancelButton>
              <button
                type="button"
                onClick={clearDraftFilters}
                className="h-10 rounded-[10px] border border-white/10 px-4 text-sm font-semibold text-white/56 transition hover:border-[#D8B87A]/25 hover:bg-white/[0.04] hover:text-white/82 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
              >
                مسح الكل
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2" data-admin-filter-modal-fields="">
          {filters.map((filter) => (
            <AdminFilterField
              key={filter.id}
              filter={filter}
              value={activeFilterValue(filter, draftFilters)}
              onChange={(value) =>
                setDraftFilters((current) => ({ ...current, [filter.paramKey]: value }))
              }
            />
          ))}
        </div>
        {invalidDateRange ? (
          <p role="alert" className="mt-3 rounded-[10px] border border-red-400/20 bg-red-500/8 px-3 py-2 text-sm text-red-200/80">
            تاريخ النهاية يجب ألا يسبق تاريخ البداية.
          </p>
        ) : null}
      </VenesiaModal>
    </>
  );
}
