"use client";

import {
  AdminActivityPopover,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminEntityPreviewActions,
} from "../../../../components/admin/ui";
import { buildAdminCategoryCollectionPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import CategoryDeleteButton from "./CategoryDeleteButton";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import type {
  CategoryDuplicateMutationResult,
  CategoryStatusMutationResult,
} from "./actions";

type CategoryRowActionsProps = {
  category: CategoryListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  pendingAction?: string | null;
  onToggle: (
    category: CategoryListRow,
  ) => Promise<CategoryStatusMutationResult>;
  onDuplicate: (
    category: CategoryListRow,
  ) => Promise<CategoryDuplicateMutationResult>;
  onDelete: (
    categoryId: number,
    transferToId: number | null,
  ) => Promise<{ ok: boolean; message?: string }>;
};

export default function CategoryRowActions({
  category,
  onMutationResult,
  pendingAction = null,
  onToggle,
  onDuplicate,
  onDelete,
}: CategoryRowActionsProps) {
  const isActive = Boolean(category.is_active);
  const previewCapability = buildAdminCategoryCollectionPreviewCapability({
    id: category.id,
    slug: category.slug,
    isActive,
  });

  async function toggleVisibility() {
    try {
      const result = await onToggle(category);
      onMutationResult?.(result);
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: category.id,
      });
    }
  }

  async function duplicate() {
    try {
      const result = await onDuplicate(category);
      onMutationResult?.(result);
    } catch {
      onMutationResult?.({
        ok: false,
        title: "تعذر نسخ التصنيف",
        message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        entityId: category.id,
      });
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

      <AdminEntityPreviewActions
        capability={previewCapability}
        presentation="data-grid-compact"
      />

      <AdminDataGridActionButton
        action="visibility"
        size="compact"
        isCurrentlyHidden={!isActive}
        visibilityEntityLabel="التصنيف"
        pending={pendingAction === "visibility"}
        disabled={pendingAction === "visibility"}
        onClick={() => void toggleVisibility()}
      />

      <AdminDataGridActionButton
        type="button"
        action="duplicate"
        size="compact"
        title="نسخ التصنيف"
        pending={pendingAction === "duplicate"}
        disabled={pendingAction === "duplicate"}
        onClick={() => void duplicate()}
      />

      <CategoryDeleteButton
        categoryId={category.id}
        mutationPending={pendingAction === "delete"}
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
