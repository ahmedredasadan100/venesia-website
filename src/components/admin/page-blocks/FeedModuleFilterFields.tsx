"use client";

import { useMemo, useState } from "react";

import { AdminFormGrid, AdminFormListboxSelect } from "../ui";
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
    <AdminFormGrid>
      <AdminFormListboxSelect
          name="category_slug"
          label="تصفية حسب التصنيف"
          value={categorySlug}
          onChange={(nextCategory) => {
            setCategorySlug(nextCategory);
            setSeriesSlug("__all__");
          }}
          options={[
            { value: "__all__", label: "الكل" },
            ...filterOptions.categories.map((category) => ({ value: category.slug, label: category.name })),
          ]}
          hint="يُحمَّل من Topics Categories Admin."
      />

      <div>
        {seriesDisabled ? <input type="hidden" name="series_slug" value="__all__" /> : null}
        <AdminFormListboxSelect
          name="series_slug"
          label="تصفية حسب السلسلة"
          value={seriesDisabled ? "__all__" : seriesSlug}
          onChange={setSeriesSlug}
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
