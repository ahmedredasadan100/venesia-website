"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { ProjectCategory } from "../../../config/projects-data";
import { PlusIcon } from "../../../components/admin/AdminRowActions";
import { validateSlugFormat } from "../../../lib/admin/slug";
import {
  ADMIN_FORM,
  AdminActionButton,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminSlugField,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../components/admin/ui";
import { checkProjectFieldsAvailable, createProject } from "./actions";

type AddProjectPanelClientProps = {
  type: ProjectCategory;
};

export default function AddProjectPanelClient({ type }: AddProjectPanelClientProps) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const typeLabel = type === "residential" ? "سكني" : "تجاري";

  useEffect(() => {
    if (!open) return;
    setSlug("");
    setSlugError(null);
    setFormError(null);
    setIsPending(false);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const arabicName = String(formData.get("arabic_name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const slugValue = slug.trim();

    if (!arabicName) {
      setFormError("اكتب اسم المشروع بالعربية.");
      return;
    }

    if (!code) {
      setFormError("اكتب كود المشروع.");
      return;
    }

    const formatError = validateSlugFormat(slugValue);
    if (formatError) {
      setSlugError(formatError);
      return;
    }

    setSlugError(null);
    setIsPending(true);

    try {
      const availability = await checkProjectFieldsAvailable(code, slugValue);
      if (!availability.available) {
        const message = availability.message ?? "الحقول غير متاحة.";
        if (message.includes("slug") || message.includes("Slug")) {
          setSlugError(message);
        } else {
          setFormError(message);
        }
        setIsPending(false);
        return;
      }

      formData.set("slug", slugValue);
      await createProject(formData);
    } catch {
      setFormError("تعذر إنشاء المشروع. حاول مرة أخرى.");
      setIsPending(false);
    }
  }

  return (
    <>
      <AdminActionButton variant="primary" onClick={() => setOpen(true)}>
        <PlusIcon />
        إضافة مشروع
      </AdminActionButton>

      <VenesiaModal
        open={open}
        title={`إضافة مشروع ${typeLabel} جديد`}
        description="أنشئ مشروعًا كمسودة، ثم أكمل تفاصيله من صفحة التعديل."
        size="md"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)} disabled={isPending}>
              إلغاء
            </AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-project-form" disabled={isPending}>
              {isPending ? "جار الإنشاء..." : "إنشاء وفتح المشروع"}
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleSubmit} className={ADMIN_FORM.grid}>
          <input type="hidden" name="type" value={type} />

          {formError ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              {formError}
            </div>
          ) : null}

          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              الاسم العربي
              <input
                name="arabic_name"
                required
                placeholder="مثال: فينيسيا جاردنز"
                dir="rtl"
                className={adminFormFieldClassName()}
              />
            </label>

            <label className={adminFormLabelClassName()}>
              الاسم الإنجليزي
              <input
                name="english_name"
                placeholder="مثال: Venisia Gardens"
                dir="ltr"
                className={`${adminFormFieldClassName()} font-en`}
              />
            </label>
          </div>

          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              كود المشروع
              <input
                name="code"
                required
                placeholder="مثال: venisia-gardens"
                dir="ltr"
                className={`${adminFormFieldClassName()} font-en`}
              />
            </label>

            <AdminSlugField
              key={open ? "project-slug-open" : "project-slug-closed"}
              sourceInputName="code"
              value={slug}
              error={slugError}
              onChange={setSlug}
            />
          </div>

          <label className={adminFormLabelClassName()}>
            الموقع (اختياري)
            <input
              name="location_label"
              placeholder="مثال: التجمع الخامس"
              dir="rtl"
              className={adminFormFieldClassName()}
            />
          </label>
        </form>
      </VenesiaModal>
    </>
  );
}
