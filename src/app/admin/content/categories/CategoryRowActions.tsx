"use client";

import {
  AdminDataGridRowActions,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { buildAdminCategoryCollectionPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import type { CategoryListRow } from "../../../../lib/admin/content/load-categories-list";
import type { AdminInstantMutationRowInteraction } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { resolveAdminEntityPreviewActions } from "../../../../lib/admin/interaction-system/entity-preview-capability";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import type {
  CategoryDuplicateMutationResult,
  CategoryStatusMutationResult,
} from "./actions";

type CategoryRowActionsProps = {
  category: CategoryListRow;
  view: "active" | "trash";
  onMutationResult?: (result: AdminActionResult) => void;
  interaction: AdminInstantMutationRowInteraction;
  onToggle: (
    category: CategoryListRow,
  ) => Promise<CategoryStatusMutationResult>;
  onDuplicate: (
    category: CategoryListRow,
  ) => Promise<CategoryDuplicateMutationResult>;
  onDelete: (category: CategoryListRow) => Promise<AdminActionResult>;
  onRestore: (category: CategoryListRow) => Promise<AdminActionResult>;
  onPermanentDelete: (category: CategoryListRow) => Promise<AdminActionResult>;
  display?: "menu" | "visibility";
};

export default function CategoryRowActions({
  category,
  view,
  onMutationResult,
  interaction,
  onToggle,
  onDuplicate,
  onDelete,
  onRestore,
  onPermanentDelete,
  display = "menu",
}: CategoryRowActionsProps) {
  const pendingAction = interaction.pendingAction;
  const isTrashView = view === "trash";
  const isActive = category.status === "published";
  const previewCapability = buildAdminCategoryCollectionPreviewCapability({
    id: category.id,
    slug: category.slug,
    isActive,
  });
  const preview = resolveAdminEntityPreviewActions(previewCapability)[0];

  async function publishResult(action: () => Promise<AdminActionResult>) {
    try {
      const result = await action();
      onMutationResult?.(result);
      return result;
    } catch (error) {
      const result: AdminActionResult = {
        ok: false,
        title: "تعذر تنفيذ العملية",
        message: error instanceof Error ? error.message : "حدث خطأ غير متوقع.",
        entityId: category.id,
      };
      onMutationResult?.(result);
      return result;
    }
  }

  const pendingReason = "انتظر انتهاء الإجراء الحالي.";
  const capability: AdminRowActionsCapability = {
    entityType: "category",
    entityId: category.id,
    entityLabel: category.name,
    actions: {
      edit: isTrashView
        ? { access: "hidden" }
        : {
            access: "allowed",
            href: `/admin/content/categories/${category.id}`,
          },
      preview: isTrashView
        ? { access: "hidden" }
        : preview
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
          ...(isTrashView
            ? [
                {
                  label: "تاريخ الحذف",
                  value: category.deleted_at
                    ? formatAdminDateTime(category.deleted_at)
                    : "—",
                },
              ]
            : []),
          { label: "التصنيف الأب", value: category.parent_name?.trim() || "—" },
          { label: "الموضوعات", value: String(category.totalCount) },
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: isTrashView
        ? display === "visibility"
          ? {
              access: "disabled",
              disabledReason: "عرض فقط داخل المحذوفات.",
              isVisible: isActive,
            }
          : { access: "hidden" }
        : pendingAction === "visibility"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isVisible: isActive,
            }
          : {
              access: "allowed",
              isVisible: isActive,
              onSelect: async () => {
                await publishResult(() => onToggle(category));
              },
            },
      featured: { access: "hidden" },
      duplicate: isTrashView
        ? { access: "hidden" }
        : pendingAction === "duplicate"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : {
              access: "allowed",
              onSelect: async () => {
                await publishResult(() => onDuplicate(category));
              },
            },
      archive: !isTrashView
        ? { access: "hidden" }
        : pendingAction === "restore"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isArchived: true,
              label: "استعادة",
            }
          : {
              access: "allowed",
              isArchived: true,
              label: "استعادة",
              confirmation: {
                mode: "shared",
                title: "استعادة التصنيف؟",
                description:
                  "سيعود التصنيف إلى القائمة النشطة كغير منشور بعد التحقق من الـSlug والتصنيف الأب.",
                confirmLabel: "استعادة",
              },
              onSelect: async () => {
                const result = await publishResult(() => onRestore(category));
                if (!result.ok) throw new Error(result.message);
              },
            },
      delete:
        pendingAction === (isTrashView ? "permanent_delete" : "delete")
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات",
            }
          : {
              access: "allowed",
              label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات",
              confirmation: isTrashView
                ? {
                    mode: "shared",
                    title: "حذف التصنيف نهائيًا؟",
                    description:
                      "سيُحذف التصنيف نهائيًا ويصبح الـSlug متاحًا. أي علاقة قائمة ستمنع العملية، ولا يمكن التراجع عنها.",
                    confirmLabel: "حذف نهائي",
                  }
                : {
                    mode: "shared",
                    title: "نقل التصنيف إلى المحذوفات؟",
                    description:
                      "سيختفي التصنيف من القوائم والاختيارات النشطة ويمكن استعادته لاحقًا. أي علاقة قائمة ستمنع العملية وسيبقى الـSlug محجوزًا.",
                    confirmLabel: "نقل إلى المحذوفات",
                  },
              onSelect: async () => {
                const result = await publishResult(() =>
                  isTrashView
                    ? onPermanentDelete(category)
                    : onDelete(category),
                );
                if (!result.ok) throw new Error(result.message);
              },
            },
    },
  };

  return (
    <AdminDataGridRowActions
      capability={capability}
      display={display}
      size="compact"
    />
  );
}
