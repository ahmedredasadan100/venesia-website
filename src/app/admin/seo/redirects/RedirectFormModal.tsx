"use client";

import { useRef } from "react";

import {
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminFormField,
  AdminFormGrid,
  AdminFormListboxSelect,
  VenesiaModal,
  adminFormFieldClassName,
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

const REDIRECT_TYPE_OPTIONS = [
  { value: "301", label: "301 — دائم" },
  { value: "302", label: "302 — مؤقت" },
] as const;

const REDIRECT_STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
] as const;

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

            <AdminFormField label="مسار المصدر" required>
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
            </AdminFormField>

            <AdminFormField label="الوجهة" required>
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
            </AdminFormField>

            <AdminFormGrid>
              <AdminFormListboxSelect
                name="redirect_type"
                focusTargetId="redirect_type"
                label="نوع التحويل"
                options={REDIRECT_TYPE_OPTIONS}
                defaultValue={redirect?.redirect_type ?? "301"}
                disabled={pending}
                error={fieldErrors.redirect_type?.[0] ?? null}
              />

              <AdminFormListboxSelect
                name="status"
                focusTargetId="status"
                label="الحالة"
                options={REDIRECT_STATUS_OPTIONS}
                defaultValue={redirect?.status ?? "active"}
                disabled={pending}
                error={fieldErrors.status?.[0] ?? null}
              />
            </AdminFormGrid>

            <AdminFormField label="ملاحظة داخلية">
              <textarea
                name="note"
                defaultValue={redirect?.note ?? ""}
                rows={3}
                className={adminFormFieldClassName()}
                placeholder="سبب التحويل أو سياق التغيير"
              />
            </AdminFormField>

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
