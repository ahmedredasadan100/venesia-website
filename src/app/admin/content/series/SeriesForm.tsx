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
  SeriesFormRecord,
  TaxonomyFormOption,
} from "../../../../lib/admin/content/load-taxonomy-form-data";
import {
  createSeriesForm,
  updateSeriesForm,
} from "../taxonomy-form-actions";
import TaxonomyExpectedRevisionInput from "../TaxonomyExpectedRevisionInput";

type SeriesFormProps = {
  closeHref?: string;
  mode: "create" | "edit";
  series?: SeriesFormRecord | null;
  categoryOptions: TaxonomyFormOption[];
};

export default function SeriesForm({
  mode,
  series,
  categoryOptions,
  closeHref = "/admin/content/series",
}: SeriesFormProps) {
  const isEdit = mode === "edit";
  const action = isEdit ? updateSeriesForm : createSeriesForm;

  return (
    <AdminFormRuntime
      action={action}
      mode={mode}
      entityKey="series"
      invalidateEntities={["series", "topics", "categories"]}
      closeHref={closeHref}
      formId="series-taxonomy-form"
    >
      {({ fieldErrors, pending }) => (
        <>
          {series?.id ? (
            <input type="hidden" name="id" value={series.id} />
          ) : null}
          {isEdit ? (
            <TaxonomyExpectedRevisionInput initialRevision={series?.updated_at} />
          ) : null}

          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormSection
              presentation="panel"
              header={<AdminModuleSectionHeader
                id="series-basic-data"
                sectionHeading="بيانات السلسلة"
                sectionDescription="أنشئ علاقة واضحة بين السلسلة وتصنيفها، مع الحفاظ على رابط ثابت بعد أول حفظ."
                icon="link"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />}
            >
              <AdminFormGrid columns={isEdit ? 3 : 4} presentation="aligned-fields">
                <AdminFormField label="اسم السلسلة" required presentation="panel">
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

                {!isEdit ? (
                  <AdminSlugField
                    labelClassName={adminFormLabelClassName({ textInset: true })}
                    hintClassName={adminFormHintClassName({ textInset: true })}
                    sourceInputName="name"
                    error={fieldErrors.slug?.[0] ?? null}
                  />
                ) : null}

                <AdminFormListboxSelect
                  presentation="panel"
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
                  sizing="full"
                  error={fieldErrors.category_id?.[0] ?? null}
                  emptyMessage="لا توجد تصنيفات منشورة متاحة."
                  hint="يظهر في الاختيار التصنيف الحالي حتى لو أصبح غير منشور."
                />

                <div>
                  <span className={adminFormLabelClassName({ textInset: true })}>
                    <span data-admin-form-label-text>حالة النشر</span>
                  </span>
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
              </AdminFormGrid>
            </AdminFormSection>

            <AdminFormActions description={null} icon={<AdminModuleTabIcon name="content" />} />
          </div>
        </>
      )}
    </AdminFormRuntime>
  );
}
