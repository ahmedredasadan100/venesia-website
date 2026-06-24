"use client";

import { useMemo, useState } from "react";

import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/VenesiaModal";
import CategoryParentSelect from "./CategoryParentSelect";
import CategorySlugFields from "./CategorySlugFields";
import { createCategory } from "./actions";

type CategoryCreateModalProps = {
  parentOptions: Array<{ id: number; name: string; level: number }>;
};

export default function CategoryCreateModal({ parentOptions }: CategoryCreateModalProps) {
  const [open, setOpen] = useState(false);
  const formId = useMemo(() => "create-category-form", []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-[#F3C46B]/25 bg-[linear-gradient(135deg,#F1C55F_0%,#D6A13D_52%,#A86F1E_100%)] px-5 text-sm font-bold text-white shadow-[0_18px_46px_rgba(216,184,122,0.18),inset_0_1px_0_rgba(255,255,255,0.28)] transition hover:brightness-110"
      >
        <PlusIcon />
        إضافة تصنيف
      </button>

      <VenesiaModal
        open={open}
        title="إضافة تصنيف جديد"
        description="أنشئ تصنيفًا جديدًا وحدّد التصنيف الأب والترتيب قبل الحفظ."
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={formId}>
              حفظ التصنيف
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id={formId} action={createCategory} className={ADMIN_FORM.gridTwoCol}>
          <div className="md:col-span-2">
            <CategorySlugFields />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">التصنيف الأب</label>
            <CategoryParentSelect options={parentOptions} />
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
            <span>منشور</span>
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-[#D8B87A]" />
          </label>
        </form>
      </VenesiaModal>
    </>
  );
}
