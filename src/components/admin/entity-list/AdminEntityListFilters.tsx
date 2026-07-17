"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

  if (ownsSearch && search.value !== lastExternalSearch) {
    setLastExternalSearch(search.value);
    setDraftSearch(search.value);
  }

  function navigate(patch: Record<string, string | null>) {
    const current = new URLSearchParams(searchParams.toString());
    preserveParams.forEach((key) => {
      if (!(key in patch) && current.has(key)) {
        patch[key] = current.get(key);
      }
    });
    const href = buildAdminEntityListHref(basePath, current, patch, hash);
    router.push(href, { scroll: false });
    setOpenLayerId(null);
  }

  useEffect(() => {
    if (!ownsSearch) return;
    const trimmed = draftSearch.trim();
    const committed = search.value.trim();
    if (trimmed === committed) return;
    if (trimmed.length > 0 && trimmed.length < minLength) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
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
        const value = values[filter.paramKey] ?? allValue;
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
    // values + openLayer drive display; navigate closes via setOpenLayerId
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, values, openLayerId, mounted],
  );

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
      {trailing}
    </AdminFiltersShell>
  );
}
