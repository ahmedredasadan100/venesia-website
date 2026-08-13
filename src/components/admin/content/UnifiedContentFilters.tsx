"use client";

import { useMemo } from "react";

import {
  toAdminCategoryFilterOptions,
  type AdminContentCategoryNode,
} from "../../../lib/admin/content/category-hierarchy";
import { CONTENT_TYPE_OPTIONS } from "../../../lib/admin/content/content-types";
import type {
  AdminEntityFilterDef,
  AdminEntitySearchSuggestion,
} from "../../../lib/admin/entity-list";
import type { AdminEntityListFiltersProps } from "../entity-list/AdminEntityListFilters";

type SeriesOption = {
  id: number;
  name: string;
  status: string;
  deleted_at: string | null;
};

export type UnifiedContentFilterState = {
  q: string;
  view: "active" | "trash";
  contentType: string;
  category: string;
  series: string;
  status: string;
  featured: string;
  image: string;
};

const BASE_PATH = "/admin/content/topics";

/**
 * Thin Topics adapter for the shared Collection toolbar owner. It declares
 * domain labels/options and maps the generic URL patch back to Topic filters;
 * it deliberately owns no search, modal, draft, chip, or suggestion lifecycle.
 */
export function useUnifiedContentToolbar({
  values,
  categories,
  series,
  onQueryPatch,
}: {
  values: UnifiedContentFilterState;
  categories: AdminContentCategoryNode[];
  series: SeriesOption[];
  onQueryPatch: NonNullable<AdminEntityListFiltersProps["onQueryPatch"]>;
}): AdminEntityListFiltersProps {
  const categoryOptions = useMemo(
    () => toAdminCategoryFilterOptions(categories),
    [categories],
  );
  const seriesOptions = useMemo(
    () =>
      series
        .filter((item) => item.status === "published" && !item.deleted_at)
        .map((item) => ({ value: String(item.id), label: item.name }))
        .concat([{ value: "any", label: "مرتبط بأي سلسلة" }]),
    [series],
  );
  const filters = useMemo<AdminEntityFilterDef[]>(
    () => [
      {
        id: "content-type",
        paramKey: "content_type",
        label: "نوع المحتوى",
        placeholder: "نوع المحتوى",
        type: "status",
        options: CONTENT_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
      {
        id: "category",
        paramKey: "category",
        label: "التصنيف",
        placeholder: "التصنيف",
        type: "hierarchical_entity_select",
        searchable: true,
        options: categoryOptions,
      },
      {
        id: "series",
        paramKey: "series",
        label: "السلسلة",
        placeholder: "السلسلة",
        type: "entity_select",
        searchable: true,
        options: seriesOptions,
      },
      {
        id: "status",
        paramKey: "status",
        label: "الحالة",
        placeholder: "الحالة",
        type: "status",
        options: [
          { value: "published", label: "منشور" },
          { value: "unpublished", label: "غير منشور" },
        ],
      },
      {
        id: "image",
        paramKey: "image",
        label: "الصورة",
        placeholder: "الصورة",
        type: "boolean",
        options: [{ value: "without", label: "بدون صورة" }],
      },
      {
        id: "featured",
        paramKey: "featured",
        label: "التمييز",
        placeholder: "التمييز",
        type: "boolean",
        options: [
          { value: "yes", label: "مميز" },
          { value: "no", label: "غير مميز" },
        ],
      },
    ],
    [categoryOptions, seriesOptions],
  );
  const suggestions = useMemo(
    () => ({
      enabled: true,
      minLength: 2,
      maxResults: 8,
      selectionAction: "set_query" as const,
      async load(query: string, { signal }: { signal: AbortSignal }) {
        const response = await fetch(
          `${BASE_PATH}/search?q=${encodeURIComponent(query)}${values.view === "trash" ? "&view=trash" : ""}`,
          { signal, headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error("تعذر تحميل اقتراحات الموضوعات.");
        const payload = (await response.json()) as {
          results?: Array<{
            id: number;
            title: string;
            category_name: string | null;
          }>;
        };
        return (payload.results ?? []).map(
          (item): AdminEntitySearchSuggestion => ({
            id: item.id,
            primaryText: item.title,
            secondaryText: item.category_name || "غير مصنف",
            searchValue: item.title,
          }),
        );
      },
    }),
    [values.view],
  );

  return {
    basePath: BASE_PATH,
    hash: "#content-topics-table",
    preserveParams: ["sort", "limit", "view"],
    search: {
      placeholder: "ابحث في الموضوعات",
      value: values.q,
      minLength: 2,
      debounceMs: 350,
      suggestions,
    },
    filters,
    values: {
      content_type: values.contentType,
      category: values.category,
      series: values.series,
      status: values.status,
      featured: values.featured,
      image: values.image,
    },
    clearableFilterKeys: [
      "content_type",
      "category",
      "series",
      "status",
      "featured",
      "image",
    ],
    onQueryPatch,
  };
}
