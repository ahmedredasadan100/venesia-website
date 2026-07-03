"use client";

import { useState } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  ADMIN_FORM,
  AdminActionButton,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import CategorySlugFields from "./CategorySlugFields";
import { createMediaCategory } from "./actions";

const FORM_ID = "create-media-category-form";

export default function MediaCategoryCreateModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdminActionButton variant="primary" onClick={() => setOpen(true)}>
        <PlusIcon />
        إضافة تصنيف
      </AdminActionButton>

      <VenesiaModal
        open={open}
        title="إضافة تصنيف جديد"
        description="أنشئ تصنيفًا جديدًا للمركز الإعلامي وحدّد الوصف والترتيب والحالة قبل الحفظ."
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={FORM_ID}>
              حفظ التصنيف
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id={FORM_ID} action={createMediaCategory} className={ADMIN_FORM.gridTwoCol}>
          <div className="md:col-span-2">
            <CategorySlugFields />
          </div>

          <div className="space-y-2 text-right md:col-span-2">
            <label className="text-xs font-medium text-white/45">الوصف</label>
            <input
              name="description"
              placeholder="وصف داخلي اختياري"
              className={adminFormFieldClassName("text-right")}
            />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">الترتيب</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              className={adminFormFieldClassName("text-right font-en")}
            />
          </div>

          <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
            <span>ظاهر</span>
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-[#D8B87A]" />
          </label>
        </form>
      </VenesiaModal>
    </>
  );
}
