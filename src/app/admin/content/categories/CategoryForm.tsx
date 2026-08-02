"use client";

import CategoryColorPicker from "../../../../components/admin/content/CategoryColorPicker";
import {
  AdminFormField,
  AdminFormSection,
  AdminSlugField,
  ADMIN_FORM_STACK_CLASS_NAME,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import AdminFormListboxSelect from "../../../../components/admin/ui/AdminFormListboxSelect";
import AdminFormRuntime, {
  AdminFormActions,
  AdminFormError,
  AdminFormGrid,
} from "../../../../components/admin/ui/AdminFormRuntime";
import AdminFormSwitch from "../../../../components/admin/ui/AdminFormSwitch";
import type {
  CategoryFormRecord,
  TaxonomyFormOption,
} from "../../../../lib/admin/content/load-taxonomy-form-data";
import {
  createCategoryForm,
  updateCategoryForm,
} from "../taxonomy-form-actions";

type CategoryFormProps = {
  mode: "create" | "edit";
  category?: CategoryFormRecord | null;
  parentOptions: TaxonomyFormOption[];
};

export default function CategoryForm({
  mode,
  category,
  parentOptions,
}: CategoryFormProps) {
  const isEdit = mode === "edit";
  const action = isEdit ? updateCategoryForm : createCategoryForm;
  const options: TaxonomyFormOption[] = [
    { value: "", label: "بدون تصنيف أب" },
    ...parentOptions,
  ];

  return (
    <AdminFormRuntime
      action={action}
      mode={mode}
      entityKey="category"
      closeHref="/admin/content/categories"
      formId="category-taxonomy-form"
      className={ADMIN_FORM_STACK_CLASS_NAME}
    >
      {({ fieldErrors, pending }) => (
        <>
          {category?.id ? (
            <input type="hidden" name="id" value={category.id} />
          ) : null}

          <AdminFormSection
            eyebrow="BASIC DATA"
            title="بيانات التصنيف"
            description="الاسم والرابط الودّي والعلاقة الهرمية هي مصدر بيانات التصنيف داخل نظام المحتوى."
          >
            <AdminFormGrid columns={3}>
              <AdminFormField label="اسم التصنيف" required>
                <input
                  name="name"
                  required
                  disabled={pending}
                  defaultValue={category?.name ?? ""}
                  placeholder="مثال: نصائح عقارية"
                  aria-invalid={Boolean(fieldErrors.name?.length)}
                  aria-describedby={
                    fieldErrors.name?.length ? "name-error" : undefined
                  }
                  className={adminFormFieldClassName(
                    fieldErrors.name?.length ? "border-red-400/40" : "",
                  )}
                />
                <AdminFormError name="name" />
              </AdminFormField>

              <AdminSlugField
                sourceInputName="name"
                value={isEdit ? category?.slug ?? "" : undefined}
                readOnly={isEdit}
                error={fieldErrors.slug?.[0] ?? null}
              />

              <AdminFormListboxSelect
                name="parent_id"
                focusTargetId="parent_id"
                label="التصنيف الأب"
                options={options}
                defaultValue={
                  category?.parent_id ? String(category.parent_id) : ""
                }
                placeholder="بدون تصنيف أب"
                searchPlaceholder="ابحث في التصنيفات"
                searchable={parentOptions.length > 7}
                disabled={pending}
                error={fieldErrors.parent_id?.[0] ?? null}
                emptyMessage="لا توجد تصنيفات متاحة للاختيار."
                hint="اختياري — اتركه فارغًا لإنشاء تصنيف رئيسي."
              />
            </AdminFormGrid>

            <div className="mt-6 space-y-5">
              <AdminFormSwitch
                name="is_published"
                label="منشور"
                defaultChecked={category?.is_active ?? true}
                disabled={pending}
                surface
              />
              <AdminFormError name="is_published" />

              <CategoryColorPicker
                defaultToken={category?.color_token}
                previewName={category?.name || "معاينة التصنيف"}
              />
              <AdminFormError name="color_token" />
            </div>
          </AdminFormSection>

          <AdminFormActions />
        </>
      )}
    </AdminFormRuntime>
  );
}
