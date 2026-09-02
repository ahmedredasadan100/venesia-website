"use client";

import { useMemo, useState } from "react";

import { AdminCheckbox, AdminFormSwitch } from "../ui";
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

function getInitialSeriesSlugs(
  config: FeedModuleConfig,
  filterOptions: TopicFilterOptions,
) {
  const initialSeriesOptions = getSeriesOptions(
    config.query.categorySlugs,
    filterOptions.seriesByCategorySlug,
  );
  const allowedSlugs = new Set(initialSeriesOptions.map((item) => item.slug));
  return config.query.seriesSlugs.filter((slug) => allowedSlugs.has(slug));
}

export default function FeedModuleFilterFields({ config, filterOptions }: FeedModuleFilterFieldsProps) {
  const [filters, setFilters] = useState(() => ({
    categorySlugs: config.query.categorySlugs,
    seriesSlugs: getInitialSeriesSlugs(config, filterOptions),
  }));
  const { categorySlugs, seriesSlugs } = filters;

  const seriesOptions = useMemo(
    () => getSeriesOptions(categorySlugs, filterOptions.seriesByCategorySlug),
    [categorySlugs, filterOptions.seriesByCategorySlug],
  );

  function toggleCategory(categorySlug: string, checked: boolean) {
    setFilters((current) => {
      const nextCategorySlugs = checked
        ? current.categorySlugs.includes(categorySlug)
          ? current.categorySlugs
          : [...current.categorySlugs, categorySlug]
        : current.categorySlugs.filter((slug) => slug !== categorySlug);
      const allowedSeriesSlugs = new Set(
        getSeriesOptions(nextCategorySlugs, filterOptions.seriesByCategorySlug)
          .map((item) => item.slug),
      );

      return {
        categorySlugs: nextCategorySlugs,
        seriesSlugs: current.seriesSlugs.filter((slug) => allowedSeriesSlugs.has(slug)),
      };
    });
  }

  function toggleSeries(seriesSlug: string) {
    setFilters((current) => ({
      ...current,
      seriesSlugs: current.seriesSlugs.includes(seriesSlug)
        ? current.seriesSlugs.filter((slug) => slug !== seriesSlug)
        : [...current.seriesSlugs, seriesSlug],
    }));
  }

  return (
    <section
      aria-labelledby="feed-content-scope-title"
      data-feed-content-scope=""
      className="space-y-5 rounded-3xl border border-white/10 bg-[#05070B]/72 p-5 md:p-6"
    >
      <h3 id="feed-content-scope-title" className="text-lg font-semibold text-[#E5C98F]">
        نطاق المحتوى
      </h3>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:p-5">
        <h4 className="border-r-2 border-[#D5A640] pr-3 text-sm font-semibold text-white">
          التصنيفات
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:p-5">
        <h4 className="border-r-2 border-[#D5A640] pr-3 text-sm font-semibold text-white">
          السلاسل
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition focus-within:ring-2 focus-within:ring-[#E2B84F] ${
              seriesSlugs.length === 0
                ? "border-[#D5A640] bg-[#D5A640]/15 text-[#F1D49A]"
                : "border-white/15 bg-white/[0.025] text-white/70 hover:border-white/25 hover:text-white"
            }`}
          >
            <AdminCheckbox
              label="كل السلاسل"
              presentation="native"
              data-feed-series-all=""
              checked={seriesSlugs.length === 0}
              onChange={() => setFilters((current) => ({ ...current, seriesSlugs: [] }))}
              className="sr-only"
            />
            {seriesSlugs.length === 0 ? <span aria-hidden="true">✓</span> : null}
            <span>كل السلاسل</span>
          </label>

          {seriesOptions.map((series) => {
            const selected = seriesSlugs.includes(series.slug);

            return (
              <label
                key={series.id}
                className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition focus-within:ring-2 focus-within:ring-[#E2B84F] ${
                  selected
                    ? "border-[#D5A640] bg-[#D5A640]/15 text-[#F1D49A]"
                    : "border-white/15 bg-white/[0.025] text-white/70 hover:border-white/25 hover:text-white"
                }`}
              >
                <AdminCheckbox
                  label={series.name}
                  presentation="native"
                  name="series_slugs"
                  data-feed-series-option={series.slug}
                  value={series.slug}
                  checked={selected}
                  onChange={(event) => toggleSeries(event.currentTarget.value)}
                  className="sr-only"
                />
                {selected ? <span aria-hidden="true">✓</span> : null}
                <span>{series.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
