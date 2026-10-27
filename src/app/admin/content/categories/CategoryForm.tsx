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
import {
  AdminModuleSectionHeader,
  AdminModuleTabIcon,
} from "../../../../components/admin/ui/AdminModuleTabs";
import AdminFormSwitch from "../../../../components/admin/ui/AdminFormSwitch";
import {
  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../../../lib/admin/admin-ui-styles";
import type {
  CategoryFormRecord,
  TaxonomyFormOption,
} from "../../../../lib/admin/content/load-taxonomy-form-data";
import {
  createCategoryForm,
  updateCategoryForm,
} from "../taxonomy-form-actions";
import TaxonomyExpectedRevisionInput from "../TaxonomyExpectedRevisionInput";

type CategoryFormProps = {
  closeHref?: string;
  mode: "create" | "edit";
  category?: CategoryFormRecord | null;
  parentOptions: TaxonomyFormOption[];
};

export default function CategoryForm({
  mode,
  category,
  parentOptions,
  closeHref = "/admin/content/categories",
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
      invalidateEntities={["categories", "topics", "series"]}
      closeHref={closeHref}
      formId="category-taxonomy-form"
    >
      {({ fieldErrors, pending }) => (
        <>
          {category?.id ? (
            <input type="hidden" name="id" value={category.id} />
          ) : null}
          {isEdit ? (
            <TaxonomyExpectedRevisionInput
              initialRevision={category?.updated_at}
            />
          ) : null}

          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormSection
              presentation="panel"
              header={<AdminModuleSectionHeader
                id="category-basic-data"
                sectionHeading="بيانات التصنيف"
                sectionDescription="الاسم والرابط الودّي والعلاقة الهرمية هي مصدر بيانات التصنيف داخل نظام المحتوى."
                icon="categories"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />}
            >
              <AdminFormGrid columns={isEdit ? 3 : 4} presentation="aligned-fields">
                <AdminFormField label="اسم التصنيف" required presentation="panel">
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

                <AdminFormListboxSelect
                  presentation="panel"
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
                  sizing="full"
                  error={fieldErrors.parent_id?.[0] ?? null}
                  emptyMessage="لا توجد تصنيفات متاحة للاختيار."
                  hint="اختياري — اتركه فارغًا لإنشاء تصنيف رئيسي."
                />

                {!isEdit ? (
                  <AdminSlugField
                    labelClassName={adminFormLabelClassName({ textInset: true })}
                    hintClassName={adminFormHintClassName({ textInset: true })}
                    sourceInputName="name"
                    error={fieldErrors.slug?.[0] ?? null}
                  />
                ) : null}

                <div>
                  <span className={adminFormLabelClassName({ textInset: true })}>
                    <span data-admin-form-label-text>حالة النشر</span>
                  </span>
                  <AdminFormSwitch
                    name="is_published"
                    label="منشور"
                    defaultChecked={category?.status === "published"}
                    disabled={pending}
                    surface
                  />
                  <AdminFormError name="is_published" />
                </div>
              </AdminFormGrid>
            </AdminFormSection>
            <AdminFormSection
              presentation="panel"
              header={<AdminModuleSectionHeader
                id="category-color"
                sectionHeading="لون التصنيف"
                icon="settings"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />}
            >
              <CategoryColorPicker
                presentation="panel"
                defaultToken={category?.color_token}
                previewName={category?.name || "معاينة التصنيف"}
              />
              <AdminFormError name="color_token" />
            </AdminFormSection>

            <AdminFormActions description={null} icon={<AdminModuleTabIcon name="content" />} />
          </div>
        </>
      )}
    </AdminFormRuntime>
  );
}
