"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateUnifiedContent,
  setUnifiedContentStatus,
  softDeleteUnifiedContent,
  toggleUnifiedContentFeatured,
} from "../../../app/admin/content/topics/actions";
import {
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
} from "../ui/AdminDataGrid";
import AdminConfirmDialog from "../ui/AdminConfirmDialog";
import {
  adminContentTopicPath,
  adminContentTopicPreviewPath,
} from "../../../lib/admin/content-routes";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type { UnifiedContentRow } from "../../../lib/admin/content/load-unified-content";
import { getContentPublicVisibilityState } from "../../../lib/content-public-visibility";
import AdminContentActivityPopover from "./AdminContentActivityPopover";

type RowMutationKey = "delete" | "duplicate" | "feature" | "visibility";
type RowMutation = (formData: FormData) => Promise<AdminActionResult>;

export default function UnifiedContentRowActions({
  row,
  currentListPath,
  onMutationResult,
  deferRefresh = false,
}: {
  row: UnifiedContentRow;
  currentListPath: string;
  onMutationResult?: (result: AdminActionResult) => void;
  /** When true, the parent controller refreshes/invalidates instead of router.refresh(). */
  deferRefresh?: boolean;
}) {
  const router = useRouter();
  const pendingRef = useRef<RowMutationKey | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [pendingAction, setPendingAction] = useState<RowMutationKey | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [, startTransition] = useTransition();
  const visibility = getContentPublicVisibilityState({
    status: row.status,
    deletedAt: row.deleted_at,
  });

  /**
   * Mutation state is owned per {row, action} and settles deterministically:
   * pending starts when the server action fires and always ends in `finally`,
   * never by waiting for a refetched row value to arrive.
   */
  function runMutation(
    key: RowMutationKey,
    action: RowMutation,
    values: Record<string, string>,
    onSettled?: () => void,
  ): Promise<void> {
    if (pendingRef.current) return Promise.resolve();
    pendingRef.current = key;
    setPendingAction(key);
    const formData = new FormData();
    Object.entries(values).forEach(([name, value]) => formData.set(name, value));

    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await action(formData);
          // Engine consumers patch/invalidate their query cache from this
          // result before we settle, so the row reflects server truth.
          onMutationResult?.(result);
          if (result.ok && !deferRefresh) router.refresh();
        } catch {
          onMutationResult?.({
            ok: false,
            title: "تعذر تنفيذ العملية",
            message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
          });
        } finally {
          onSettled?.();
          pendingRef.current = null;
          setPendingAction(null);
          resolve();
        }
      });
    });
  }

  const mutationBusy = pendingAction !== null;
  const editHref = adminContentTopicPath(row.id, {
    returnTo: currentListPath,
  });

  return (
    <AdminDataGridActionsCell compact>
      <AdminDataGridActionButton
        action="edit"
        href={editHref}
        size="compact"
        title="تعديل"
      />
      <AdminDataGridActionButton
        action="preview"
        href={adminContentTopicPreviewPath(row.id)}
        target="_blank"
        rel="noreferrer"
        size="compact"
        title="معاينة"
      />
      <AdminDataGridActionButton
        action="visibility"
        size="compact"
        isCurrentlyHidden={!visibility.isPubliclyVisible}
        pending={pendingAction === "visibility"}
        disabled={mutationBusy || !visibility.nextStatus}
        title={visibility.tooltip}
        ariaLabel={visibility.ariaLabel}
        tone={visibility.isPubliclyVisible ? "green" : "dark"}
        onClick={() => {
          if (!visibility.nextStatus) return;
          runMutation("visibility", setUnifiedContentStatus, {
            id: String(row.id),
            next_status: visibility.nextStatus,
          });
        }}
      />
      <AdminDataGridActionButton
        action="feature"
        size="compact"
        active={Boolean(row.is_featured)}
        ariaPressed={Boolean(row.is_featured)}
        pending={pendingAction === "feature"}
        disabled={mutationBusy}
        title={row.is_featured ? "إلغاء التمييز" : "تعيين كمميز"}
        tone={row.is_featured ? "gold" : "dark"}
        onClick={() =>
          runMutation("feature", toggleUnifiedContentFeatured, {
            id: String(row.id),
          })
        }
      />
      <AdminDataGridActionButton
        action="duplicate"
        size="compact"
        pending={pendingAction === "duplicate"}
        disabled={mutationBusy}
        title="نسخ"
        onClick={() =>
          runMutation("duplicate", duplicateUnifiedContent, {
            id: String(row.id),
          })
        }
      />
      <AdminDataGridActionButton
        action="delete"
        buttonRef={deleteTriggerRef}
        size="compact"
        pending={pendingAction === "delete"}
        disabled={mutationBusy}
        title="حذف آمن"
        ariaHasPopup="dialog"
        ariaExpanded={deleteDialogOpen}
        onClick={() => setDeleteDialogOpen(true)}
      />
      <AdminConfirmDialog
        open={deleteDialogOpen}
        title="هل أنت متأكد من حذف المحتوى؟"
        description="سيتم حذف المحتوى حذفًا آمنًا وإزالته من القائمة."
        confirmLabel="تأكيد الحذف"
        tone="danger"
        pending={pendingAction === "delete"}
        returnFocusRef={deleteTriggerRef}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() =>
          runMutation(
            "delete",
            softDeleteUnifiedContent,
            { id: String(row.id) },
            () => setDeleteDialogOpen(false),
          )
        }
      />
      <AdminContentActivityPopover
        publishedBy={row.published_by_display}
        publishedAt={row.published_at}
        updatedBy={row.updated_by_display}
        updatedAt={row.updated_at}
        viewsCount={row.views_count}
      />
    </AdminDataGridActionsCell>
  );
}
