"use client";

import { useRef, useState } from "react";
import type { ArticleTopicCategoryGroup } from "../../../../../lib/admin/article-topic-categories";
import AdminListboxSelect from "../../../ui/AdminListboxSelect";
import { AdminFormError } from "../../../ui/AdminFormRuntime";

type ArticleTopicCategorySelectProps = {
  groups: ArticleTopicCategoryGroup[];
  defaultValue?: string;
  name?: string;
  required?: boolean;
  className?: string;
};

export default function ArticleTopicCategorySelect({ groups, defaultValue = "", name = "category_slug", required = true, className = "" }: ArticleTopicCategorySelectProps) {
  const [value, setValue] = useState(defaultValue);
  const selectRef = useRef<HTMLSelectElement>(null);
  const options = groups.flatMap((group) => group.options.map((option) => ({ value: option.slug, label: option.name.replace(/^—\s*/, ""), depth: option.name.startsWith("— ") ? 1 : 0 })));

  function update(next: string) {
    setValue(next);
    window.requestAnimationFrame(() => selectRef.current?.dispatchEvent(new Event("change", { bubbles: true })));
  }

  return (
    <div className={className}>
      <select
        ref={selectRef}
        name={name}
        value={value}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => setValue(event.currentTarget.value)}
        className="sr-only"
      >
        <option value="">اختر التصنيف</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <AdminListboxSelect
        id="topic-category-popover"
        triggerId="topic-category-listbox"
        value={value}
        options={options}
        onChange={update}
        placeholder="اختر التصنيف"
        sizing="medium"
        className="max-w-full"
      />
      <AdminFormError name={name} />
    </div>
  );
}
