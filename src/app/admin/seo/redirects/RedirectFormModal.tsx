"use client";

import { useTransition } from "react";

import {
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";
import type { UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";

import { createRedirectAction, updateRedirectAction } from "./actions";

type RedirectFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  redirect?: UrlRedirectRecord;
  onClose: () => void;
};

export default function RedirectFormModal({ open, mode, redirect, onClose }: RedirectFormModalProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (mode === "create") {
        await createRedirectAction(formData);
      } else {
        await updateRedirectAction(formData);
      }
    });
  }

  return (
    <VenesiaModal
      open={open}
      title={mode === "create" ? "إضافة تحويل" : "تعديل التحويل"}
      description="المسارات الداخلية تبدأ بـ /. يمكن استخدام عنوان URL كامل للوجهة الخارجية عند الحاجة."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <AdminModalCancelButton onClick={onClose} disabled={isPending}>
            إلغاء
          </AdminModalCancelButton>
          <AdminModalPrimaryButton type="submit" form="redirect-form" disabled={isPending}>
            {isPending ? "جار الحفظ..." : mode === "create" ? "إنشاء التحويل" : "حفظ التغييرات"}
          </AdminModalPrimaryButton>
        </>
      }
    >
      <form id="redirect-form" action={handleSubmit} className="space-y-4">
        {mode === "edit" && redirect ? <input type="hidden" name="id" value={redirect.id} /> : null}

        <label className={adminFormLabelClassName()}>
          مسار المصدر
          <input
            name="source_path"
            defaultValue={redirect?.source_path ?? ""}
            placeholder="/old-path"
            className={adminFormFieldClassName()}
            dir="ltr"
            required
          />
        </label>

        <label className={adminFormLabelClassName()}>
          الوجهة
          <input
            name="destination_path"
            defaultValue={redirect?.destination_path ?? ""}
            placeholder="/new-path أو https://example.com/page"
            className={adminFormFieldClassName()}
            dir="ltr"
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={adminFormLabelClassName()}>
            نوع التحويل
            <select
              name="redirect_type"
              defaultValue={redirect?.redirect_type ?? "301"}
              className={adminFormFieldClassName()}
            >
              <option value="301">301 — دائم</option>
              <option value="302">302 — مؤقت</option>
            </select>
          </label>

          <label className={adminFormLabelClassName()}>
            الحالة
            <select name="status" defaultValue={redirect?.status ?? "active"} className={adminFormFieldClassName()}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
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
      </form>
    </VenesiaModal>
  );
}
