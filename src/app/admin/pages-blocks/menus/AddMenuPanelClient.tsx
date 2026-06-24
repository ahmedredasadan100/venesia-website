"use client";

import { useState } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { AdminActionButton } from "../../../../components/admin/ui";
import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/VenesiaModal";
import { createMenu } from "./actions";

export default function AddMenuPanelClient() {
  const [open, setOpen] = useState(false);

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
            <AdminModalCancelButton onClick={() => setOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-menu-form">
              إنشاء وفتح القائمة
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id="create-menu-form" action={createMenu} className={ADMIN_FORM.grid}>
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

            <label className={adminFormLabelClassName()}>
              Slug
              <input
                name="slug"
                required
                placeholder="main-menu"
                dir="ltr"
                className={adminFormFieldClassName("text-left font-en")}
              />
              <span className={adminFormHintClassName()}>لا يمكن تكرار الـ slug لأنه هو المفتاح التقني للقائمة.</span>
            </label>
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
