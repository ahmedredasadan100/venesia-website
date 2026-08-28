"use client";

import AdminFormListboxSelect from "../../ui/AdminFormListboxSelect";
import { AdminFormError } from "../../ui/AdminFormRuntime";

export type ContentEditorCategoryOption = {
  id: number;
  name: string;
  depth: number;
  is_active: boolean | null;
};

export default function ContentCategorySelect({
  categories,
  defaultValue,
}: {
  categories: ContentEditorCategoryOption[];
  defaultValue?: number | null;
}) {
  const initialValue = defaultValue ? String(defaultValue) : "";
  const options = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
    depth: category.depth,
    disabled:
      category.is_active === false && String(category.id) !== initialValue,
  }));

  return (
    <div>
      <AdminFormListboxSelect
        name="category_id"
        id="content-category-popover"
        focusTargetId="content-category-listbox"
        defaultValue={initialValue}
        options={options}
        required
        placeholder="اختر التصنيف"
        sizing="medium"
        className="max-w-full"
      />
      <AdminFormError name="category_id" />
    </div>
  );
}
