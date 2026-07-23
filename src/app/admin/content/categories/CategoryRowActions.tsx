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
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import {
  duplicateCategoryAjax,
  toggleCategoryStatusAjax,
  type CategoryDuplicateMutationResult,
  type CategoryStatusMutationResult,
} from "./actions";

type CategoryRowActionsProps = {
  category: CategoryListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  isPending?: boolean;
  onToggle?: (
    category: CategoryListRow,
  ) => Promise<CategoryStatusMutationResult>;
  onDuplicate?: (
    category: CategoryListRow,
  ) => Promise<CategoryDuplicateMutationResult>;
  onDelete?: (
    categoryId: number,
    transferToId: number | null,
  ) => Promise<{ ok: boolean; message?: string }>;
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
  onMutationResult,
  isPending = false,
  onToggle,
  onDuplicate,
  onDelete,
}: CategoryRowActionsProps) {
  const [localPending, setLocalPending] = useState(false);
  const pending = isPending || localPending;
  const isActive = Boolean(category.is_active);
  const previewHref = category.slug
    ? `/topics?category=${encodeURIComponent(category.slug)}`
    : "/topics";

  async function toggleVisibility() {
    if (pending) return;
    setLocalPending(true);
    try {
      const result = await (onToggle
        ? onToggle(category)
        : toggleCategoryStatusAjax(category.id));
      onMutationResult?.(result);
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: category.id,
      });
    } finally {
      setLocalPending(false);
    }
  }

  async function duplicate() {
    if (pending) return;
    setLocalPending(true);
    try {
      const result = await (onDuplicate
        ? onDuplicate(category)
        : duplicateCategoryAjax(category.id));
      onMutationResult?.(result);
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر نسخ التصنيف",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: category.id,
      });
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <AdminDataGridActionsCell compact>
      <AdminDataGridActionButton
        action="edit"
        href={`/admin/content/categories/${category.id}`}
        size="compact"
        title="تعديل التصنيف"
      />

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

      <AdminDataGridActionButton
        type="button"
        action="duplicate"
        size="compact"
        title="نسخ التصنيف"
        pending={pending}
        disabled={pending}
        onClick={() => void duplicate()}
      />

      <CategoryDeleteButton
        categoryId={category.id}
        disabled={pending}
        onMutationResult={onMutationResult}
        onDelete={onDelete}
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
