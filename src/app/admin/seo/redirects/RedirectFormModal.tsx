"use client";

import { useRef } from "react";

import {
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";
import AdminFormRuntime, {
  AdminFormError,
  type AdminFormRuntimeHandle,
} from "../../../../components/admin/ui/AdminFormRuntime";
import type { UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";

import {
  createRedirectAction,
  updateRedirectAction,
  type RedirectFormActionState,
} from "./actions";

type RedirectFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  redirect?: UrlRedirectRecord;
  onClose: () => void;
  onSaved: (redirect: UrlRedirectRecord) => void;
};

export default function RedirectFormModal({
  open,
  mode,
  redirect,
  onClose,
  onSaved,
}: RedirectFormModalProps) {
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);
  const action = mode === "create" ? createRedirectAction : updateRedirectAction;
  const formId = `redirect-form-${mode}`;

  function requestClose() {
    runtimeRef.current?.requestClose();
  }

  function handleSuccess(state: RedirectFormActionState) {
    if (!state.result) return;
    onSaved(state.result);
    onClose();
  }

  return (
    <VenesiaModal
      open={open}
      title={mode === "create" ? "إضافة تحويل" : "تعديل التحويل"}
      description="المسارات الداخلية تبدأ بـ /. يمكن استخدام عنوان URL كامل للوجهة الخارجية عند الحاجة."
      size="lg"
      onClose={requestClose}
    >
      <AdminFormRuntime<UrlRedirectRecord>
        action={action}
        mode={mode}
        entityKey={`redirect:${mode}:${redirect?.id ?? "new"}`}
        onClose={onClose}
        onSuccess={handleSuccess}
        runtimeRef={runtimeRef}
        formId={formId}
        className="space-y-4"
      >
        {({ fieldErrors, pending, requestClose: requestRuntimeClose }) => (
          <>
            {mode === "edit" && redirect ? (
              <input type="hidden" name="id" value={redirect.id} />
            ) : null}

            <label className={adminFormLabelClassName()}>
              مسار المصدر
              <input
                name="source_path"
                defaultValue={redirect?.source_path ?? ""}
                placeholder="/old-path"
                className={adminFormFieldClassName(
                  fieldErrors.source_path?.length ? "border-red-400/40" : "",
                )}
                dir="ltr"
                required
                aria-invalid={Boolean(fieldErrors.source_path?.length)}
                aria-describedby={
                  fieldErrors.source_path?.length
                    ? "source_path-error"
                    : undefined
                }
              />
              <AdminFormError name="source_path" />
            </label>

            <label className={adminFormLabelClassName()}>
              الوجهة
              <input
                name="destination_path"
                defaultValue={redirect?.destination_path ?? ""}
                placeholder="/new-path أو https://example.com/page"
                className={adminFormFieldClassName(
                  fieldErrors.destination_path?.length
                    ? "border-red-400/40"
                    : "",
                )}
                dir="ltr"
                required
                aria-invalid={Boolean(fieldErrors.destination_path?.length)}
                aria-describedby={
                  fieldErrors.destination_path?.length
                    ? "destination_path-error"
                    : undefined
                }
              />
              <AdminFormError name="destination_path" />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={adminFormLabelClassName()}>
                نوع التحويل
                <select
                  name="redirect_type"
                  defaultValue={redirect?.redirect_type ?? "301"}
                  className={adminFormFieldClassName(
                    fieldErrors.redirect_type?.length
                      ? "border-red-400/40"
                      : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.redirect_type?.length)}
                  aria-describedby={
                    fieldErrors.redirect_type?.length
                      ? "redirect_type-error"
                      : undefined
                  }
                >
                  <option value="301">301 — دائم</option>
                  <option value="302">302 — مؤقت</option>
                </select>
                <AdminFormError name="redirect_type" />
              </label>

              <label className={adminFormLabelClassName()}>
                الحالة
                <select
                  name="status"
                  defaultValue={redirect?.status ?? "active"}
                  className={adminFormFieldClassName(
                    fieldErrors.status?.length ? "border-red-400/40" : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.status?.length)}
                  aria-describedby={
                    fieldErrors.status?.length ? "status-error" : undefined
                  }
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
                <AdminFormError name="status" />
              </label>
            </div>

            <label className={adminFormLabelClassName()}>
              ملاحظة داخلية
              <textarea
                name="note"
                defaultValue={redirect?.note ?? ""}
                rows={3}
                className={adminFormFieldClassName()}
                placeholder="سبب التحويل أو سياق التغيير"
              />
            </label>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <AdminModalCancelButton
                onClick={requestRuntimeClose}
                disabled={pending}
              >
                إلغاء
              </AdminModalCancelButton>
              <AdminModalPrimaryButton type="submit" disabled={pending}>
                {pending
                  ? "جار الحفظ..."
                  : mode === "create"
                    ? "إنشاء التحويل"
                    : "حفظ التغييرات"}
              </AdminModalPrimaryButton>
            </div>
          </>
        )}
      </AdminFormRuntime>
    </VenesiaModal>
  );
}
