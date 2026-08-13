"use client";

import {
  AdminDataGridRowActions,
  type AdminRowActionsCapability,
} from "../ui";
import {
  adminContentTopicPath,
  adminContentTopicPreviewPath,
} from "../../../lib/admin/content-routes";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type { UnifiedContentRow } from "../../../lib/admin/content/load-unified-content";
import type { AdminInstantMutationRowInteraction } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import { formatAdminDateTime } from "../../../lib/content-dates";
import { getContentPublicVisibilityState } from "../../../lib/content-public-visibility";

export type UnifiedContentRowActionHandlers = {
  view: "active" | "trash";
  rowInteraction: (rowId: number) => AdminInstantMutationRowInteraction;
  onVisibility: (
    row: UnifiedContentRow,
    nextStatus: "published" | "unpublished",
  ) => Promise<AdminActionResult>;
  onFeatured: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onDuplicate: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onDelete: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onRestore: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onPermanentDelete: (row: UnifiedContentRow) => Promise<AdminActionResult>;
};

export default function UnifiedContentRowActions({
  row,
  currentListPath,
  onMutationResult,
  handlers,
  display = "menu",
}: {
  row: UnifiedContentRow;
  currentListPath: string;
  onMutationResult?: (result: AdminActionResult) => void;
  handlers: UnifiedContentRowActionHandlers;
  display?: "menu" | "visibility" | "featured";
}) {
  const visibility = getContentPublicVisibilityState({
    status: row.status,
    deletedAt: row.deleted_at,
  });
  const nextStatus = visibility.nextStatus;
  const interaction = handlers.rowInteraction(row.id);
  const pendingAction = interaction.pendingAction;
  const isTrashView = handlers.view === "trash";

  async function publishResult(result: Promise<AdminActionResult>) {
    const resolved = await result;
    onMutationResult?.(resolved);
    return resolved;
  }

  const pendingReason = "انتظر انتهاء الإجراء الحالي.";

  const capability: AdminRowActionsCapability = {
    entityType: "topic",
    entityId: row.id,
    entityLabel: row.title || `الموضوع ${row.id}`,
    actions: {
      edit: {
        ...(isTrashView
          ? { access: "hidden" as const }
          : {
              access: "allowed" as const,
              href: adminContentTopicPath(row.id, {
                returnTo: currentListPath,
              }),
            }),
      },
      preview: {
        ...(isTrashView
          ? { access: "hidden" as const }
          : {
              access: "allowed" as const,
              href: adminContentTopicPreviewPath(row.id),
              target: "_blank",
              rel: "noopener noreferrer",
            }),
      },
      information: {
        access: "allowed",
        title: "معلومات نشاط المحتوى",
        items: [
          {
            label: "تم النشر بواسطة:",
            value: row.published_at
              ? row.published_by_display?.trim() || "غير مسجل"
              : "لم يُنشر بعد",
          },
          {
            label: "تاريخ النشر:",
            value: formatAdminDateTime(row.published_at),
          },
          {
            label: "تم آخر تعديل بواسطة:",
            value: row.updated_by_display?.trim() || "غير مسجل",
          },
          {
            label: "آخر تعديل:",
            value: formatAdminDateTime(row.updated_at),
          },
          {
            label: "عدد المشاهدات:",
            value: `${new Intl.NumberFormat("ar-EG").format(row.views_count ?? 0)} مشاهدة`,
          },
          ...(isTrashView
            ? [
                {
                  label: "نُقل إلى المحذوفات:",
                  value: formatAdminDateTime(row.deleted_at),
                },
              ]
            : []),
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: isTrashView
        ? { access: "hidden" }
        : nextStatus
        ? pendingAction === "visibility"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isVisible: visibility.isPubliclyVisible,
            }
          : {
              access: "allowed",
              isVisible: visibility.isPubliclyVisible,
              onSelect: async () => {
                await publishResult(handlers.onVisibility(row, nextStatus));
              },
            }
        : {
            access: "disabled",
            isVisible: visibility.isPubliclyVisible,
            disabledReason: visibility.tooltip,
          },
      featured: isTrashView
        ? display === "featured"
          ? {
              access: "disabled",
              disabledReason: "عرض فقط داخل المحذوفات.",
              isFeatured: Boolean(row.is_featured),
            }
          : { access: "hidden" }
        :
        pendingAction === "featured"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isFeatured: Boolean(row.is_featured),
            }
          : {
              access: "allowed",
              isFeatured: Boolean(row.is_featured),
              onSelect: async () => {
                await publishResult(handlers.onFeatured(row));
              },
            },
      duplicate: isTrashView
        ? { access: "hidden" }
        :
        pendingAction === "duplicate"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : {
              access: "allowed",
              onSelect: async () => {
                await publishResult(handlers.onDuplicate(row));
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
                title: "استعادة الموضوع؟",
                description:
                  "سيعود الموضوع إلى القائمة النشطة كغير منشور مع الاحتفاظ بالـSlug الحالي.",
                confirmLabel: "استعادة",
              },
              onSelect: async () => {
                const result = await publishResult(handlers.onRestore(row));
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
              // AdminDataGridRowActions delegates this declaration to
              // AdminConfirmDialog, the existing Confirmation Runtime owner.
              confirmation: isTrashView
                ? {
                    mode: "shared",
                    title: "حذف الموضوع نهائيًا؟",
                    description:
                      "سيُحذف السجل نهائيًا ويصبح الـSlug متاحًا للاستخدام. لا يمكن التراجع عن هذا الإجراء.",
                    confirmLabel: "حذف نهائي",
                  }
                : {
                    mode: "shared",
                    title: "نقل الموضوع إلى المحذوفات؟",
                    description:
                      "سيختفي الموضوع من القائمة النشطة ويمكن استعادته لاحقًا. سيبقى الـSlug محجوزًا.",
                    confirmLabel: "نقل إلى المحذوفات",
                  },
              onSelect: async () => {
                const result = await publishResult(
                  isTrashView
                    ? handlers.onPermanentDelete(row)
                    : handlers.onDelete(row),
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
