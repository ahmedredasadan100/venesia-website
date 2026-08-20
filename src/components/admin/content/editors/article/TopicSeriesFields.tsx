"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterAdminContentSeriesByCategory,
  isAdminContentSeriesInCategory,
} from "../../../../../lib/admin/content/category-hierarchy";
import AdminFormListboxSelect from "../../../ui/AdminFormListboxSelect";
import { AdminFormError } from "../../../ui/AdminFormRuntime";

type SeriesOption = {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
};
type TopicSeriesFieldsProps = {
  options: SeriesOption[];
  defaultCategoryId?: number | string | null;
  defaultSeriesId?: number | string | null;
  defaultSeries?: string | null;
  defaultSeriesSlug?: string | null;
};

export default function TopicSeriesFields({
  options,
  defaultCategoryId = "",
  defaultSeriesId = "",
  defaultSeries = "",
  defaultSeriesSlug = "",
}: TopicSeriesFieldsProps) {
  const defaultId = defaultSeriesId ? String(defaultSeriesId) : "";
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId ? String(defaultCategoryId) : "",
  );
  const [value, setValue] = useState(defaultId);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackSeries = defaultId ? null : defaultSeries;
  const fallbackSeriesSlug = defaultId ? null : defaultSeriesSlug;
  const availableOptions = useMemo(
    () =>
      filterAdminContentSeriesByCategory(
        options,
        categoryId ? Number(categoryId) : null,
      ),
    [categoryId, options],
  );

  useEffect(() => {
    const categoryControl = containerRef.current
      ?.closest("form")
      ?.elements.namedItem("category_id");
    if (!(categoryControl instanceof HTMLSelectElement)) return;
    const categorySelect = categoryControl;

    function syncCategory() {
      const nextCategoryId = categorySelect.value;
      setCategoryId(nextCategoryId);

      const selectedSeries = options.find(
        (option) => String(option.id) === value,
      );
      if (
        value &&
        (!selectedSeries ||
          !isAdminContentSeriesInCategory(
            selectedSeries,
            nextCategoryId ? Number(nextCategoryId) : null,
          ))
      ) {
        setValue("");
      }
    }

    syncCategory();
    categorySelect.addEventListener("change", syncCategory);
    return () => categorySelect.removeEventListener("change", syncCategory);
  }, [options, value]);

  function update(next: string) {
    setValue(next);
  }

  return (
    <div
      ref={containerRef}
      className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5"
    >
      <span className="text-xs font-medium text-white/58">
        السلسلة (اختياري)
      </span>
      <AdminFormListboxSelect
        name="series_id"
        id="content-series-popover"
        focusTargetId="content-series-listbox"
        value={value}
        options={availableOptions.map((option) => ({
          value: String(option.id),
          label: option.name,
        }))}
        onChange={update}
        placeholder={categoryId ? "اختر السلسلة" : "اختر التصنيف أولًا"}
        showPlaceholderForEmptyValue
        allowEmptySelection
        disabled={!categoryId}
        sizing="wide"
        className="max-w-full"
      />
      <AdminFormError name="series_id" />
      {fallbackSeries ? (
        <input type="hidden" name="legacy_series" value={fallbackSeries} />
      ) : null}
      {fallbackSeriesSlug ? (
        <input
          type="hidden"
          name="legacy_series_slug"
          value={fallbackSeriesSlug}
        />
      ) : null}
    </div>
  );
}
