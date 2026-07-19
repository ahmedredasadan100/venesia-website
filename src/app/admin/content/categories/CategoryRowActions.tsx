"use client";

import { useState } from "react";

import {
  ADMIN_DATA_GRID_RULES,
  AdminActivityPopover,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
} from "../../../../components/admin/ui";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import CategoryDeleteButton from "./CategoryDeleteButton";
import CategoryEditModal from "./CategoryEditModal";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { duplicateCategory, toggleCategoryStatusAjax } from "./actions";

type CategoryRowActionsProps = {
  category: CategoryListRow;
  parentOptions: Array<{ id: number; name: string; level: number }>;
  onMutationResult?: (result: AdminActionResult) => void;
  onCategoryUpdated?: (category: CategoryListRow) => void;
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

export default function CategoryRowActions({
  category,
  parentOptions,
  onMutationResult,
  onCategoryUpdated,
}: CategoryRowActionsProps) {
  const [pending, setPending] = useState(false);
  const isActive = Boolean(category.is_active);
  const previewHref = category.slug
    ? `/topics?category=${encodeURIComponent(category.slug)}`
    : "/topics";

  async function toggleVisibility() {
    if (pending) return;
    setPending(true);
    try {
      const result = await toggleCategoryStatusAjax(category.id);
      if (result.ok && typeof result.isActive === "boolean") {
        onCategoryUpdated?.({
          ...category,
          is_active: result.isActive,
          status: result.status ?? (result.isActive ? "published" : "draft"),
          updated_at: result.updatedAt ?? category.updated_at,
        });
      }
      onMutationResult?.(result);
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: category.id,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminDataGridActionsCell compact>
      <CategoryEditModal category={category} parentOptions={parentOptions} />

      <AdminDataGridActionButton
        href={previewHref}
        target="_blank"
        rel="noreferrer"
        tone="dark"
        size="compact"
        title="معاينة الموضوعات في الموقع"
        action="preview"
      >
        <PublicPreviewIcon />
      </AdminDataGridActionButton>

      <AdminDataGridActionButton
        action="visibility"
        size="compact"
        isCurrentlyHidden={!isActive}
        title={isActive ? "إخفاء التصنيف" : "إظهار التصنيف"}
        pending={pending}
        disabled={pending}
        onClick={() => void toggleVisibility()}
      />

      <form action={duplicateCategory} className="contents">
        <input type="hidden" name="id" value={category.id} />
        <AdminDataGridActionButton
          type="submit"
          action="duplicate"
          size="compact"
          title="نسخ التصنيف"
        />
      </form>

      <CategoryDeleteButton
        categoryId={category.id}
        onMutationResult={onMutationResult}
      />

      <AdminActivityPopover
        title={`نشاط التصنيف: ${category.name}`}
        triggerLabel="معلومات النشاط"
        items={[
          {
            label: "تاريخ الإنشاء",
            value: category.created_at
              ? formatAdminDateTime(category.created_at)
              : "—",
          },
          {
            label: "آخر تعديل",
            value: category.updated_at
              ? formatAdminDateTime(category.updated_at)
              : "—",
          },
          {
            label: "التصنيف الأب",
            value: category.parent_name?.trim() || "—",
          },
          {
            label: "الموضوعات",
            value: String(category.totalCount),
          },
        ]}
      />
    </AdminDataGridActionsCell>
  );
}
