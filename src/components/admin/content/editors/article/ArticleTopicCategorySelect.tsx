"use client";

import type { ArticleTopicCategoryGroup } from "../../../../../lib/admin/article-topic-categories";

type ArticleTopicCategorySelectProps = {
  groups: ArticleTopicCategoryGroup[];
  defaultValue?: string;
  name?: string;
  required?: boolean;
  className?: string;
};

export default function ArticleTopicCategorySelect({
  groups,
  defaultValue = "",
  name = "category_slug",
  required = true,
  className = "mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45",
}: ArticleTopicCategorySelectProps) {
  return (
    <select name={name} required={required} defaultValue={defaultValue} className={className}>
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
  );
}
