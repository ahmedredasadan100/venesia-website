"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  ADMIN_FORM,
  AdminDataGridActionButton,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  VenesiaModal,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import CategoryColorPicker from "../../../../components/admin/content/CategoryColorPicker";
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
    color_token: string | null;
  };
  parentOptions: Array<{ id: number; name: string; level: number }>;
  /** Optional primary-cell trigger that opens the same edit destination. */
  renderTrigger?: (open: () => void) => ReactNode;
  showActionButton?: boolean;
};

export default function CategoryEditModal({
  category,
  parentOptions,
  renderTrigger,
  showActionButton = true,
}: CategoryEditModalProps) {
  const [open, setOpen] = useState(false);
  const formId = useMemo(() => `edit-category-form-${category.id}`, [category.id]);
  const isActive = Boolean(category.is_active);

  return (
    <>
      {renderTrigger ? renderTrigger(() => setOpen(true)) : null}
      {showActionButton ? (
        <AdminDataGridActionButton
          action="edit"
          size="compact"
          title="تعديل التصنيف"
          onClick={() => setOpen(true)}
        />
      ) : null}

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

          <CategoryColorPicker
            defaultToken={category.color_token}
            previewName={category.name}
          />
        </form>
      </VenesiaModal>
    </>
  );
}
