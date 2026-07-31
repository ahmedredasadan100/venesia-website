"use client";

import { useEffect, useState, type RefObject } from "react";

import {
  AdminConfirmDialog,
  AdminListboxSelect,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { getCategoryDeletePreviewAjax } from "./actions";

type TransferTarget = {
  id: number;
  name: string;
  level: number;
};

type DialogMode =
  | "confirm"
  | "transfer"
  | "blocked-relations"
  | "no-targets"
  | "error";

type CategoryDeleteButtonProps = {
  categoryId: number;
  open: boolean;
  mutationPending?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onMutationResult?: (result: AdminActionResult) => void;
  onDelete: (
    categoryId: number,
    transferToId: number | null,
  ) => Promise<{
    ok: boolean;
    message?: string;
    feedbackStatus?: "success" | "warning";
  }>;
};

/**
 * Category-specific delete preparation adapter. Relation checks and transfer
 * selection remain in the Category domain; the shared Confirmation Runtime
 * owns the dialog, focus lifecycle, pending lock, and duplicate invocation.
 */
export default function CategoryDeleteButton({
  categoryId,
  open,
  mutationPending = false,
  returnFocusRef,
  onOpenChange,
  onMutationResult,
  onDelete,
}: CategoryDeleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<DialogMode>("confirm");
  const [categoryName, setCategoryName] = useState("");
  const [topicCount, setTopicCount] = useState(0);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [transferToId, setTransferToId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setMode("confirm");
        setValidationError(null);
        setErrorMessage(null);
        setBlockMessage(null);
        setTransferToId("");
        return getCategoryDeletePreviewAjax(categoryId);
      })
      .then((preview) => {
        if (!active || !preview) return;
        if (!preview.ok) {
          setMode("error");
          setErrorMessage(
            preview.message ?? "تعذر تحميل بيانات الحذف.",
          );
          return;
        }

        setCategoryName(preview.categoryName);
        setTopicCount(preview.topicCount);
        setTransferTargets(preview.validTransferTargets);
        setBlockMessage(preview.blockMessage);

        if (preview.blockMessage) {
          setMode("blocked-relations");
        } else if (preview.topicCount > 0) {
          setMode(
            preview.validTransferTargets.length > 0
              ? "transfer"
              : "no-targets",
          );
        } else {
          setMode("confirm");
        }
      })
      .catch(() => {
        if (!active) return;
        setMode("error");
        setErrorMessage("تعذر تحميل بيانات الحذف.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoryId, open]);

  function closeDialog() {
    if (!mutationPending) onOpenChange(false);
  }

  async function executeDelete(transferTargetId: number | null) {
    setValidationError(null);
    try {
      const result = await onDelete(categoryId, transferTargetId);
      if (!result.ok) {
        const message =
          result.message ??
          (transferTargetId
            ? "تعذر نقل الموضوعات وحذف التصنيف."
            : "تعذر حذف التصنيف.");
        setValidationError(message);
        onMutationResult?.({
          ok: false,
          title: "تعذر حذف التصنيف",
          message,
          entityId: categoryId,
        });
        return;
      }

      onOpenChange(false);
      onMutationResult?.({
        ok: true,
        feedbackStatus: result.feedbackStatus,
        title: "تم بنجاح",
        message: result.message ?? "تم حذف التصنيف بنجاح.",
        code: "deleted",
        entityId: categoryId,
      });
    } catch {
      const message = transferTargetId
        ? "تعذر نقل الموضوعات وحذف التصنيف."
        : "تعذر حذف التصنيف.";
      setValidationError(message);
      onMutationResult?.({
        ok: false,
        title: "تعذر حذف التصنيف",
        message,
        entityId: categoryId,
      });
    }
  }

  const dialogTitle =
    mode === "transfer"
      ? "نقل الموضوعات قبل الحذف"
      : mode === "blocked-relations"
        ? "لا يمكن حذف التصنيف"
        : mode === "no-targets"
          ? "لا توجد تصنيفات بديلة"
          : mode === "error"
            ? "تعذر تنفيذ الحذف"
            : "تأكيد حذف التصنيف";

  const dialogDescription = loading
    ? "جارٍ التحقق من بيانات التصنيف..."
    : mode === "transfer"
      ? `لا يمكن حذف هذا التصنيف لأنه يحتوي على ${topicCount} موضوعات.`
      : mode === "blocked-relations"
        ? blockMessage ??
          "لا يمكن حذف التصنيف لوجود عناصر مرتبطة به."
        : mode === "no-targets"
          ? "لا يمكن حذف هذا التصنيف لأنه يحتوي موضوعات ولا يوجد تصنيف آخر صالح لنقلها."
          : mode === "error"
            ? errorMessage ?? "حاول مرة أخرى."
            : `هل أنت متأكد من حذف «${categoryName}»؟ لا يمكن التراجع عن هذا الإجراء.`;

  const canConfirm = !loading && (mode === "confirm" || mode === "transfer");
  const confirmLabel =
    mode === "transfer"
      ? "نقل الموضوعات ثم حذف التصنيف"
      : "حذف التصنيف";

  return (
    <AdminConfirmDialog
      open={open}
      title={dialogTitle}
      description={dialogDescription}
      confirmLabel={confirmLabel}
      cancelLabel={canConfirm ? "إلغاء" : "إغلاق"}
      pending={mutationPending}
      showConfirm={canConfirm}
      confirmDisabled={mode === "transfer" && !transferToId}
      returnFocusRef={returnFocusRef}
      onCancel={closeDialog}
      onConfirm={() =>
        executeDelete(mode === "transfer" ? Number(transferToId) : null)
      }
    >
      {!loading && mode === "transfer" ? (
        <div className="space-y-4">
          {validationError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100"
            >
              {validationError}
            </div>
          ) : null}

          <div className={adminFormLabelClassName()}>
            <span>نقل الموضوعات إلى</span>
            <AdminListboxSelect
              id={`category-${categoryId}-transfer-target`}
              value={transferToId}
              onChange={(value) => {
                setTransferToId(value);
                setValidationError(null);
              }}
              placeholder="اختر تصنيفًا..."
              options={transferTargets.map((target) => ({
                value: String(target.id),
                label: target.name,
                depth: target.level,
              }))}
              disabled={mutationPending}
              className="mt-2 w-full"
            />
          </div>
        </div>
      ) : null}

      {!loading && mode === "confirm" && validationError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100"
        >
          {validationError}
        </div>
      ) : null}
    </AdminConfirmDialog>
  );
}
