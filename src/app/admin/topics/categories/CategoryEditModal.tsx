"use client";

import { useMemo, useState } from "react";

import { PencilIcon } from "../../../../components/admin/AdminRowActions";
import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
} from "../../../../components/admin/VenesiaModal";
import CategoryParentSelect from "./CategoryParentSelect";
import CategorySlugFields from "./CategorySlugFields";
import { updateCategory } from "./actions";

type CategoryEditModalProps = {
  category: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    sort_order: number | null;
    is_active: boolean | null;
  };
  parentOptions: Array<{ id: number; name: string; level: number }>;
};

export default function CategoryEditModal({ category, parentOptions }: CategoryEditModalProps) {
  const [open, setOpen] = useState(false);
  const formId = useMemo(() => `edit-category-form-${category.id}`, [category.id]);
  const isActive = Boolean(category.is_active);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[8px] border border-[#D8B87A]/20 bg-[#D8B87A]/10 text-[#F1C668] transition hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/16"
        title="تعديل التصنيف"
        aria-label="تعديل التصنيف"
      >
        <PencilIcon />
      </button>

      <VenesiaModal
        open={open}
        title="تعديل التصنيف"
        description="عدّل اسم التصنيف أو الـ Slug أو التصنيف الأب ثم احفظ التعديل."
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminModalCancelButton onClick={() => setOpen(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={formId}>
              حفظ التعديل
            </AdminModalPrimaryButton>
          </>
        }
      >
        <form id={formId} action={updateCategory} className={ADMIN_FORM.gridTwoCol}>
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />

          <div className="md:col-span-2">
            <CategorySlugFields nameDefaultValue={category.name} slugDefaultValue={category.slug} />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">التصنيف الأب</label>
            <CategoryParentSelect
              options={parentOptions}
              defaultValue={category.parent_id}
              excludeId={category.id}
            />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">الترتيب</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={category.sort_order ?? 0}
              className={adminFormFieldClassName("text-right font-en")}
            />
          </div>
        </form>
      </VenesiaModal>
    </>
  );
}
