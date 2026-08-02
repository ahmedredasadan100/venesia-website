"use client";

import { useState, type FormEvent } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  ADMIN_FORM,
  AdminActionButton,
  AdminFormField,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import { checkPagePathAvailable, createPage } from "./actions";

export default function CreatePageModal() {
  const [open, setOpen] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [pathValue, setPathValue] = useState("");
  const [pathError, setPathError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function openPanel() {
    setTitleValue("");
    setPathValue("");
    setPathError(null);
    setFormError(null);
    setIsPending(false);
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPathError(null);

    const formData = new FormData(event.currentTarget);
    const title = titleValue.trim();
    const pathInput = pathValue.trim();

    if (!title) {
      setFormError("اكتب اسم الصفحة.");
      return;
    }

    if (!pathInput) {
      setPathError("مسار الصفحة مطلوب.");
      return;
    }

    setIsPending(true);

    try {
      const availability = await checkPagePathAvailable(pathInput);
      if (!availability.available) {
        setPathError(availability.message ?? "مسار الصفحة غير متاح.");
        setIsPending(false);
        return;
      }

      formData.set("title", title);
      formData.set("path", pathInput);
      await createPage(formData);
    } catch {
      setFormError("تعذر إنشاء الصفحة. حاول مرة أخرى.");
      setIsPending(false);
    }
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
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)} disabled={isPending}>
              إلغاء
            </AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-page-form" disabled={isPending}>
              {isPending ? "جار الإنشاء..." : "إنشاء وفتح المحرر"}
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id="create-page-form" onSubmit={handleSubmit} className={ADMIN_FORM.grid}>
          {formError ? (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {formError}
            </p>
          ) : null}

          <AdminFormField label="اسم الصفحة" required>
            <input
              name="title"
              value={titleValue}
              onChange={(event) => {
                setTitleValue(event.target.value);
                setFormError(null);
              }}
              required
              className={adminFormFieldClassName()}
              placeholder="مثال: رؤيتنا"
              disabled={isPending}
            />
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
            error={pathError}
          >
            <input
              name="path"
              value={pathValue}
              onChange={(event) => {
                setPathValue(event.target.value);
                setPathError(null);
              }}
              required
              dir="ltr"
              className={adminFormFieldClassName("text-left font-en")}
              placeholder="/our-vision"
              disabled={isPending}
            />
          </AdminFormField>
        </form>
      </VenesiaModal>
    </>
  );
}
