"use client";

type SeriesOption = {
  id: number;
  name: string;
  slug: string;
};

type TopicSeriesFieldsProps = {
  options: SeriesOption[];
  defaultSeriesId?: number | string | null;
  defaultSeries?: string | null;
  defaultSeriesSlug?: string | null;
};

export default function TopicSeriesFields({
  options,
  defaultSeriesId = "",
  defaultSeries = "",
  defaultSeriesSlug = "",
}: TopicSeriesFieldsProps) {
  const defaultId = defaultSeriesId ? String(defaultSeriesId) : "";
  const fallbackSeries = defaultId ? null : defaultSeries;
  const fallbackSeriesSlug = defaultId ? null : defaultSeriesSlug;

  return (
    <label className="block lg:col-span-2">
      <span className="text-sm font-medium text-white/70">السلسلة</span>
      <select
        name="series_id"
        defaultValue={defaultId}
        className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
      >
        <option value="">بدون سلسلة</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {fallbackSeries ? <input type="hidden" name="legacy_series" value={fallbackSeries} /> : null}
      {fallbackSeriesSlug ? <input type="hidden" name="legacy_series_slug" value={fallbackSeriesSlug} /> : null}

      <p className="mt-2 text-xs text-white/35">
        يتم إنشاء السلاسل من صفحة السلاسل، ثم اختيارها هنا. اتركها فارغة لو الموضوع غير تابع لسلسلة.
      </p>
    </label>
  );
}
