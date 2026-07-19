"use client";

import { useState } from "react";

import {
  AdminDataGridActionButton,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";
import { deleteCategorySafelyAjax, getCategoryDeletePreviewAjax } from "./actions";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";

type TransferTarget = {
  id: number;
  name: string;
  level: number;
};

type ModalMode = "confirm" | "transfer" | "blocked-relations" | "no-targets" | "error";

type CategoryDeleteButtonProps = {
  categoryId: number;
  onMutationResult?: (result: AdminActionResult) => void;
};

export default function CategoryDeleteButton({
  categoryId,
  onMutationResult,
}: CategoryDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<ModalMode>("confirm");
  const [categoryName, setCategoryName] = useState("");
  const [topicCount, setTopicCount] = useState(0);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [transferToId, setTransferToId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);

  function loadDeletePreview() {
    setLoading(true);
    setPending(false);
    setValidationError(null);
    setErrorMessage(null);
    setBlockMessage(null);
    setTransferToId("");

    void getCategoryDeletePreviewAjax(categoryId)
      .then((preview) => {
        if (!preview.ok) {
          setMode("error");
          setErrorMessage(preview.message ?? "تعذر تحميل بيانات الحذف.");
          return;
        }

        setCategoryName(preview.categoryName);
        setTopicCount(preview.topicCount);
        setTransferTargets(preview.validTransferTargets);
        setBlockMessage(preview.blockMessage);

        if (preview.blockMessage) {
          setMode("blocked-relations");
          return;
        }

        if (preview.topicCount > 0) {
          if (preview.validTransferTargets.length === 0) {
            setMode("no-targets");
            return;
          }
          setMode("transfer");
          return;
        }

        setMode("confirm");
      })
      .catch(() => {
        setMode("error");
        setErrorMessage("تعذر تحميل بيانات الحذف.");
      })
      .finally(() => setLoading(false));
  }

  function openModal() {
    setOpen(true);
    loadDeletePreview();
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
  }

  async function handleConfirmDelete() {
    setPending(true);
    setValidationError(null);
    try {
      const result = await deleteCategorySafelyAjax(categoryId);
      if (!result.ok) {
        setValidationError(result.message ?? "تعذر حذف التصنيف.");
        onMutationResult?.({
          ok: false,
          title: "تعذر حذف التصنيف",
          message: result.message ?? "تعذر حذف التصنيف.",
          entityId: categoryId,
        });
        return;
      }
      setOpen(false);
      onMutationResult?.({
        ok: true,
        title: "تم بنجاح",
        message: result.message ?? "تم حذف التصنيف بنجاح.",
        code: "deleted",
        entityId: categoryId,
      });
    } catch {
      setValidationError("تعذر حذف التصنيف.");
      onMutationResult?.({
        ok: false,
        title: "تعذر حذف التصنيف",
        message: "تعذر حذف التصنيف.",
        entityId: categoryId,
      });
    } finally {
      setPending(false);
    }
  }

  async function handleTransferAndDelete() {
    setValidationError(null);

    if (!transferToId) {
      setValidationError("اختر تصنيفًا لنقل الموضوعات إليه.");
      return;
    }

    setPending(true);
    try {
      const result = await deleteCategorySafelyAjax(
        categoryId,
        Number(transferToId),
      );
      if (!result.ok) {
        setValidationError(
          result.message ?? "تعذر نقل الموضوعات وحذف التصنيف.",
        );
        onMutationResult?.({
          ok: false,
          title: "تعذر حذف التصنيف",
          message: result.message ?? "تعذر نقل الموضوعات وحذف التصنيف.",
          entityId: categoryId,
        });
        return;
      }
      setOpen(false);
      onMutationResult?.({
        ok: true,
        title: "تم بنجاح",
        message: result.message ?? "تم حذف التصنيف بنجاح.",
        code: "deleted",
        entityId: categoryId,
      });
    } catch {
      setValidationError("تعذر نقل الموضوعات وحذف التصنيف.");
      onMutationResult?.({
        ok: false,
        title: "تعذر حذف التصنيف",
        message: "تعذر نقل الموضوعات وحذف التصنيف.",
        entityId: categoryId,
      });
    } finally {
      setPending(false);
    }
  }

  const modalTitle =
    mode === "transfer"
      ? "نقل الموضوعات قبل الحذف"
      : mode === "blocked-relations"
        ? "لا يمكن حذف التصنيف"
        : mode === "no-targets"
          ? "لا توجد تصنيفات بديلة"
          : mode === "error"
            ? "تعذر تنفيذ الحذف"
            : "تأكيد حذف التصنيف";

  const modalDescription =
    mode === "transfer"
      ? `لا يمكن حذف هذا التصنيف لأنه يحتوي على ${topicCount} موضوعات.`
      : mode === "blocked-relations"
        ? blockMessage ?? "لا يمكن حذف التصنيف لوجود عناصر مرتبطة به."
        : mode === "no-targets"
          ? "لا يمكن حذف هذا التصنيف لأنه يحتوي موضوعات ولا يوجد تصنيف آخر صالح لنقلها."
          : mode === "error"
            ? errorMessage ?? "حاول مرة أخرى."
            : `هل أنت متأكد من حذف «${categoryName}»؟ لا يمكن التراجع عن هذا الإجراء.`;

  return (
    <>
      <AdminDataGridActionButton
        action="delete"
        size="compact"
        title="حذف التصنيف"
        onClick={openModal}
      />

      <VenesiaModal
        open={open}
        title={modalTitle}
        description={loading ? "جار التحقق من بيانات التصنيف..." : modalDescription}
        size="md"
        onClose={closeModal}
        footer={
          loading ? (
            <AdminModalCancelButton onClick={closeModal} disabled={pending}>
              إغلاق
            </AdminModalCancelButton>
          ) : mode === "confirm" ? (
            <>
              <AdminModalCancelButton onClick={closeModal} disabled={pending}>
                إلغاء
              </AdminModalCancelButton>
              <AdminModalPrimaryButton onClick={handleConfirmDelete} disabled={pending}>
                {pending ? "جار الحذف..." : "حذف التصنيف"}
              </AdminModalPrimaryButton>
            </>
          ) : mode === "transfer" ? (
            <>
              <AdminModalCancelButton onClick={closeModal} disabled={pending}>
                إلغاء
              </AdminModalCancelButton>
              <AdminModalPrimaryButton onClick={handleTransferAndDelete} disabled={pending}>
                {pending ? "جار التنفيذ..." : "نقل الموضوعات ثم حذف التصنيف"}
              </AdminModalPrimaryButton>
            </>
          ) : (
            <AdminModalCancelButton onClick={closeModal} disabled={pending}>
              إغلاق
            </AdminModalCancelButton>
          )
        }
      >
        {!loading && mode === "transfer" ? (
          <div className="space-y-4">
            {validationError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                {validationError}
              </div>
            ) : null}

            <label className={adminFormLabelClassName()}>
              نقل الموضوعات إلى
              <select
                value={transferToId}
                onChange={(event) => {
                  setTransferToId(event.target.value);
                  setValidationError(null);
                }}
                className={adminFormFieldClassName()}
              >
                <option value="">اختر تصنيفًا...</option>
                {transferTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {`${"— ".repeat(target.level)}${target.name}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {!loading && mode === "confirm" && validationError ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
            {validationError}
          </div>
        ) : null}
      </VenesiaModal>
    </>
  );
}
