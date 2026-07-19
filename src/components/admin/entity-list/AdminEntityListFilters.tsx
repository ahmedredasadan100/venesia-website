"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  buildAdminEntityListHref,
  type AdminEntityFilterDef,
  type AdminEntityFilterValues,
  type AdminEntitySearchConfig,
} from "../../../lib/admin/entity-list";
import {
  AdminFilterListbox,
  AdminFiltersShell,
  AdminSearchInput,
} from "../ui";
import { useAdminFloatingLayer } from "./AdminFloatingLayerContext";

export type AdminEntityListFiltersProps = {
  basePath: string;
  search: AdminEntitySearchConfig;
  filters: readonly AdminEntityFilterDef[];
  values: AdminEntityFilterValues;
  hash?: string;
  /** Preserve these params when navigating (e.g. sort). */
  preserveParams?: readonly string[];
  /** Query keys reset by the shared clear-filters control. */
  clearableFilterKeys?: readonly string[];
  /** Lets a custom search consumer reset its own transient UI. */
  onClearFilters?: () => void;
  /** Client data engines handle query patches without a Next navigation. */
  onQueryPatch?: (patch: Record<string, string | null>) => void;
  trailing?: ReactNode;
  searchSlot?: ReactNode;
  className?: string;
  rowClassName?: string;
};

function layerIdForFilter(filterId: string) {
  return `entity-filter:${filterId}`;
}

