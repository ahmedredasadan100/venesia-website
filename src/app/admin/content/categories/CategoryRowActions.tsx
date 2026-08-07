"use client";

import { useRef, useState } from "react";

import {
  AdminDataGridRowActions,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { buildAdminCategoryCollectionPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import { resolveAdminEntityPreviewActions } from "../../../../lib/admin/interaction-system/entity-preview-capability";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import CategoryDeleteButton from "./CategoryDeleteButton";
import type {
  CategoryDuplicateMutationResult,
  CategoryStatusMutationResult,
} from "./actions";

type CategoryRowActionsProps = {
  category: CategoryListRow;
  onMutationResult?: (result: AdminActionResult) => void;
  pendingAction?: string | null;
  mutationBusy: boolean;
  onToggle: (
    category: CategoryListRow,
  ) => Promise<CategoryStatusMutationResult>;
  onDuplicate: (
    category: CategoryListRow,
  ) => Promise<CategoryDuplicateMutationResult>;
  onDelete: (
    categoryId: number,
    transferToId: number | null,
  ) => Promise<{
    ok: boolean;
    message?: string;
    feedbackStatus?: "success" | "warning";
  }>;
};

export default function CategoryRowActions({
  category,
  onMutationResult,
  pendingAction = null,
  mutationBusy,
  onToggle,
  onDuplicate,
  onDelete,
}: CategoryRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const isActive = category.status === "published";
  const previewCapability = buildAdminCategoryCollectionPreviewCapability({
    id: category.id,
    slug: category.slug,
    isActive,
  });
  const preview = resolveAdminEntityPreviewActions(previewCapability)[0];

  async function publishResult(
    action: () => Promise<AdminActionResult>,
    fallbackTitle: string,
    fallbackMessage: string,
  ) {
    try {
      const result = await action();
      onMutationResult?.(result);
    } catch (error) {
      const result: AdminActionResult = {
        ok: false,
        title: fallbackTitle,
        message: error instanceof Error ? error.message : fallbackMessage,
        entityId: category.id,
      };
      onMutationResult?.(result);
    }
  }

  const pendingReason = "انتظر انتهاء الإجراء الحالي.";
  const capability: AdminRowActionsCapability = {
    entityType: "category",
    entityId: category.id,
    entityLabel: category.name,
    actions: {
      edit: {
        access: "allowed",
        href: `/admin/content/categories/${category.id}`,
      },
      preview: preview
        ? preview.disabled
          ? {
              access: "disabled",
              disabledReason: "المعاينة غير متاحة لهذا التصنيف.",
            }
          : {
              access: "allowed",
              href: preview.href,
              target: "_blank",
              rel: "noopener noreferrer",
            }
        : { access: "hidden" },
      information: {
        access: "allowed",
        title: `معلومات التصنيف: ${category.name}`,
        items: [
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
          { label: "الموضوعات", value: String(category.totalCount) },
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility:
        pendingAction === "visibility"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isVisible: isActive,
            }
          : mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
                isVisible: isActive,
              }
            : {
                access: "allowed",
                isVisible: isActive,
                onSelect: () =>
                  publishResult(
                    () => onToggle(category),
                    "تعذر تنفيذ العملية",
                    "تعذر تحديث حالة التصنيف.",
                  ),
              },
      featured: { access: "hidden" },
      duplicate:
        pendingAction === "duplicate"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : mutationBusy
            ? { access: "disabled", disabledReason: pendingReason }
            : {
                access: "allowed",
                onSelect: () =>
                  publishResult(
                    () => onDuplicate(category),
                    "تعذر نسخ التصنيف",
                    "تعذر نسخ التصنيف.",
                  ),
              },
      archive: { access: "hidden" },
      delete:
        pendingAction === "delete"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : mutationBusy
            ? { access: "disabled", disabledReason: pendingReason }
            : {
                access: "allowed",
                confirmation: {
                  mode: "delegated",
                  owner: "confirmation_runtime",
                },
                onSelect: () => setDeleteOpen(true),
              },
    },
  };

  return (
    <>
      <AdminDataGridRowActions
        capability={capability}
        size="compact"
        moreButtonRef={moreButtonRef}
      />
      <CategoryDeleteButton
        categoryId={category.id}
        open={deleteOpen}
        mutationPending={pendingAction === "delete"}
        returnFocusRef={moreButtonRef}
        onOpenChange={setDeleteOpen}
        onMutationResult={onMutationResult}
        onDelete={onDelete}
      />
    </>
  );
}
