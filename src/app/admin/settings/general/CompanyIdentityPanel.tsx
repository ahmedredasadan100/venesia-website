"use client";

import { AdminMediaImageField } from "../../../../components/admin/media";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import {
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminCard,
  AdminFormActions,
  AdminFormControlHeader,
  AdminFormError,
  AdminFormField,
  AdminFormGrid,
  AdminFormRuntime,
  AdminFormSection,
  AdminStatusPill,
  adminFormFieldClassName,
} from "../../../../components/admin/ui";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import type { ResolvedAdminCompanyConfig } from "../../../../lib/admin/shell/contracts";
import { updateAdminCompanyAction } from "./actions";

export default function CompanyIdentityPanel({
  company,
}: {
  company: ResolvedAdminCompanyConfig;
}) {
  const textFields = [
    { name: "key", label: "Company key", value: company.key, dir: "ltr" as const },
    { name: "name", label: "اسم الشركة", value: company.name },
    { name: "adminLabel", label: "عنوان الإدارة", value: company.adminLabel },
    { name: "cmsLabel", label: "CMS label", value: company.cmsLabel, dir: "ltr" as const },
    {
      name: "publicWebsiteUrl",
      label: "رابط الموقع العام",
      value: company.publicWebsiteUrl,
      dir: "ltr" as const,
    },
  ];
  const colorFields = [
    ["accentColor", "اللون الأساسي", company.accentColor],
    ["accentStrongColor", "اللون البارز", company.accentStrongColor],
    ["surfaceColor", "لون الخلفية", company.surfaceColor],
  ] as const;

  return (
    <section data-admin-company-settings>
      <AdminFormRuntime
        action={updateAdminCompanyAction}
        mode="edit"
        entityKey="admin-company-identity"
        closeHref="/admin"
      >
        {({ fieldErrors }) => (
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
            <AdminFormGrid columnRatio="3:2" presentation="equal-height-columns">
              <AdminFormGrid columns={1} density="sections">
                <AdminFormSection
                  presentation="panel"
                  header={<AdminModuleSectionHeader
                    id="company-identity"
                    sectionHeading="هوية لوحة الإدارة"
                    sectionDescription="الهوية والألوان والشعارات هنا تخص الـAdmin Shell ولا تغير بيانات المحتوى."
                    icon="settings"
                    sectionSummary={<AdminStatusPill>المصدر: {company.source}</AdminStatusPill>}
                    sectionHeaderPresentation="premium"
                    sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
                  />}
                >
                  <AdminFormGrid columns={1}>
                    <AdminFormError />
                    <AdminFormGrid columns={1}>
                      {textFields.map(({ name, label, value, dir }) => (
                        <AdminFormField key={name} label={label} required presentation="panel">
                          <input
                            name={name}
                            defaultValue={value}
                            required
                            dir={dir}
                            className={adminFormFieldClassName(
                              fieldErrors[name]?.length ? "border-red-400/40" : "",
                            )}
                            aria-invalid={Boolean(fieldErrors[name]?.length)}
                            aria-describedby={
                              fieldErrors[name]?.length ? `${name}-error` : undefined
                            }
                          />
                          <AdminFormError name={name} />
                        </AdminFormField>
                      ))}
                    </AdminFormGrid>
                  </AdminFormGrid>
                </AdminFormSection>
                <AdminFormSection
                  presentation="panel"
                  header={<AdminModuleSectionHeader
                    id="company-colors"
                    sectionHeading="ألوان الهوية"
                    sectionDescription="ألوان لوحة الإدارة الحالية، وتُحفظ مع بيانات هوية الإدارة."
                    icon="settings"
                    sectionHeaderPresentation="premium"
                    sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
                  />}
                >
                  <AdminFormGrid columns={3} presentation="aligned-fields">
                    {colorFields.map(([name, label, value]) => (
                      <AdminFormField key={name} label={label} required presentation="panel" hint={<span dir="ltr">{value}</span>}>
                        <input
                          name={name}
                          type="color"
                          defaultValue={value}
                          className={adminFormFieldClassName(
                            fieldErrors[name]?.length ? "border-red-400/40" : "",
                          )}
                          aria-label={label}
                          aria-invalid={Boolean(fieldErrors[name]?.length)}
                          aria-describedby={
                            fieldErrors[name]?.length ? `${name}-error` : undefined
                          }
                        />
                        <AdminFormError name={name} />
                      </AdminFormField>
                    ))}
                  </AdminFormGrid>
                </AdminFormSection>
              </AdminFormGrid>
              <AdminFormGrid columns={1} density="sections">
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormGrid columns={1}>
                    <AdminFormControlHeader title="الشعار الرئيسي" icon={<AdminModuleTabIcon name="media" />} presentation="compact-inline" />
                    <AdminMediaImageField
                      name="logoUrl"
                      label="الشعار الرئيسي"
                      focusTargetId="logoUrl"
                      ariaInvalid={Boolean(fieldErrors.logoUrl?.length)}
                      ariaDescribedBy={fieldErrors.logoUrl?.length ? "logoUrl-error" : undefined}
                      defaultValue={company.logoUrl}
                      browseFolder="images"
                      variant="card"
                      showLabel={false}
                    />
                    <AdminFormError name="logoUrl" />
                  </AdminFormGrid>
                </AdminCard>
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormGrid columns={1}>
                    <AdminFormControlHeader title="الشعار المصغر" icon={<AdminModuleTabIcon name="media" />} presentation="compact-inline" />
                    <AdminMediaImageField
                      name="compactLogoUrl"
                      label="الشعار المصغر"
                      focusTargetId="compactLogoUrl"
                      ariaInvalid={Boolean(fieldErrors.compactLogoUrl?.length)}
                      ariaDescribedBy={fieldErrors.compactLogoUrl?.length ? "compactLogoUrl-error" : undefined}
                      defaultValue={company.compactLogoUrl}
                      browseFolder="images"
                      variant="card"
                      showLabel={false}
                    />
                    <AdminFormError name="compactLogoUrl" />
                  </AdminFormGrid>
                </AdminCard>
              </AdminFormGrid>
            </AdminFormGrid>
            <AdminFormActions
              icon={<AdminModuleTabIcon name="content" />}
              submitLabel="حفظ هوية الإدارة"
              pendingLabel="جارٍ الحفظ…"
              closeLabel="العودة إلى لوحة الإدارة"
              title="إجراءات النموذج"
              description="تُحدّث التغييرات بعد اكتمال الحفظ."
            />
          </div>
        )}
      </AdminFormRuntime>
    </section>
  );
}
