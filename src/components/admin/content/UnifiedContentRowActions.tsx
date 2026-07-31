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
import { formatAdminDateTime } from "../../../lib/content-dates";
import { getContentPublicVisibilityState } from "../../../lib/content-public-visibility";

export type UnifiedContentRowActionHandlers = {
  rowPendingAction: (rowId: number) => string | null;
  mutationBusy: boolean;
  onVisibility: (
    row: UnifiedContentRow,
    nextStatus: "published" | "unpublished",
  ) => Promise<AdminActionResult>;
  onFeatured: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onDuplicate: (row: UnifiedContentRow) => Promise<AdminActionResult>;
  onDelete: (row: UnifiedContentRow) => Promise<AdminActionResult>;
};

export default function UnifiedContentRowActions({
  row,
  currentListPath,
  onMutationResult,
  handlers,
}: {
  row: UnifiedContentRow;
  currentListPath: string;
  onMutationResult?: (result: AdminActionResult) => void;
  handlers: UnifiedContentRowActionHandlers;
}) {
  const visibility = getContentPublicVisibilityState({
    status: row.status,
    deletedAt: row.deleted_at,
  });
  const nextStatus = visibility.nextStatus;
  const pendingAction = handlers.rowPendingAction(row.id);

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
        access: "allowed",
        href: adminContentTopicPath(row.id, { returnTo: currentListPath }),
      },
      preview: {
        access: "allowed",
        href: adminContentTopicPreviewPath(row.id),
        target: "_blank",
        rel: "noopener noreferrer",
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
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: nextStatus
        ? pendingAction === "visibility"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isVisible: visibility.isPubliclyVisible,
            }
          : handlers.mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
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
      featured:
        pendingAction === "featured"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
              isFeatured: Boolean(row.is_featured),
            }
          : handlers.mutationBusy
            ? {
                access: "disabled",
                disabledReason: pendingReason,
                isFeatured: Boolean(row.is_featured),
              }
            : {
                access: "allowed",
                isFeatured: Boolean(row.is_featured),
                onSelect: async () => {
                  await publishResult(handlers.onFeatured(row));
                },
              },
      duplicate:
        pendingAction === "duplicate"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : handlers.mutationBusy
            ? { access: "disabled", disabledReason: pendingReason }
            : {
                access: "allowed",
                onSelect: async () => {
                  await publishResult(handlers.onDuplicate(row));
                },
              },
      archive: { access: "hidden" },
      delete:
        pendingAction === "delete"
          ? {
              access: "disabled",
              disabledReason: pendingReason,
              pending: true,
            }
          : handlers.mutationBusy
            ? { access: "disabled", disabledReason: pendingReason }
            : {
                access: "allowed",
                // AdminDataGridRowActions delegates this declaration to
                // AdminConfirmDialog, the existing Confirmation Runtime owner.
                confirmation: {
                  mode: "shared",
                  title: "هل أنت متأكد من حذف المحتوى؟",
                  description:
                    "سيتم حذف المحتوى حذفًا آمنًا وإزالته من القائمة.",
                  confirmLabel: "تأكيد الحذف",
                },
                onSelect: async () => {
                  const result = await publishResult(handlers.onDelete(row));
                  if (!result.ok) throw new Error(result.message);
                },
              },
    },
  };

  return <AdminDataGridRowActions capability={capability} size="compact" />;
}
