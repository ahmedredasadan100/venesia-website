"use client";

type CategoryParentSelectProps = {
  options: Array<{ id: number; name: string; level: number }>;
  defaultValue?: number | null;
  excludeId?: number;
};

export default function CategoryParentSelect({
  options,
  defaultValue,
  excludeId,
}: CategoryParentSelectProps) {
  const filtered = options.filter((option) => option.id !== excludeId);

  return (
    <select
      name="parent_id"
      defaultValue={defaultValue ? String(defaultValue) : ""}
      dir="rtl"
      className="w-full min-h-11 rounded-2xl border border-white/10 bg-[#070A0F] px-4 py-3 text-right text-sm text-white/75 outline-none focus:border-[#D8B87A]/45"
    >
      <option value="">بدون تصنيف أب</option>
      {filtered.map((option) => (
        <option key={option.id} value={option.id}>
          {`${"— ".repeat(option.level)}${option.name}`}
        </option>
      ))}
    </select>
  );
}
