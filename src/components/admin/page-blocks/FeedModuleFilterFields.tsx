"use client";

import { useMemo, useState } from "react";

import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { FeedModuleConfig } from "../../../lib/feed-modules/types";
import type { TopicFilterOptions } from "../../../lib/feed-modules/load-topic-filter-options";

type FeedModuleFilterFieldsProps = {
  config: FeedModuleConfig;
  filterOptions: TopicFilterOptions;
};

export default function FeedModuleFilterFields({ config, filterOptions }: FeedModuleFilterFieldsProps) {
  const initialCategory = config.query.categorySlug ?? "__all__";
  const initialSeries = config.query.seriesSlug ?? "__all__";

  const [categorySlug, setCategorySlug] = useState(initialCategory);

  const seriesOptions = useMemo(() => {
    if (categorySlug === "__all__") return [];
    return filterOptions.seriesByCategorySlug[categorySlug] ?? [];
  }, [categorySlug, filterOptions.seriesByCategorySlug]);

  const initialSeriesValid =
    initialCategory === "__all__"
      ? initialSeries === "__all__"
      : initialSeries === "__all__" || seriesOptions.some((item) => item.slug === initialSeries);

  const [seriesSlug, setSeriesSlug] = useState(initialSeriesValid ? initialSeries : "__all__");

  const seriesDisabled = categorySlug === "__all__";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">Category Filter</span>
        <select
          name="category_slug"
          value={categorySlug}
          onChange={(event) => {
            const nextCategory = event.target.value;
            setCategorySlug(nextCategory);
            setSeriesSlug("__all__");
          }}
          className={fieldClassName()}
        >
          <option value="__all__">All</option>
          {filterOptions.categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-xs leading-6 text-white/42">يُحمَّل من Topics Categories Admin.</p>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">Series Filter</span>
        {seriesDisabled ? <input type="hidden" name="series_slug" value="__all__" /> : null}
        <select
          name={seriesDisabled ? undefined : "series_slug"}
          value={seriesDisabled ? "__all__" : seriesSlug}
          onChange={(event) => setSeriesSlug(event.target.value)}
          disabled={seriesDisabled}
          className={fieldClassName(seriesDisabled ? "cursor-not-allowed opacity-60" : "")}
        >
          <option value="__all__">All</option>
          {seriesOptions.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="text-xs leading-6 text-white/42">
          {seriesDisabled
            ? "اختر تصنيفًا أولًا لعرض السلاسل التابعة له."
            : "يُحمَّل من Topics Series Admin ضمن التصنيف المختار."}
        </p>
      </label>
    </div>
  );
}
