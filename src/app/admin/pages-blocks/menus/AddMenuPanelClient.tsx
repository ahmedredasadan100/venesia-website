"use client";

import { useEffect, useState, type FormEvent } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { validateSlugFormat } from "../../../../lib/admin/slug";
import {
  ADMIN_FORM,
  AdminActionButton,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminSlugField,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";
import { checkMenuSlugAvailable, createMenu } from "./actions";

export default function AddMenuPanelClient() {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
    const name = String(formData.get("name") ?? "").trim();
    const slugValue = slug.trim();

    if (!name) {
      setFormError("اكتب اسم القائمة.");
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
      const availability = await checkMenuSlugAvailable(slugValue);
      if (!availability.available) {
        setSlugError(availability.message ?? "الـ slug مستخدم بالفعل.");
        setIsPending(false);
        return;
      }

      formData.set("slug", slugValue);
      await createMenu(formData);
    } catch {
      setFormError("تعذر إنشاء القائمة. حاول مرة أخرى.");
      setIsPending(false);
    }
  }

  return (
    <>
      <AdminActionButton variant="primary" onClick={() => setOpen(true)}>
        <PlusIcon />
        إضافة منيو
      </AdminActionButton>

      <VenesiaModal
        open={open}
        title="إضافة قائمة جديدة"
        description="اعمل قائمة فاضية الآن، وافتحها بعد الإنشاء لإضافة عناصرها."
        size="md"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)} disabled={isPending}>
              إلغاء
            </AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-menu-form" disabled={isPending}>
              {isPending ? "جار الإنشاء..." : "إنشاء وفتح القائمة"}
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id="create-menu-form" onSubmit={handleSubmit} className={ADMIN_FORM.grid}>
          {formError ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              {formError}
            </div>
          ) : null}

          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              الاسم العربي
              <input
                name="name"
                required
                placeholder="مثال: القائمة الرئيسية"
                dir="rtl"
                className={adminFormFieldClassName()}
              />
            </label>

            <AdminSlugField
              key={open ? "menu-slug-open" : "menu-slug-closed"}
              sourceInputName="name"
              value={slug}
              error={slugError}
              onChange={setSlug}
            />
          </div>

          <label className={adminFormLabelClassName()}>
            مكان الاستخدام
            <select name="location" defaultValue="main" className={adminFormFieldClassName()}>
              <option value="main">Header / Main</option>
              <option value="mobile">Mobile</option>
              <option value="footer">Footer</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className={ADMIN_FORM.checkboxRow}>
            <span>نشطة</span>
            <input type="checkbox" name="is_active" defaultChecked className="size-4 accent-[#D8B87A]" />
          </label>
        </form>
      </VenesiaModal>
    </>
  );
}
