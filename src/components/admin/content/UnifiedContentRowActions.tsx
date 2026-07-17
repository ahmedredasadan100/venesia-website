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
}: {
  row: UnifiedContentRow;
  currentListPath: string;
  onMutationResult?: (result: AdminActionResult) => void;
}) {
  const router = useRouter();
  const pendingRef = useRef<RowMutationKey | null>(null);
  const [pendingAction, setPendingAction] = useState<RowMutationKey | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const visibility = getContentPublicVisibilityState({
    status: row.status,
    deletedAt: row.deleted_at,
  });

  function runMutation(
    key: RowMutationKey,
    action: RowMutation,
    values: Record<string, string>,
  ) {
    if (pendingRef.current) return;
    pendingRef.current = key;
    setPendingAction(key);
    const formData = new FormData();
    Object.entries(values).forEach(([name, value]) => formData.set(name, value));

    startTransition(async () => {
      try {
        const result = await action(formData);
        onMutationResult?.(result);
        if (result.ok) router.refresh();
      } catch {
        onMutationResult?.({
          ok: false,
          title: "تعذر تنفيذ العملية",
          message: "حدث خطأ غير متوقع. حاول مرة أخرى.",
        });
      } finally {
        pendingRef.current = null;
        setPendingAction(null);
      }
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
        hidden={!visibility.isPubliclyVisible}
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
        size="compact"
        pending={pendingAction === "delete"}
        disabled={mutationBusy}
        title="حذف آمن"
        onClick={() => {
          if (
            !window.confirm(
              "سيتم حذف المحتوى حذفًا آمنًا. هل تريد المتابعة؟",
            )
          ) {
            return;
          }
          runMutation("delete", softDeleteUnifiedContent, {
            id: String(row.id),
          });
        }}
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
