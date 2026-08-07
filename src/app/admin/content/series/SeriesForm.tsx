"use client";

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
  SeriesFormRecord,
  TaxonomyFormOption,
} from "../../../../lib/admin/content/load-taxonomy-form-data";
import {
  createSeriesForm,
  updateSeriesForm,
} from "../taxonomy-form-actions";

type SeriesFormProps = {
  mode: "create" | "edit";
  series?: SeriesFormRecord | null;
  categoryOptions: TaxonomyFormOption[];
};

export default function SeriesForm({
  mode,
  series,
  categoryOptions,
}: SeriesFormProps) {
  const isEdit = mode === "edit";
  const action = isEdit ? updateSeriesForm : createSeriesForm;

  return (
    <AdminFormRuntime
      action={action}
      mode={mode}
      entityKey="series"
      closeHref="/admin/content/series"
      formId="series-taxonomy-form"
      className={ADMIN_FORM_STACK_CLASS_NAME}
    >
      {({ fieldErrors, pending }) => (
        <>
          {series?.id ? (
            <input type="hidden" name="id" value={series.id} />
          ) : null}

          <AdminFormSection
            eyebrow="BASIC DATA"
            title="بيانات السلسلة"
            description="أنشئ علاقة واضحة بين السلسلة وتصنيفها، مع الحفاظ على رابط ثابت بعد أول حفظ."
          >
            <AdminFormGrid columns={3}>
              <AdminFormField label="اسم السلسلة" required>
                <input
                  name="name"
                  required
                  disabled={pending}
                  defaultValue={series?.name ?? ""}
                  placeholder="مثال: اعرف السوق"
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
                value={isEdit ? series?.slug ?? "" : undefined}
                readOnly={isEdit}
                error={fieldErrors.slug?.[0] ?? null}
              />

              <AdminFormListboxSelect
                name="category_id"
                focusTargetId="category_id"
                label="التصنيف"
                options={categoryOptions}
                defaultValue={
                  series?.category_id ? String(series.category_id) : ""
                }
                placeholder="اختر التصنيف"
                searchPlaceholder="ابحث في التصنيفات"
                searchable={categoryOptions.length > 7}
                required
                disabled={pending}
                error={fieldErrors.category_id?.[0] ?? null}
                emptyMessage="لا توجد تصنيفات منشورة متاحة."
                hint="يظهر في الاختيار التصنيف الحالي حتى لو أصبح غير منشور."
              />
            </AdminFormGrid>

            <div className="mt-6 space-y-3">
              <AdminFormSwitch
                name="is_published"
                label="منشور"
                defaultChecked={
                  isEdit ? series?.status === "published" : false
                }
                disabled={pending}
                surface
              />
              <AdminFormError name="is_published" />
            </div>
          </AdminFormSection>

          <AdminFormActions />
        </>
      )}
    </AdminFormRuntime>
  );
}
