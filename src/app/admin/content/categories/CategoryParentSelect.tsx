"use client";

import { AdminFormSelect } from "../../../../components/admin/ui/AdminSelect";

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
    <AdminFormSelect
      name="parent_id"
      defaultValue={defaultValue ? String(defaultValue) : ""}
      dir="rtl"
      className="w-full"
    >
      <option value="">بدون تصنيف أب</option>
      {filtered.map((option) => (
        <option key={option.id} value={option.id}>
          {`${"— ".repeat(option.level)}${option.name}`}
        </option>
      ))}
    </AdminFormSelect>
  );
}
