"use client";

import {
  ADMIN_DATA_GRID_RULES,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
} from "../../../../components/admin/ui";
import CategoryDeleteButton from "./CategoryDeleteButton";
import CategoryEditModal from "./CategoryEditModal";
import { duplicateCategory, toggleCategoryStatus } from "./actions";

type CategoryRowActionsProps = {
  category: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    sort_order: number | null;
    is_active: boolean | null;
  };
  parentOptions: Array<{ id: number; name: string; level: number }>;
};

function PublicPreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={ADMIN_DATA_GRID_RULES.actionIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export default function CategoryRowActions({ category, parentOptions }: CategoryRowActionsProps) {
  const isActive = Boolean(category.is_active);
  const previewHref = category.slug ? `/topics?category=${encodeURIComponent(category.slug)}` : "/topics";

  return (
    <AdminDataGridActionsCell compact>
      <CategoryEditModal category={category} parentOptions={parentOptions} />

      <AdminDataGridActionButton
        href={previewHref}
        target="_blank"
        tone="dark"
        size="compact"
        title="معاينة الموضوعات في الموقع"
      >
        <PublicPreviewIcon />
      </AdminDataGridActionButton>

      <form action={toggleCategoryStatus} className="contents">
        <input type="hidden" name="id" value={category.id} />
        <AdminDataGridActionButton
          type="submit"
          action="visibility"
          size="compact"
          hidden={isActive}
          title={isActive ? "إخفاء التصنيف" : "إظهار التصنيف"}
        />
      </form>

      <form action={duplicateCategory} className="contents">
        <input type="hidden" name="id" value={category.id} />
        <AdminDataGridActionButton type="submit" action="duplicate" size="compact" title="نسخ التصنيف" />
      </form>

      <CategoryDeleteButton categoryId={category.id} />
    </AdminDataGridActionsCell>
  );
}
