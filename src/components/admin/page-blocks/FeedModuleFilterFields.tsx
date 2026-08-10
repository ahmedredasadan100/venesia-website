"use client";

import { useMemo, useState } from "react";

import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import type { FeedModuleConfig } from "../../../lib/feed-modules/types";
import type { TopicFilterOptions } from "../../../lib/feed-modules/load-topic-filter-options";

type FeedModuleFilterFieldsProps = {
  config: FeedModuleConfig;
  filterOptions: TopicFilterOptions;
};

function getSeriesOptions(
  categorySlugs: readonly string[],
  seriesByCategorySlug: TopicFilterOptions["seriesByCategorySlug"],
) {
  const seen = new Set<number>();
  return categorySlugs.flatMap((categorySlug) =>
    (seriesByCategorySlug[categorySlug] ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

export default function FeedModuleFilterFields({ config, filterOptions }: FeedModuleFilterFieldsProps) {
  const [filters, setFilters] = useState(() => {
    const initialSeries = config.query.seriesSlug ?? "__all__";
    const initialSeriesOptions = getSeriesOptions(
      config.query.categorySlugs,
      filterOptions.seriesByCategorySlug,
    );
    const initialSeriesValid =
      initialSeries === "__all__" || initialSeriesOptions.some((item) => item.slug === initialSeries);

    return {
      categorySlugs: config.query.categorySlugs,
      seriesSlug: initialSeriesValid ? initialSeries : "__all__",
    };
  });
  const { categorySlugs, seriesSlug } = filters;

  const seriesOptions = useMemo(
    () => getSeriesOptions(categorySlugs, filterOptions.seriesByCategorySlug),
    [categorySlugs, filterOptions.seriesByCategorySlug],
  );

  const seriesDisabled = categorySlugs.length === 0;

  function toggleCategory(categorySlug: string, checked: boolean) {
    setFilters((current) => {
      const nextCategorySlugs = checked
        ? current.categorySlugs.includes(categorySlug)
          ? current.categorySlugs
          : [...current.categorySlugs, categorySlug]
        : current.categorySlugs.filter((slug) => slug !== categorySlug);
      const seriesStillAllowed =
        current.seriesSlug === "__all__" ||
        getSeriesOptions(nextCategorySlugs, filterOptions.seriesByCategorySlug)
          .some((item) => item.slug === current.seriesSlug);

      return {
        categorySlugs: nextCategorySlugs,
        seriesSlug: seriesStillAllowed ? current.seriesSlug : "__all__",
      };
    });
  }

  return (
    <AdminFormGrid>
      <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
        <legend className="px-1 text-sm font-medium text-white/70">تصفية حسب التصنيفات</legend>
        <p className="text-xs leading-5 text-white/40">
          اختر تصنيفًا أو أكثر. عدم اختيار أي تصنيف يعرض كل التصنيفات.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {filterOptions.categories.map((category) => (
            <AdminFormSwitch
              key={category.id}
              name="category_slugs"
              label={category.name}
              value={category.slug}
              checked={categorySlugs.includes(category.slug)}
              onChange={(event) => toggleCategory(category.slug, event.currentTarget.checked)}
              surface
            />
          ))}
        </div>
        {!filterOptions.categories.length ? (
          <p className="text-xs text-white/45">لا توجد تصنيفات منشورة متاحة.</p>
        ) : null}
      </fieldset>

      <div>
        {seriesDisabled ? <input type="hidden" name="series_slug" value="__all__" /> : null}
        <AdminFormListboxSelect
          name="series_slug"
          label="تصفية حسب السلسلة"
          value={seriesDisabled ? "__all__" : seriesSlug}
          onChange={(nextSeriesSlug) =>
            setFilters((current) => ({ ...current, seriesSlug: nextSeriesSlug }))
          }
          disabled={seriesDisabled}
          options={[
            { value: "__all__", label: "الكل" },
            ...seriesOptions.map((item) => ({ value: item.slug, label: item.name })),
          ]}
          hint={seriesDisabled
            ? "اختر تصنيفًا أولًا لعرض السلاسل التابعة له."
            : "يُحمَّل من Topics Series Admin ضمن التصنيف المختار."}
        />
      </div>
    </AdminFormGrid>
  );
}
