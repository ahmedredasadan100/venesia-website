"use client";

import { useRef, useState } from "react";
import AdminListboxSelect from "../../ui/AdminListboxSelect";
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
  const [value, setValue] = useState(initialValue);
  const selectRef = useRef<HTMLSelectElement>(null);
  const options = categories.map((category) => ({
    value: String(category.id),
    label: `${"— ".repeat(category.depth)}${category.name}`,
    disabled:
      category.is_active === false && String(category.id) !== initialValue,
  }));

  function update(next: string) {
    setValue(next);
    window.requestAnimationFrame(() =>
      selectRef.current?.dispatchEvent(new Event("change", { bubbles: true })),
    );
  }

  return (
    <div>
      <select
        ref={selectRef}
        name="category_id"
        value={value}
        required
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => setValue(event.currentTarget.value)}
        className="sr-only"
      >
        <option value="">اختر التصنيف</option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <AdminListboxSelect
        id="content-category-popover"
        triggerId="content-category-listbox"
        value={value}
        options={options}
        onChange={update}
        placeholder="اختر التصنيف"
        sizing="medium"
        className="max-w-full"
      />
      <AdminFormError name="category_id" />
    </div>
  );
}
