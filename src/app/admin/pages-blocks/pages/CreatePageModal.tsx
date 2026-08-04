"use client";

import { useRef, useState } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  AdminActionButton,
  AdminFormField,
  AdminFormError,
  AdminFormGrid,
  AdminFormRuntime,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import type { AdminFormRuntimeHandle } from "../../../../components/admin/ui/AdminFormRuntime";
import { createPage } from "./actions";

export default function CreatePageModal() {
  const [open, setOpen] = useState(false);
  const runtimeRef = useRef<AdminFormRuntimeHandle>(null);

  function openPanel() {
    setOpen(true);
  }

  function requestClose() {
    runtimeRef.current?.requestClose();
  }

  return (
    <>
      <AdminActionButton variant="primary" onClick={openPanel}>
        <PlusIcon />
        إضافة صفحة
      </AdminActionButton>

      <VenesiaModal
        open={open}
        title="إضافة صفحة جديدة"
        description="سيتم إنشاء الصفحة كمسودة، ولن تظهر للعامة قبل النشر وتفعيل المسار العام."
        onClose={requestClose}
      >
        <AdminFormRuntime
          action={createPage}
          mode="create"
          entityKey="page-quick-create"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          runtimeRef={runtimeRef}
          formId="create-page-form"
          className="space-y-5"
        >
          {({ fieldErrors, pending, requestClose: requestRuntimeClose }) => (
            <>
              <AdminFormError />

              <AdminFormGrid columns={1}>
                <AdminFormField label="اسم الصفحة" required>
                  <input
                    name="title"
                    required
                    className={adminFormFieldClassName(
                      fieldErrors.title?.length ? "border-red-400/40" : "",
                    )}
                    placeholder="مثال: رؤيتنا"
                    aria-invalid={Boolean(fieldErrors.title?.length)}
                    aria-describedby={
                      fieldErrors.title?.length ? "title-error" : undefined
                    }
                  />
                  <AdminFormError name="title" />
                </AdminFormField>

                <AdminFormField
                  label="مسار الصفحة"
                  required
                  hint={
                    <>
                      اكتب المسار الذي ستظهر عليه الصفحة لاحقًا، مثل: {" "}
                      <span className="font-en text-white/55">/our-vision</span>
                    </>
                  }
                >
                  <input
                    name="path"
                    required
                    dir="ltr"
                    className={adminFormFieldClassName(
                      `text-left font-en ${fieldErrors.path?.length ? "border-red-400/40" : ""}`,
                    )}
                    placeholder="/our-vision"
                    aria-invalid={Boolean(fieldErrors.path?.length)}
                    aria-describedby={
                      fieldErrors.path?.length ? "path-error" : undefined
                    }
                  />
                  <AdminFormError name="path" />
                </AdminFormField>
              </AdminFormGrid>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <AdminModalCancelButton
                  onClick={requestRuntimeClose}
                  disabled={pending}
                >
                  إلغاء
                </AdminModalCancelButton>
                <AdminModalPrimaryButton type="submit" disabled={pending}>
                  {pending ? "جار الإنشاء..." : "إنشاء وفتح المحرر"}
                </AdminModalPrimaryButton>
              </div>
            </>
          )}
        </AdminFormRuntime>
      </VenesiaModal>
    </>
  );
}
