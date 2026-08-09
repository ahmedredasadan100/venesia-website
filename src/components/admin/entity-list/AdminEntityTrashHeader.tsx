"use client";

import { useRef } from "react";

import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import { mapAdminActionResultToFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import { ADMIN_BULK_ACTION_LABELS } from "../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminFeedback } from "../AdminFeedbackProvider";
import { AdminActionButton } from "../ui";
import { useAdminFloatingLayer } from "./AdminFloatingLayerContext";

export default function AdminEntityTrashHeader({
  count,
  description,
  confirmationTitle,
  confirmationDescription,
  feedbackChannel,
  onEmptyTrash,
  onSuccess,
  mapResultToFeedback = mapAdminActionResultToFeedback,
}: {
  count: number;
  description: string;
  confirmationTitle: (count: number) => string;
  confirmationDescription: (count: number) => string;
  feedbackChannel: string;
  onEmptyTrash: (expectedCount: number) => Promise<AdminActionResult>;
  onSuccess: () => void | Promise<void>;
  mapResultToFeedback?: (result: AdminActionResult) => AdminActionFeedback;
}) {
  const floating = useAdminFloatingLayer();
  const { publishFeedback } = useAdminFeedback();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function publish(result: AdminActionResult) {
    publishFeedback(mapResultToFeedback(result), {
      channel: feedbackChannel,
      placement: "inline",
      critical: !result.ok,
      reveal: true,
    });
  }

  function requestEmptyTrash() {
    if (count <= 0) return;
    if (!floating) {
      publish({
        ok: false,
        title: "تعذر فتح التأكيد",
        message: "لم يبدأ الإجراء لأن طبقة التأكيد المشتركة غير متاحة.",
      });
      return;
    }

    const confirmedCount = count;
    floating.openConfirmation({
      title: confirmationTitle(confirmedCount),
      description: confirmationDescription(confirmedCount),
      confirmLabel: ADMIN_BULK_ACTION_LABELS.emptyTrash,
      returnFocusRef: triggerRef,
      onConfirm: async () => {
        const result = await onEmptyTrash(confirmedCount);
        publish(result);
        if (!result.ok) throw new Error(result.message);
        await onSuccess();
      },
    });
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-amber-300/18 bg-amber-400/[0.055] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-amber-100">المحذوفات</h2>
        <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
      </div>
      <AdminActionButton
        buttonRef={triggerRef}
        type="button"
        variant="dark"
        disabled={count <= 0}
        onClick={requestEmptyTrash}
        className="border-red-300/20 text-red-100/85 hover:border-red-300/35 hover:bg-red-400/8"
      >
        {ADMIN_BULK_ACTION_LABELS.emptyTrash}
      </AdminActionButton>
    </section>
  );
}