/**
 * Config-driven search + multi-filter toolbar.
 * Dropdown open state shares the entity-list floating layer registry.
 */
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
  trailing,
  searchSlot,
  className = "",
  rowClassName = "",
}: AdminEntityListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useClientMounted();
  const floating = useAdminFloatingLayer();
  const openLayerId = floating?.openLayerId ?? null;
  const setOpenLayerId = floating?.setOpenLayerId ?? (() => undefined);

  const searchParamKey = search.paramKey ?? "q";
  const minLength = search.minLength ?? 0;
  const debounceMs = search.debounceMs ?? 350;
  const ownsSearch = !searchSlot;
  const [draftSearch, setDraftSearch] = useState(search.value);
  const [lastExternalSearch, setLastExternalSearch] = useState(search.value);
  const [pendingFilterValues, setPendingFilterValues] = useState<
    Record<string, { value: string; baseValue: string }>
  >({});
  const searchNavigationRevisionRef = useRef(0);
  const [, startTransition] = useTransition();

  if (ownsSearch && search.value !== lastExternalSearch) {
    setLastExternalSearch(search.value);
    setDraftSearch(search.value);
  }

  const effectiveValues = { ...values };
  filters.forEach((filter) => {
    const pending = pendingFilterValues[filter.paramKey];
    const allValue = filter.allValue ?? "all";
    const externalValue = values[filter.paramKey] ?? allValue;
    if (pending && pending.baseValue === externalValue) {
      effectiveValues[filter.paramKey] = pending.value;
    }
  });
  const registeredClearableKeys = [
    searchParamKey,
    ...(clearableFilterKeys ?? filters.map((filter) => filter.paramKey)),
  ];

  function navigate(patch: Record<string, string | null>) {
    if (onQueryPatch) {
      onQueryPatch(patch);
      setOpenLayerId(null);
      return;
    }
    const current = new URLSearchParams(searchParams.toString());
    filters.forEach((filter) => {
      const allValue = filter.allValue ?? "all";
      const value = effectiveValues[filter.paramKey] ?? allValue;
      if (value === allValue) current.delete(filter.paramKey);
      else current.set(filter.paramKey, value);
    });
    preserveParams.forEach((key) => {
      if (!(key in patch) && current.has(key)) {
        patch[key] = current.get(key);
      }
    });
    const href = buildAdminEntityListHref(basePath, current, patch, hash);
    startTransition(() => router.push(href, { scroll: false }));
    setOpenLayerId(null);
  }

  function clearFilters() {
    const patch: Record<string, string | null> = {};
    const nextPending: Record<string, { value: string; baseValue: string }> = {};
    filters.forEach((filter) => {
      if (!registeredClearableKeys.includes(filter.paramKey)) return;
      const allValue = filter.allValue ?? "all";
      nextPending[filter.paramKey] = {
        value: allValue,
        baseValue: values[filter.paramKey] ?? allValue,
      };
      patch[filter.paramKey] = null;
    });
    registeredClearableKeys.forEach((key) => {
      patch[key] = null;
    });
    setPendingFilterValues((current) => ({ ...current, ...nextPending }));
    searchNavigationRevisionRef.current += 1;
    if (ownsSearch) setDraftSearch("");
    onClearFilters?.();
    navigate(patch);
  }

  useEffect(() => {
    if (!ownsSearch) return;
    const trimmed = draftSearch.trim();
    const committed = search.value.trim();
    if (trimmed === committed) return;
    if (trimmed.length > 0 && trimmed.length < minLength) return;

    const controller = new AbortController();
    const revision = searchNavigationRevisionRef.current;
    const timer = window.setTimeout(() => {
      if (
        controller.signal.aborted ||
        revision !== searchNavigationRevisionRef.current
      ) {
        return;
      }
      navigate({
        [searchParamKey]:
          trimmed.length === 0 || trimmed.length < minLength ? null : trimmed,
      });
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // Intentionally keyed on draft vs committed search only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownsSearch, draftSearch, search.value, minLength, debounceMs, searchParamKey]);

  const filterNodes = useMemo(
    () =>
      filters.map((filter) => {
        const allValue = filter.allValue ?? "all";
        const value = effectiveValues[filter.paramKey] ?? allValue;
        const displayFromOptions =
          filter.options?.find((option) => option.value === value)?.label ??
          filter.groups
            ?.flatMap((group) => group.options)
            .find((option) => option.value === value)?.label;
        const displayValue =
          filter.getDisplayValue?.(value) ??
          (value === allValue
            ? filter.placeholder
            : (displayFromOptions ?? filter.placeholder));
        const id = filter.id;
        const layerId = layerIdForFilter(id);

        return (
          <AdminFilterListbox
            key={id}
            id={id}
            layerId={layerId}
            openLayerId={openLayerId}
            onOpenLayer={setOpenLayerId}
            isMounted={mounted}
            placeholder={filter.placeholder}
            allValue={allValue}
            value={value}
            displayValue={displayValue}
            isOpen={openLayerId === layerId}
            onToggle={() =>
              setOpenLayerId(openLayerId === layerId ? null : layerId)
            }
            onSelect={(next) => {
              setPendingFilterValues((current) => ({
                ...current,
                [filter.paramKey]: {
                  value: next,
                  baseValue:
                    values[filter.paramKey] ?? filter.allValue ?? "all",
                },
              }));
              navigate({
                [filter.paramKey]: next === allValue ? null : next,
              });
            }}
            options={filter.options}
            groups={filter.groups}
            className={filter.className ?? "min-w-[160px]"}
            disabled={filter.disabled}
          />
        );
      }),
    // Pending values keep the trigger stable until the URL catches up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, effectiveValues, openLayerId, mounted],
  );

  const hasActiveFilters =
    (ownsSearch ? draftSearch : search.value).trim().length > 0 ||
    filters.some((filter) => {
      const allValue = filter.allValue ?? "all";
      return (effectiveValues[filter.paramKey] ?? allValue) !== allValue;
    });

  return (
    <AdminFiltersShell className={className} rowClassName={rowClassName}>
      {searchSlot ?? (
        <AdminSearchInput
          value={draftSearch}
          placeholder={search.placeholder}
          className={search.className ?? "max-w-[330px]"}
          onChange={setDraftSearch}
          onEnter={() => {
            const trimmed = draftSearch.trim();
            navigate({
              [searchParamKey]:
                trimmed.length === 0 || trimmed.length < minLength
                  ? null
                  : trimmed,
            });
          }}
          onClear={() => {
            setDraftSearch("");
            navigate({ [searchParamKey]: null });
          }}
          onEscape={() => setOpenLayerId(null)}
        />
      )}
      {filterNodes}
      {hasActiveFilters ? (
        <button
          type="button"
          data-admin-clear-filters=""
          aria-label="مسح الفلاتر"
          onClick={clearFilters}
          className="h-10 cursor-pointer rounded-[10px] border border-white/10 px-4 text-sm font-semibold text-white/65 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/10 hover:text-[#F4E7C5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          مسح الفلاتر
        </button>
      ) : null}
      {trailing}
    </AdminFiltersShell>
  );
}
