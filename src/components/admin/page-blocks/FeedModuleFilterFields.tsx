"use client";

import { useMemo, useState } from "react";

import { ADMIN_FORM_STACK_CLASS_NAME, AdminCheckbox, AdminFormGrid, AdminFormSwitch } from "../ui";
import { AdminModuleSectionHeader } from "../ui/AdminModuleTabs";
import { ModuleEditorSection } from "./ModuleEditorPresentation";
import { adminChoiceButtonClassName } from "../../../lib/admin/admin-ui-styles";
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
    <div data-feed-content-scope="" className={ADMIN_FORM_STACK_CLASS_NAME}>

      <ModuleEditorSection header={<AdminModuleSectionHeader id="feed-filter-categories" sectionHeading="التصنيفات" icon="section" standalone={false} />}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <AdminFormGrid columns={4}>
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
        </AdminFormGrid>
        {!filterOptions.categories.length ? (
          <p className="text-xs text-white/45">لا توجد تصنيفات منشورة متاحة.</p>
        ) : null}
        </div>
      </ModuleEditorSection>

      <ModuleEditorSection header={<AdminModuleSectionHeader id="feed-filter-series" sectionHeading="السلاسل" icon="section" standalone={false} />}>
        <AdminFormGrid columns={4}>
          <label
            className={adminChoiceButtonClassName(seriesSlugs.length === 0, "gap-2 focus-within:ring-2 focus-within:ring-[#D8B87A]/70")}
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
                className={adminChoiceButtonClassName(selected, "gap-2 focus-within:ring-2 focus-within:ring-[#D8B87A]/70")}
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
        </AdminFormGrid>
      </ModuleEditorSection>
    </div>
  );
}
