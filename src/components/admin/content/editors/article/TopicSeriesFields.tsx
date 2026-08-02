"use client";

import { useRef, useState } from "react";
import AdminListboxSelect from "../../../ui/AdminListboxSelect";
import { AdminFormError } from "../../../ui/AdminFormRuntime";

type SeriesOption = { id: number; name: string; slug: string };
type TopicSeriesFieldsProps = {
  options: SeriesOption[];
  defaultSeriesId?: number | string | null;
  defaultSeries?: string | null;
  defaultSeriesSlug?: string | null;
};

export default function TopicSeriesFields({ options, defaultSeriesId = "", defaultSeries = "", defaultSeriesSlug = "" }: TopicSeriesFieldsProps) {
  const defaultId = defaultSeriesId ? String(defaultSeriesId) : "";
  const [value, setValue] = useState(defaultId);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fallbackSeries = defaultId ? null : defaultSeries;
  const fallbackSeriesSlug = defaultId ? null : defaultSeriesSlug;

  function update(next: string) {
    setValue(next);
    window.requestAnimationFrame(() => hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true })));
  }

  return (
    <label className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5">
      <span className="text-xs font-medium text-white/58">السلسلة (اختياري)</span>
      <input ref={hiddenRef} type="hidden" name="series_id" value={value} />
      <AdminListboxSelect
        id="topic-series-popover"
        triggerId="topic-series-listbox"
        value={value}
        options={[{ value: "", label: "بدون سلسلة" }, ...options.map((option) => ({ value: String(option.id), label: option.name }))]}
        onChange={update}
        placeholder="اختر السلسلة"
        showPlaceholderForEmptyValue
        sizing="wide"
        className="max-w-full"
      />
      <AdminFormError name="series_id" />
      {fallbackSeries ? <input type="hidden" name="legacy_series" value={fallbackSeries} /> : null}
      {fallbackSeriesSlug ? <input type="hidden" name="legacy_series_slug" value={fallbackSeriesSlug} /> : null}
    </label>
  );
}
